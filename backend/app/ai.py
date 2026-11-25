"""Page generation ("말로 새 페이지") and edits ("말로 고치기").

Claude picks a *plan* from fixed building blocks (structured output); the server turns the plan
into the app's page JSON. Without ANTHROPIC_API_KEY the same plan shapes come from keyword rules,
so the app keeps working offline and in tests.
"""

import logging
import re
import uuid
from datetime import date, timedelta
from typing import Literal

import anthropic
import openai
from pydantic import BaseModel, Field

from . import vibe
from .config import get_settings

log = logging.getLogger("seyo.ai")

Theme = Literal["butter", "sky", "rose", "clean", "mint"]
Kind = Literal["today3", "roles", "milestones", "wrong", "timetable", "habits", "log"]
LogField = Literal["오늘 기분", "날씨", "한 줄 일기", "사진 한 장", "읽은 책", "감사한 일"]
LOG_FIELDS: list[str] = ["오늘 기분", "날씨", "한 줄 일기", "사진 한 장", "읽은 책", "감사한 일"]


# ───────── plan shapes (what the model is allowed to choose) ─────────


class TodoIn(BaseModel):
    subject: str | None = Field(None, description="과목 또는 사람 이름 (roles일 때 '나', '팀원 1' 등)")
    text: str


class Step(BaseModel):
    key: Literal["top", "body", "photo", "reason", "review", "notes", "week", "next", "widget"]
    text: str = Field(description="만드는 중 화면에 보여 줄 한국어 한 줄, 해요체 아닌 명사형 (예: '문제 사진 칸')")


class PagePlan(BaseModel):
    name: str = Field(description="페이지 이름, 12자 이내 한국어")
    theme: Theme
    kind: Kind
    top_label: str | None = Field(None, description="d-day를 둘 때 그 이름 (예: 중간고사, 중간 발표)")
    top_date: str | None = Field(None, description="d-day 날짜 YYYY-MM-DD, 모르면 null")
    todos: list[TodoIn] = Field(default_factory=list, description="today3/roles/milestones용 최대 5개")
    habits: list[str] = Field(default_factory=list)
    log_fields: list[LogField] = Field(default_factory=list)
    wrong_photo: bool = False
    wrong_reason: bool = False
    wrong_review_days: int | None = None
    side: Literal["timetable", "week", "none"] = "none"
    memo: bool = False
    steps: list[Step]
    follow_ups: list[str] = Field(description="사용자가 눌러서 그대로 보낼 다음 요청 2개. 사용자 말투로 '~해줘'로 끝나는 15자 이내 (예: 아래에 메모 칸 넣어줘, 단원별로 나눠줘). 질문 금지")


class EditPlan(BaseModel):
    change: Literal["theme", "big", "memo", "dim", "side", "name", "add_todo", "none"]
    theme: Theme | None = None
    big: bool | None = None
    memo_on: bool | None = None
    side: Literal["timetable", "week", "none"] | None = None
    name: str | None = None
    todo_text: str | None = None
    message: str | None = Field(None, description="change가 none일 때 사용자에게 보여 줄 짧은 안내 (해요체)")


# ───────── plan → app page JSON ─────────


def _uid(p: str) -> str:
    return f"{p}_{uuid.uuid4().hex[:10]}"


def _dotted(d: date) -> str:
    return f"{d.year}. {d.month}. {d.day}"


def _default_widget(kind: str, has_top: bool) -> dict:
    if kind in ("today3", "roles", "milestones"):
        return {"size": "large", "templates": ["bigNumber", "shortList"] if has_top else ["shortList"]}
    if kind == "habits":
        return {"size": "small", "templates": ["dots"]}
    if kind == "timetable":
        return {"size": "small", "templates": ["nextItem"]}
    return {"size": "small", "templates": ["bigNumber"]}


