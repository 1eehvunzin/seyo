import os
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["AI_PROVIDER"] = "rules"  # rule-based path, no network

import pytest
from fastapi.testclient import TestClient

from app.ai import rules_edit, rules_plan
from app.db import Base, engine
from app.main import app
from app.reminders import due_messages


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def login(client, sub, name):
    r = client.post("/auth/dev", json={"sub": sub, "name": name})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


PAGE = {
    "name": "중간고사 플래너",
    "theme": "butter",
    "top": {"kind": "dday", "label": "중간고사", "date": "2026. 12. 1"},
    "main": {"kind": "today3", "todos": [{"id": "t1", "text": "쎈", "done": False}], "laterCount": 3},
    "side": "timetable",
    "memo": None,
    "widget": {"size": "large", "templates": ["bigNumber", "shortList"]},
}


def test_requires_login(client):
    assert client.get("/pages").status_code == 401


def test_owner_member_flow(client):
    owner = login(client, "a", "현진")
    member = login(client, "b", "지수")

    page = client.post("/pages", json={"page": PAGE}, headers=owner).json()
    assert page["owner"] is None and page["inviteToken"]

    # invite → join
    token = page["inviteToken"]
    assert client.get(f"/invites/{token}").json()["pageName"] == "중간고사 플래너"
    joined = client.post(f"/invites/{token}/join", json={}, headers=member).json()
    assert joined["owner"]["name"] == "현진" and joined["inviteToken"] == ""
    assert [m["name"] for m in client.get(f"/pages/{page['id']}", headers=owner).json()["members"]] == ["지수"]

    # member can check things off, but not change the page's shape
    done_main = {**PAGE["main"], "todos": [{"id": "t1", "text": "쎈", "done": True}]}
    r = client.patch(f"/pages/{page['id']}", json={"patch": {"main": done_main}}, headers=member)
    assert r.status_code == 200 and r.json()["main"]["todos"][0]["done"] is True
    assert client.patch(f"/pages/{page['id']}", json={"patch": {"theme": "sky"}}, headers=member).status_code == 403
    assert client.patch(f"/pages/{page['id']}", json={"patch": {"main": {"kind": "habits"}}}, headers=member).status_code == 403

    # stale edits are rejected
    assert client.patch(f"/pages/{page['id']}", json={"patch": {"theme": "sky"}, "base_version": 1}, headers=owner).status_code == 409

    # 내보내기 + 링크 새로 만들기 → old link dead
    member_id = client.get("/me", headers=member).json()["id"]
    client.delete(f"/pages/{page['id']}/members/{member_id}", headers=owner)
    assert client.get(f"/pages/{page['id']}", headers=member).status_code == 404
    new = client.post(f"/pages/{page['id']}/invite/reset", headers=owner).json()
    assert new["inviteToken"] != token
    assert client.post(f"/invites/{token}/join", json={}, headers=member).status_code == 404
    assert new["inviteUrl"].endswith(f"/join/{new['inviteToken']}")


def test_member_leave_and_owner_delete(client):
    owner = login(client, "a", "현진")
    member = login(client, "b", "지수")
    page = client.post("/pages", json={"page": PAGE}, headers=owner).json()
    client.post(f"/invites/{page['inviteToken']}/join", json={}, headers=member)
    assert client.post(f"/pages/{page['id']}/leave", headers=owner).status_code == 400
    assert client.post(f"/pages/{page['id']}/leave", headers=member).status_code == 204
    assert client.get("/pages", headers=member).json() == []
    assert client.delete(f"/pages/{page['id']}", headers=member).status_code == 404
    assert client.delete(f"/pages/{page['id']}", headers=owner).status_code == 204


def test_free_page_limit_and_plus(client):
    h = login(client, "a", "현진")
    for _ in range(5):
        assert client.post("/pages", json={"page": PAGE}, headers=h).status_code == 201
    assert client.post("/pages", json={"page": PAGE}, headers=h).status_code == 402
    assert client.post("/billing/dev-plus", headers=h).json()["plus"] is True
    assert client.post("/pages", json={"page": PAGE}, headers=h).status_code == 201


def test_test_plus_only_listed_accounts_when_dev_billing_off(client, monkeypatch):
    from app.config import get_settings

    tester = login(client, "t", "테스터")
    other = login(client, "o", "남")
    tester_id = client.get("/me", headers=tester).json()["id"]
    monkeypatch.setattr(get_settings(), "dev_billing", False)
    monkeypatch.setattr(get_settings(), "test_plus_users", f" {tester_id} , usr_other")
    assert client.post("/billing/dev-plus", headers=other).status_code == 404
    assert client.get("/me", headers=other).json()["plus"] is False
    assert client.post("/billing/dev-plus", headers=tester).json()["plus"] is True


