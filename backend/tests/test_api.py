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
    e = client.post("/ai/edit", json={"page": r["page"], "command": "주말 칸도 만들어줘"}, headers=h).json()
    assert e["page"] is None and e["message"]


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