def plan_to_page(plan: PagePlan, today: date | None = None) -> dict:
    today = today or date.today()
    kind = plan.kind
    if kind == "wrong":
        main = {
            "kind": "wrong",
            "photo": None,
            "reasons": ["계산 실수", "개념 부족", "시간 부족", "문제 잘못 읽음"],
            "reason": None,
            "reviewInDays": plan.wrong_review_days or 3,
            "notes": [],
            "units": None,
            "unit": None,
            "retryCount": None,
            "stats": False,
            "entries": [],
        }
    elif kind == "timetable":
        main = {"kind": "timetable"}
    elif kind == "habits":
        names = [h for h in plan.habits if h.strip()][:5] or ["습관 1"]
        main = {"kind": "habits", "habits": [{"id": _uid("h"), "name": n, "week": [False] * 7} for n in names], "remind": False}
    elif kind == "log":
        fields = [f for f in LOG_FIELDS if f in plan.log_fields] or ["오늘 기분", "한 줄 일기"]
        main = {"kind": "log", "fields": fields, "values": {}, "oneTap": False, "prompt": None, "remind": False}
    else:
        todos = [{"id": _uid("t"), "subject": t.subject, "text": t.text, "done": False} for t in plan.todos[:5]]
        if not todos:
            todos = [{"id": _uid("t"), "text": "", "done": False} for _ in range(3)]
        if kind == "milestones":
            for i, t in enumerate(todos):
                t["due"] = None
            main = {"kind": "milestones", "goal": plan.top_label or plan.name, "todos": todos}
        elif kind == "roles":
            main = {"kind": "roles", "todos": todos}
        else:
            main = {"kind": "today3", "todos": todos, "laterCount": 0}

    top = None
    if plan.top_label and (plan.top_date or kind not in ("habits", "log")):
        try:
            d = date.fromisoformat(plan.top_date) if plan.top_date else today + timedelta(days=14)
        except ValueError:
            d = today + timedelta(days=14)
        top = {"kind": "dday", "label": plan.top_label, "date": _dotted(d)}
    elif kind == "habits":
        top = {"kind": "streak", "label": "이번 주"}
    elif kind == "log":
        top = {"kind": "streak", "label": "연속 기록"}

    side = None if plan.side == "none" else plan.side
    return {
        "id": _uid("page"),
        "name": plan.name[:24],
        "theme": plan.theme,
        "top": top,
        "reason": None,
        "main": main,
        "side": side,
        "memo": "" if plan.memo else None,
        "big": False,
        "dimDone": False,
        "widget": _default_widget(kind, top is not None and top["kind"] == "dday"),
    }


def apply_edit(page: dict, plan: EditPlan) -> tuple[dict | None, str]:
    p = dict(page)
    c = plan.change
    if c == "theme" and plan.theme:
        p["theme"] = plan.theme
    elif c == "big" and plan.big is not None:
        p["big"] = plan.big
    elif c == "memo" and plan.memo_on is not None:
        p["memo"] = (p.get("memo") or "") if plan.memo_on else None
    elif c == "dim":
        p["dimDone"] = True
    elif c == "side" and plan.side:
        p["side"] = None if plan.side == "none" else plan.side
    elif c == "name" and plan.name:
        p["name"] = plan.name[:24]
    elif c == "add_todo" and "todos" in p.get("main", {}):
        main = dict(p["main"])
        main["todos"] = [*main["todos"], {"id": _uid("t"), "text": plan.todo_text or "새 할 일", "done": False}]
        p["main"] = main
    else:
        return None, plan.message or OFFLINE
    return p, c


# ───────── rule-based fallback (mirrors the app's local parser) ─────────

_SUBJECTS = ["수학", "영어", "국어", "과학", "화학", "물리", "생명", "지구과학", "사회", "한국사", "역사"]


def _theme_from(t: str, fallback: Theme) -> Theme:
    for pat, theme in ((r"하늘|파란|파랑|블루|blue", "sky"), (r"핑크|분홍|로즈|pink", "rose"), (r"흰|하얀|하양|화이트|white|깔끔|회색|그레이", "clean"), (r"노란|노랑|버터|옐로|yellow", "butter"), (r"초록|민트|연두|그린|green", "mint")):
        if re.search(pat, t, re.I):
            return theme  # type: ignore[return-value]
    return fallback