def test_test_plus_for_accounts_made_before_cutoff(client, monkeypatch):
    from datetime import datetime, timedelta, timezone

    from app.config import get_settings

    old = login(client, "old", "예전")
    monkeypatch.setattr(get_settings(), "dev_billing", False)
    monkeypatch.setattr(get_settings(), "test_plus_before", (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat())
    assert client.post("/billing/dev-plus", headers=old).json()["plus"] is True
    monkeypatch.setattr(get_settings(), "test_plus_before", (datetime.now(timezone.utc) - timedelta(days=1)).isoformat())
    new = login(client, "new", "새로")
    assert client.post("/billing/dev-plus", headers=new).status_code == 404


def test_paywall_seen_once(client):
    h = login(client, "a", "현진")
    assert client.get("/me", headers=h).json()["paywallSeen"] is False
    assert client.post("/me/paywall-seen", headers=h).json()["paywallSeen"] is True


def test_ai_generate_and_edit_rules(client):
    h = login(client, "a", "현진")
    r = client.post("/ai/generate", json={"prompt": "수학 오답노트 만들어줘. 3일 뒤에 다시 풀라고 알려줘"}, headers=h).json()
    assert r["source"] == "rules" and r["page"]["main"]["kind"] == "wrong" and r["page"]["name"] == "수학 오답노트"
    assert r["steps"][-1]["key"] == "widget"
    e = client.post("/ai/edit", json={"page": r["page"], "command": "하늘색으로 바꿔줘"}, headers=h).json()
    assert e["change"] == "theme" and e["page"]["theme"] == "sky"
    left = e["left"]
    e = client.post("/ai/edit", json={"page": r["page"], "command": "주말 칸도 만들어줘"}, headers=h).json()
    assert e["page"] is None and e["message"]
    assert e["left"] == left  # a failed edit doesn't use up a try


def test_monthly_ai_limit(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "free_ai_edits_per_month", 2)
    h = login(client, "a", "현진")
    for _ in range(2):
        assert client.post("/ai/edit", json={"page": PAGE, "command": "하늘색으로"}, headers=h).status_code == 200
    assert client.post("/ai/edit", json={"page": PAGE, "command": "하늘색으로"}, headers=h).status_code == 402
    assert client.get("/ai/usage", headers=h).json()["left"] == 0
    client.post("/billing/dev-plus", headers=h)
    assert client.post("/ai/edit", json={"page": PAGE, "command": "하늘색으로"}, headers=h).status_code == 200


def test_guest_edit_limit(client):
    g = {"X-Device-Id": "install-abc12345"}
    assert client.get("/ai/guest/usage", headers=g).json() == {"limit": 5, "left": 5, "period": "trial"}
    for i in range(5):
        r = client.post("/ai/guest/edit", json={"page": PAGE, "command": "하늘색으로 바꿔줘"}, headers=g)
        assert r.status_code == 200 and r.json()["left"] == 4 - i
    assert client.post("/ai/guest/edit", json={"page": PAGE, "command": "하늘색으로 바꿔줘"}, headers=g).status_code == 402
    # another install is separate; a missing id is refused
    assert client.post("/ai/guest/edit", json={"page": PAGE, "command": "메모 칸 넣어줘"}, headers={"X-Device-Id": "install-zzz99999"}).json()["page"]["memo"] == ""
    assert client.post("/ai/guest/edit", json={"page": PAGE, "command": "메모"}).status_code == 400


def test_vibe_ops_apply_and_validate():
    from app import vibe

    page = {**PAGE, "id": "page_1", "inviteToken": "tok", "main": {**PAGE["main"], "todos": [{"id": "t1", "text": "쎈", "done": True}]}}
    # add two todos, rename one, move to sky: the checked todo stays checked, ids are filled
    plan = vibe.EditOps(
        ops=[
            vibe.Op(op="insert", path="main.todos.-", value='{"id":"","subject":"영어","text":"단어 50개","done":false}'),
            vibe.Op(op="insert", path="main.todos.-", value='{"id":"","text":"국어 비문학","done":false}'),
            vibe.Op(op="set", path="theme", value='"sky"'),
        ],
        summary="할 일 2개를 더 넣었어요",
        message=None,
    )
    new, changed, text = vibe.result_page(page, plan, [])
    assert new is not None and set(changed) == {"main", "theme"} and text.startswith("할 일")
    todos = new["main"]["todos"]
    assert todos[0] == {"id": "t1", "text": "쎈", "done": True} and len(todos) == 3 and all(t["id"] for t in todos)
    assert new["inviteToken"] == "tok" and vibe.highlight_for(changed) == "main"

    # switching kind: whole main replaced
    plan = vibe.EditOps(ops=[vibe.Op(op="set", path="main", value='{"kind":"habits","habits":[{"id":"","name":"물 마시기","week":[]}],"remind":false}')], summary="습관 체크로 바꿨어요", message=None)
    new, _, _ = vibe.result_page(page, plan, [])
    assert new["main"]["habits"][0]["week"] == [False] * 7

    # protected fields, broken shapes and unknown kinds are rejected
    for bad in (
        vibe.Op(op="set", path="inviteToken", value='"x"'),
        vibe.Op(op="set", path="theme", value='"purple"'),
        vibe.Op(op="set", path="main", value='{"kind":"kanban"}'),
        vibe.Op(op="set", path="main.todos.9.text", value='"x"'),
        vibe.Op(op="set", path="name", value="not json"),
    ):
        new, _, msg = vibe.result_page(page, vibe.EditOps(ops=[bad], summary="", message=None), [])
        assert new is None and msg


def test_vibe_keeps_photos_out_of_prompt():
    from app import vibe

    photo = "data:image/jpeg;base64," + "A" * 5000
    page = {**PAGE, "main": {"kind": "wrong", "photo": photo, "reasons": ["계산 실수"], "reason": None, "reviewInDays": 3, "notes": [], "units": None, "unit": None, "retryCount": None, "stats": False, "entries": []}}
    prompt, bag = vibe.prompt_for(page, "단원별로 나눠줘")
    assert photo not in prompt and "@keep0" in prompt
    plan = vibe.EditOps(ops=[vibe.Op(op="set", path="main.units", value='["1단원","2단원"]')], summary="단원으로 나눴어요", message=None)
    new, _, _ = vibe.result_page(page, plan, bag)
    assert new["main"]["photo"] == photo and new["main"]["units"] == ["1단원", "2단원"]


def test_generate_steps_match_page():
    from app import ai

    plan = ai.PagePlan(
        name="수학 공부", theme="sky", kind="habits", top_label="중간고사", top_date="2026-12-10", habits=["개념 복습"], memo=False,
        steps=[ai.Step(key="top", text="시험 날짜 칸"), ai.Step(key="notes", text="메모 칸"), ai.Step(key="week", text="이번 주"), ai.Step(key="widget", text="위젯")],
        follow_ups=[],
    )
    page = ai.plan_to_page(plan)
    assert page["top"] == {"kind": "dday", "label": "중간고사", "date": "2026. 12. 10"}  # a date wins over the habit streak
    keys = [s["key"] for s in ai._real_steps(page, plan.steps)]
    assert keys == ["top", "body", "widget"]  # no memo / week sections → those steps are dropped


def test_rule_parsers():
    assert rules_plan("팀플 발표 준비, 역할 나누기").kind == "roles"
    assert rules_plan("물 마시기랑 스트레칭 습관").habits == ["물 마시기", "스트레칭"]
    assert rules_plan("기분이랑 날씨 다이어리").log_fields == ["오늘 기분", "날씨"]
    assert rules_edit("이름을 기말 플래너로 바꿔줘").name == "기말 플래너"
    assert rules_edit("메모 칸 빼줘").memo_on is False


def test_delete_account(client):
    h = login(client, "a", "현진")
    client.post("/pages", json={"page": PAGE}, headers=h)
    assert client.delete("/me", headers=h).status_code == 204
    assert client.get("/me", headers=h).status_code == 401


def test_join_landing_escapes(client):
    html = client.get('/join/"><script>x</script>').text
    assert "<script>x</script>" not in html


def test_reminders_due(client):
    from app.db import SessionLocal
    from app.models import Page, User

    with SessionLocal() as db:
        u = User(provider="dev", provider_sub="r", name="r")
        db.add(u)
        db.flush()
        db.add(Page(owner_id=u.id, doc={"name": "오답", "main": {"kind": "wrong", "entries": [{"reviewAt": 0}]}}))
        db.add(Page(owner_id=u.id, doc={"name": "하루", "main": {"kind": "log", "remind": True, "values": {}}}))
        db.commit()
        msgs = due_messages(db, datetime.now(timezone.utc))
    assert {m[1] for m in msgs} == {"오답", "하루"}


def test_code_create_and_blocks():
    from app import code

    html, summary = code.split_created("<!-- 요약: 타이머를 만들었어요 -->\n<!doctype html><html><head><title>타이머</title></head><body><p>0</p>\n  <button>시작</button>\n</body></html>")
    assert html.startswith("<!doctype") and summary == "타이머를 만들었어요"

    edit = "버튼 글자를 바꿨어요\n<<<<<<< SEARCH\n<button>시작</button>\n=======\n<button>출발</button>\n>>>>>>> REPLACE"
    new, s, n = code.apply_blocks(html, edit)
    assert n == 1 and "<button>출발</button>" in new and "  <button>출발" in new and s == "버튼 글자를 바꿨어요"
    # indentation drift still applies; a block that isn't in the file is reported
    assert "<a>1</a>" in code.apply_blocks(new, "x\n<<<<<<< SEARCH\n      <button>출발</button>\n=======\n<a>1</a>\n>>>>>>> REPLACE")[0]
    assert code.apply_blocks(html, "x\n<<<<<<< SEARCH\n<div>없음</div>\n=======\n<p>1</p>\n>>>>>>> REPLACE")[0] is None
    # no blocks = the model explained why it can't
    assert code.apply_blocks(html, "인터넷은 쓸 수 없어요. 대신 직접 적는 칸은 어때요?") == (html, "인터넷은 쓸 수 없어요. 대신 직접 적는 칸은 어때요?", 0)


def test_code_app_guest_needs_device(client, monkeypatch):
    from app import code

    monkeypatch.setattr(code, "available", lambda: True)
    # before login it runs on the onboarding tries, which need an install id
    assert client.post("/ai/app", json={"prompt": "타이머"}).status_code == 400


def test_edit_says_ai_is_down_instead_of_cant():
    import asyncio

    from app import ai

    r = asyncio.run(ai.edit(PAGE, "배경을 화이트로 바꿔줘"))
    assert r["page"]["theme"] == "clean"  # rules know 화이트 now
    r = asyncio.run(ai.edit(PAGE, "공부하면 캐릭터가 자라게 해줘"))
    assert r["page"] is None and "아직" not in r["message"]


def test_code_blocks_malformed_and_checklist():
    from app import code

    html = "<!doctype html><html><body>\n<p>a</p>\n<script>\nlet x = 1;\n</script>\n</body></html>"
    # a doubled separator must not leak into the code
    bad = "고쳤어요\n<<<<<<< SEARCH\nlet x = 1;\n=======\nlet x = 2;\n=======\nlet y = 3;\n>>>>>>> REPLACE"
    assert code.apply_blocks(html, bad)[0] is None
    assert code.lint(html.replace("let x = 1;", "=======")) and "=======" in code.lint(html.replace("let x = 1;", "=======\n"))[0] + "======="
    good = "타이머를 넣었어요\n- 제한시간 바: 마크업, 타이머\n- 콤보: 상태, render\n<<<<<<< SEARCH\nlet x = 1;\n=======\nlet x = 2;\n>>>>>>> REPLACE"
    new, summary, n = code.apply_blocks(html, good)
    assert n == 1 and "let x = 2;" in new and summary == "타이머를 넣었어요"
    assert code.checklist(good) == ["제한시간 바: 마크업, 타이머", "콤보: 상태, render"]


def test_code_blocks_partial_keeps_good_blocks():
    from app import code

    html = "<!doctype html><html><body>\n<p>a</p>\n<p>b</p>\n<script>\nlet x = 1;\n</script>\n</body></html>"
    out = (
        "고쳤어요\n<<<<<<< SEARCH\n<p>a</p>\n=======\n<p>A</p>\n>>>>>>> REPLACE\n"
        "<<<<<<< SEARCH\n<p>b</p>\n<p>B</p>\n>>>>>>> REPLACE\n"  # missing =======
        "<<<<<<< SEARCH\nlet x = 1;\n=======\nlet x = 2;\n>>>>>>> REPLACE\n*** End Patch"
    )
    assert code.apply_blocks(html, out)[0] is None
    new, n, failed = code.apply_partial(html, out)
    assert n == 2 and "<p>A</p>" in new and "let x = 2;" in new and "<p>b</p>" in new
    assert len(failed) == 1 and "<p>B</p>" in failed[0]
    assert not code.lint(new.replace("<p>b</p>", "")) or "Patch" not in "".join(code.lint(new))


def test_code_blocks_near_miss_markers():
    from app import code

    html = "<p>a</p>\n<script>\nif (a === b) x = 1;\n</script>"
    out = "고쳤어요\n<<<<<<< SEARCH\n<p>a</p>\n=======\n<p>A</p>\n>>>>>>\n<<<<<< SEARCH\nif (a === b) x = 1;\n========\nif (a === b) x = 2;\n>>>>>>> REPLACE"
    new, _, n = code.apply_blocks(html, out)
    assert n == 2 and "<p>A</p>" in new and "x = 2;" in new and "a === b" in new


def test_code_blocks_diff_style_replace_is_rejected():
    from app import code

    html = "<script>\nlet a = 1;\nlet b = 2;\n</script>\n</html>"
    out = "고쳤어요\n<<<<<<< SEARCH\nlet a = 1;\n=======\n+  let a = 3;\n+  let c = 4;\n@@\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nlet b = 2;\n=======\nlet b = 5;\n>>>>>>> REPLACE"
    assert code.apply_blocks(html, out)[0] is None
    new, n, failed = code.apply_partial(html, out)
    assert n == 1 and "let b = 5;" in new and "let a = 1;" in new and len(failed) == 1
    assert any("diff" in i for i in code.lint(html.replace("let a = 1;", "+  let a = 3;\n+  x();\n+  y();")))
    assert not code.lint("<!doctype html><html><body><script>\nconst x = a - b;\nlet y = -1;\n</script></body></html>")


def test_code_photo_slots_and_stash():
    from app import code

    img = "data:image/jpeg;base64," + "A" * 400
    html = f'<img src="{img}"><p>x</p>'
    short, kept = code.stash_images(html)
    assert img not in short and "data:seyo/0" in short and kept == [img]
    assert code.unstash_images(short, kept) == html
    assert code.fill_photos('<img src="{{photo1}}"><img src="{{ photo2 }}">', [img]) == f'<img src="{img}"><img src="">'
    assert "{{photo1}}" in code._photo_note([img], place=True) and "{{photo1}}" not in code._photo_note([img]) and code._photo_note([]) == ""
    assert code.wants_photo_in_page("이 사진을 배경으로 써줘") and code.wants_photo_in_page("로고로 넣어줘")
    assert not code.wants_photo_in_page("위클리 만들어줘") and not code.wants_photo_in_page("이 느낌으로 독서기록장")


def test_pinterest_links_and_host_guard():
    import asyncio

    from app import pinterest

    assert pinterest.find_link("이 느낌으로 https://pin.it/3xYz9AbC 해줘") == "https://pin.it/3xYz9AbC"
    assert pinterest.find_link("https://www.pinterest.com/pin/123456789/") == "https://www.pinterest.com/pin/123456789/"
    assert pinterest.find_link("https://kr.pinterest.com/pin/987/") == "https://kr.pinterest.com/pin/987/"
    assert pinterest.find_link("https://example.com/pin/1") is None
    # only Pinterest hosts are fetched, even if a "pin link" check were bypassed
    for bad in ["https://example.com/x", "https://pinterest.com.evil.io/pin/1", "http://169.254.169.254/latest"]:
        try:
            asyncio.run(pinterest.pin_image(bad))
            raise AssertionError(bad)
        except pinterest.PinError:
            pass


def test_guest_first_page_is_free(client, monkeypatch):
    """Onboarding: making the first page doesn't use one of the 5 tries; edits do."""
    import json as _json

    from app import code

    async def fake_run(prompt, html, name=None, page=None, images=None, plus=False, device=None):
        yield _json.dumps({"t": "done", "html": "<!doctype html><html><body>x</body></html>", "summary": "만들었어요"}) + "\n"

    monkeypatch.setattr(code, "available", lambda: True)
    monkeypatch.setattr(code, "run", fake_run)
    g = {"X-Device-Id": "install-free0001"}

    def last(r):
        return _json.loads(r.text.strip().split("\n")[-1])

    for _ in range(2):  # the first page and one retry
        assert last(client.post("/ai/app", json={"prompt": "위클리 만들어줘"}, headers=g))["left"] == 5
    assert last(client.post("/ai/app", json={"prompt": "또 만들어줘"}, headers=g))["left"] == 4  # past the free ones
    assert last(client.post("/ai/app", json={"prompt": "색 바꿔줘", "html": "<html></html>"}, headers=g))["left"] == 3


def test_kakao_web_code_login(client, monkeypatch):
    from app import routes

    seen = {}

    def fake_exchange(code, redirect_uri):
        seen["args"] = (code, redirect_uri)
        return "tok-123"

    monkeypatch.setattr(routes, "kakao_code_to_token", fake_exchange)
    monkeypatch.setattr(routes, "verify_kakao", lambda t: ("kakao-42", "민지") if t == "tok-123" else (_ for _ in ()).throw(Exception()))
    base = routes.get_settings().public_base_url.rstrip("/")
    r = client.post("/auth/kakao/code", json={"code": "abcd1234", "redirect_uri": f"{base}/auth/kakao"})
    assert r.status_code == 200 and r.json()["user"]["name"] == "민지" and r.json()["accessToken"]
    assert seen["args"] == ("abcd1234", f"{base}/auth/kakao")
    # a redirect back to somewhere else is refused
    assert client.post("/auth/kakao/code", json={"code": "abcd1234", "redirect_uri": "https://evil.example/auth/kakao"}).status_code == 400


def test_apple_token_audiences_and_nonce(monkeypatch):
    import time

    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import rsa

    from app import auth

    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    class FakeJwks:
        def get_signing_key_from_jwt(self, _t):
            return type("K", (), {"key": priv.public_key()})()

    monkeypatch.setattr(auth, "_apple_jwks", FakeJwks())

    def token(aud, nonce=None):
        claims = {"iss": auth.APPLE_ISSUER, "aud": aud, "sub": "apple-1", "iat": int(time.time()), "exp": int(time.time()) + 600}
        if nonce:
            claims["nonce"] = nonce
        return pyjwt.encode(claims, priv, algorithm="RS256")

    s = auth.get_settings()
    assert auth.verify_apple(token(s.apple_bundle_id))[0] == "apple-1"  # iPad app
    assert auth.verify_apple(token("web.seyo.kr", "n1"), "n1")[0] == "apple-1"  # web
    for bad in (lambda: auth.verify_apple(token("other.app")), lambda: auth.verify_apple(token("web.seyo.kr", "n1"), "n2")):
        try:
            bad()
            raise AssertionError("should fail")
        except auth.LoginError:
            pass


def test_update_nickname(client):
    from app import auth

    s = auth.get_settings()
    token = client.post("/auth/dev", json={"sub": "nick-1", "name": ""}).json()["accessToken"] if s.dev_login else None
    if not token:
        return
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/me", headers=h).json()["named"] is False
    me = client.patch("/me", json={"name": "  민지  "}, headers=h).json()
    assert me["name"] == "민지" and me["named"] is True
    assert client.patch("/me", json={"name": "   "}, headers=h).status_code == 422


def test_consent_once_per_account(client):
    h = login(client, "consent", "현진")
    assert client.get("/me", headers=h).json()["agreed"] is False
    assert client.patch("/me", json={"agreed": True}, headers=h).json()["agreed"] is True
    # logging in again on another device: the account already agreed
    again = login(client, "consent", "현진")
    assert client.get("/me", headers=again).json()["agreed"] is True


def test_plus_new_pages_use_smart_model_up_to_cap(client, monkeypatch):
    """Plus: new pages on the stronger model until the monthly cap; edits and free users never."""
    import json as _json

    from app import code
    from app.config import get_settings

    seen = []

    async def fake_run(prompt, html, name=None, page=None, images=None, plus=False, device=None):
        seen.append(plus)
        yield _json.dumps({"t": "done", "html": "<!doctype html><html><body>x</body></html>", "summary": "만들었어요"}) + "\n"

    monkeypatch.setattr(code, "available", lambda: True)
    monkeypatch.setattr(code, "run", fake_run)
    monkeypatch.setattr(get_settings(), "plus_smart_creates_per_month", 2)
    h = login(client, "smart", "시현")
    client.post("/ai/app", json={"prompt": "위클리"}, headers=h)
    assert seen == [False]  # free user
    client.post("/billing/dev-plus", headers=h)
    for _ in range(3):
        client.post("/ai/app", json={"prompt": "위클리"}, headers=h)
    client.post("/ai/app", json={"prompt": "색 바꿔줘", "html": "<html></html>"}, headers=h)
    assert seen == [False, True, True, False, False]  # cap of 2, then the free model; edits stay on it