def rules_plan(t: str) -> PagePlan:
    w = Step(key="widget", text="홈 위젯 고르기")
    subject = next((s for s in _SUBJECTS if s in t), None)
    if re.search(r"오답|틀린 문제", t):
        days = int(m.group(1)) if (m := re.search(r"(\d+)\s*일\s*(뒤|후)", t)) else 3
        steps = [Step(key="photo", text="문제 사진 칸"), Step(key="reason", text="틀린 이유 고르기"), Step(key="review", text=f"{days}일 뒤 다시 풀기 알림"), Step(key="notes", text="풀이 메모 칸"), w]
        return PagePlan(name=f"{subject + ' ' if subject else ''}오답노트", theme=_theme_from(t, "rose"), kind="wrong", wrong_photo=True, wrong_reason=True, wrong_review_days=days, steps=steps, follow_ups=["단원별로 나눠줘", "다시 푼 횟수 표시"])
    if re.search(r"팀플|팀 프로젝트|동아리|역할", t):
        label = m.group(1) if (m := re.search(r"(발표|공모전|프로젝트|축제|행사|과제)", t)) else "팀플"
        return PagePlan(name=f"{label} 준비", theme=_theme_from(t, "butter"), kind="roles", top_label=label, todos=[TodoIn(subject=s, text="") for s in ("나", "팀원 1", "팀원 2")], steps=[Step(key="top", text=f"{label} d-day"), Step(key="body", text="사람별로 역할 나누기"), w], follow_ups=["아래에 메모 칸 넣어줘", "할 일 추가해줘"])
    if re.search(r"시간표|수업", t):
        return PagePlan(name="시간표", theme=_theme_from(t, "sky"), kind="timetable", steps=[Step(key="body", text="월–금 시간표 칸"), Step(key="next", text="다음 수업 알려 주기"), w], follow_ups=["하늘색으로 바꿔줘", "아래에 메모 칸 넣어줘"])
    if re.search(r"습관|챌린지|매일", t) and not re.search(r"일기|기록|다이어리", t):
        cleaned = re.sub(r"(매일|습관|체크표|체크|만들어\s*줘|만들어|하고 싶어|챌린지)", " ", t)
        names = [s.strip() for s in re.split(r",|랑|이랑|하고|그리고|및|\n", cleaned) if 2 <= len(s.strip()) <= 16][:5] or ["습관 1", "습관 2"]
        return PagePlan(name="습관 체크", theme=_theme_from(t, "mint"), kind="habits", habits=names, side="week", steps=[Step(key="body", text=f"{', '.join(names)} 체크표"), Step(key="week", text="이번 주 한눈에 보기"), w], follow_ups=["초록색으로 바꿔줘", "아래에 메모 칸 넣어줘"])
    if re.search(r"일기|기록|다이어리|다꾸|독서|읽은", t):
        pairs = [(r"기분", "오늘 기분"), (r"날씨", "날씨"), (r"일기|한 줄", "한 줄 일기"), (r"사진", "사진 한 장"), (r"책|독서|읽은", "읽은 책"), (r"감사", "감사한 일")]
        fields = [f for pat, f in pairs if re.search(pat, t)] or ["오늘 기분", "한 줄 일기"]
        name = "독서 기록" if re.search(r"독서|책", t) else "하루 한 장"
        return PagePlan(name=name, theme=_theme_from(t, "butter"), kind="log", log_fields=fields, side="week", steps=[Step(key="body", text=f"{', '.join(fields)} 칸"), Step(key="week", text="이번 주 기록 보기"), w], follow_ups=["하늘색으로 바꿔줘", "아래에 메모 칸 넣어줘"])
    label = m.group(1) if (m := re.search(r"(중간고사|기말고사|수능|모의고사|시험|발표|마감)", t)) else None
    steps = ([Step(key="top", text=f"{label} d-day")] if label else []) + [Step(key="body", text="오늘 할 일 3칸"), w]
    return PagePlan(name=f"{label} 플래너" if label else "할 일", theme=_theme_from(t, "butter"), kind="today3", top_label=label, side="timetable" if re.search(r"시간|타임", t) else "none", steps=steps, follow_ups=["아래에 메모 칸 넣어줘", "d-day 더 크게 보여줘"])


def rules_edit(t: str) -> EditPlan:
    if m := re.search(r"(?:이름|제목)(?:을|를)?\s*[\"'“]?(.+?)[\"'”]?\s*(?:으로|로)\s*(?:바꿔|해|지어)", t):
        return EditPlan(change="name", name=m.group(1).strip())
    for pat, theme in ((r"하늘|파란|파랑|블루|blue", "sky"), (r"핑크|분홍|로즈|pink", "rose"), (r"흰|하얀|하양|화이트|white|깔끔|회색|그레이", "clean"), (r"노란|노랑|버터|옐로|yellow", "butter"), (r"초록|민트|연두|그린|green", "mint")):
        if re.search(pat, t, re.I):
            return EditPlan(change="theme", theme=theme)  # type: ignore[arg-type]
    if re.search(r"작게|줄여", t):
        return EditPlan(change="big", big=False)
    if re.search(r"크게|키워", t):
        return EditPlan(change="big", big=True)
    if re.search(r"메모", t):
        return EditPlan(change="memo", memo_on=not re.search(r"빼|없애|지워", t))
    if re.search(r"시간표|타임\s?테이블", t, re.I):
        return EditPlan(change="side", side="none" if re.search(r"빼|없애|지워|숨겨", t) else "timetable")
    if re.search(r"(끝난|완료|한 일|다 한).*(흐리|지워|숨|빼)|흐리게", t):
        return EditPlan(change="dim")
    if re.search(r"(할 일|투두).*(추가|넣어)", t):
        q = re.search(r"[\"'“](.+?)[\"'”]", t)
        return EditPlan(change="add_todo", todo_text=q.group(1) if q else None)
    return EditPlan(change="none")


# ───────── Claude ─────────

_GEN_SYSTEM = """너는 학생용 아이패드 앱 seyo의 페이지 설계자야. 사용자가 한국어로 말한 요청을 보고, 앱이 가진 고정 블록 중 하나(kind)와 그 내용을 고른다.
- kind: today3(오늘 할 일), roles(팀원별 역할), milestones(목표까지 중간 마감), wrong(오답노트), timetable(시간표), habits(습관 체크표), log(하루 기록).
- 시험, 발표, 마감처럼 날짜가 있는 일이 나오면 kind와 상관없이 top_label과 top_date를 채운다 (예: 12월 10일 → 올해 또는 다음 해의 그 날짜).
- 매일 할 공부나 할 일 목록은 habits보다 today3(또는 마감까지 나눠 하면 milestones)가 맞다. habits는 매일 반복하는 습관(물 마시기, 운동)에만.
- 요청에 없는 기능을 지어내지 말고, 모르는 날짜는 null로 둔다.
- steps는 실제로 만든 칸 순서대로, 마지막은 key=widget. 만들지 않은 칸(memo가 false인데 메모 칸, top_label이 없는데 시험 날짜)은 넣지 않는다.
- 모든 문구는 짧은 한국어. 이모지, 중간점(·), 대시(—) 쓰지 않기."""

_EDIT_SYSTEM = """너는 seyo 페이지 편집기야. 사용자의 한 문장을 보고 아래 중 하나의 변경만 고른다.
theme(색), big(d-day 크기), memo(메모 칸 켜고 끄기), dim(끝난 일 흐리게), side(시간표 칸), name(이름), add_todo(할 일 추가).
할 수 없는 요청이면 change=none과 짧은 해요체 안내 message를 준다."""


def provider() -> str:
    s = get_settings()
    if s.ai_provider != "auto":
        return s.ai_provider
    return "openai" if s.openai_api_key else "anthropic" if s.anthropic_api_key else "rules"


async def _parse(system: str, user: str, schema: type[BaseModel], small: bool = False) -> BaseModel | None:
    """small=True uses the cheaper edit models (말로 고치기)."""
    p = provider()
    s = get_settings()
    if p == "openai" and s.openai_api_key:
        if small:
            return await _parse_openai(system, user, schema, s.openai_edit_model, s.openai_edit_reasoning)
        return await _parse_openai(system, user, schema)
    if p == "anthropic" and s.anthropic_api_key:
        return await _parse_claude(system, user, schema, s.claude_edit_model if small else None)
    return None


_clients: dict[str, object] = {}

# Set while the model provider is failing (no credits, key revoked, outage). Then the rules still
# do the basics, but anything else gets an honest "AI is down" instead of a fake "can't do that".
AI_DOWN: dict[str, str] = {}
OFFLINE = "AI 서버에 연결이 안 되고 있어요. 잠시 후 다시 해 주세요"


def _down(provider: str, e: Exception) -> None:
    msg = str(getattr(e, "message", e))
    AI_DOWN[provider] = msg
    if "credit" in msg.lower() or "quota" in msg.lower() or "billing" in msg.lower():
        log.critical("%s: OUT OF CREDITS — every AI request falls back to rules until billing is fixed: %s", provider, msg)
    else:
        log.error("%s unavailable: %s", provider, msg)


def _openai() -> openai.AsyncOpenAI:
    if "openai" not in _clients:
        _clients["openai"] = openai.AsyncOpenAI(api_key=get_settings().openai_api_key, base_url=get_settings().openai_base_url or None, timeout=30)
    return _clients["openai"]  # type: ignore[return-value]


def _claude() -> anthropic.AsyncAnthropic:
    if "anthropic" not in _clients:
        _clients["anthropic"] = anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    return _clients["anthropic"]  # type: ignore[return-value]


async def _parse_openai(system: str, user: str, schema: type[BaseModel], model: str | None = None, reasoning: str | None = None) -> BaseModel | None:
    s = get_settings()
    client = _openai()
    try:
        resp = await client.responses.parse(
            model=model or s.openai_model,
            instructions=system,
            input=user,
            text_format=schema,
            reasoning={"effort": reasoning or s.openai_reasoning},
            max_output_tokens=8000,
        )
    except openai.RateLimitError as e:
        _down("openai", e)
        return None
    except openai.APIStatusError as e:
        _down("openai", e)
        return None
    except openai.APIConnectionError as e:
        _down("openai", e)
        return None
    except (openai.LengthFinishReasonError, openai.ContentFilterFinishReasonError) as e:
        log.warning("openai unusable (%s); using rules", type(e).__name__)
        return None
    AI_DOWN.clear()
    return resp.output_parsed


async def _parse_claude(system: str, user: str, schema: type[BaseModel], model: str | None = None) -> BaseModel | None:
    s = get_settings()
    client = _claude()
    try:
        # Server-side fallbacks re-run a policy-declined request on another model in the same call.
        resp = await client.beta.messages.parse(
            model=model or s.claude_model,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
            output_config={"effort": s.claude_effort},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.RateLimitError:
        log.warning("claude rate limited; using rules")
        return None
    except anthropic.APIStatusError as e:
        log.error("claude error %s: %s", e.status_code, e.message)
        return None
    except anthropic.APIConnectionError:
        log.warning("claude unreachable; using rules")
        return None
    if resp.stop_reason == "refusal" or resp.parsed_output is None:
        return None
    return resp.parsed_output


async def generate(prompt: str) -> tuple[dict, list[dict], list[str], str]:
    plan = await _parse(_GEN_SYSTEM, f"오늘 날짜: {date.today().isoformat()}\n요청: {prompt}", PagePlan)
    source = provider()
    if not isinstance(plan, PagePlan):
        plan, source = rules_plan(prompt), "rules"
    page = plan_to_page(plan)
    return page, _real_steps(page, plan.steps), plan.follow_ups[:3], source


def _real_steps(page: dict, steps: list[Step]) -> list[dict]:
    """Keep only steps for sections the page really has (the model sometimes lists ones it didn't make)."""
    kind = page["main"]["kind"]
    has = {
        "top": page.get("top") is not None,
        "week": page.get("side") == "week",
        "notes": kind == "wrong" or page.get("memo") is not None,
        "photo": kind == "wrong",
        "reason": kind == "wrong",
        "review": kind == "wrong",
        "next": kind == "timetable",
    }
    out = [s.model_dump() for s in steps if s.key != "widget" and has.get(s.key, True)]
    if not any(s["key"] == "body" for s in out) and kind != "wrong":
        out.append({"key": "body", "text": "본문 칸"})
    return out + [{"key": "widget", "text": next((s.text for s in steps if s.key == "widget"), "홈 위젯 고르기")}]


async def edit(page: dict, command: str) -> dict:
    """말로 고치기. The model edits any part of the page via ops (see vibe.py); without a model,
    or when the model call fails, the fixed rule menu keeps the basics working.

    Returns {"page", "change", "changed", "message", "source"}; page is None when nothing changed.
    "escalate": True means the blocks can't do it — the app rebuilds the page as a code app.
    """
    user, bag = vibe.prompt_for(page, command)
    plan = await _parse(vibe.SYSTEM, user, vibe.EditOps, small=True)
    if isinstance(plan, vibe.EditOps) and plan.ops and vibe.check(page, plan, bag)[0] is None:
        # one retry with the validation error: cheap, and fixes most slips (null booleans, bad paths)
        err = vibe.check(page, plan, bag)[1]
        retry = f"{user}\n\n직전 답의 ops:\n{plan.model_dump_json()}\n\n이 ops는 적용하면 아래 오류가 나요. 고쳐서 다시 주세요.\n{err}"
        again = await _parse(vibe.SYSTEM, retry, vibe.EditOps, small=True)
        plan = again if isinstance(again, vibe.EditOps) else plan
    if isinstance(plan, vibe.EditOps):
        new, changed, text = vibe.result_page(page, plan, bag)
        if new is not None:
            return {"page": new, "change": vibe.highlight_for(changed), "changed": changed, "message": text, "source": provider()}
        # The fixed blocks can't express it: the app turns this page into a code app (/ai/app with
        # `page`) that keeps its content and does what was asked. Nothing is refused.
        return {"page": None, "change": None, "changed": [], "message": "", "escalate": True, "source": provider()}
    # no model or model error → fixed rules
    rplan = rules_edit(command)
    new, change = apply_edit(page, rplan)
    if new is None:
        return {"page": None, "change": None, "changed": [], "message": OFFLINE, "source": "rules"}
    key = {"dim": "dimDone"}.get(change, "main" if change == "add_todo" else change)
    return {"page": new, "change": "main" if change == "add_todo" else change, "changed": [key], "message": "바뀌었어요", "source": "rules"}
