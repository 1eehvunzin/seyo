"""말로 고치기 (free-form): the model edits any part of the page, not just a fixed menu.

The model never rewrites the whole page. It returns a short list of JSON ops (set / insert /
remove at a dotted path). The server applies them to a copy, fills in ids, and validates the
result against the same shape the app renders (PageDoc). Anything that doesn't validate is
rejected, so a bad answer can't break the page. Ops keep the user's data (checks, notes, photos)
untouched unless the request is about it, and they cost far fewer output tokens than a full page.
"""

import copy
import json
import logging
import uuid
from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

log = logging.getLogger("seyo.vibe")

# ───────── the page shape the app renders (mirrors frontend/src/lib/page.ts) ─────────

Theme = Literal["butter", "sky", "rose", "clean", "mint"]
LogField = Literal["오늘 기분", "날씨", "한 줄 일기", "사진 한 장", "읽은 책", "감사한 일"]
WidgetTpl = Literal["bigNumber", "shortList", "dots", "nextItem", "fallback"]

Short = Annotated[str, Field(max_length=200)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def _null_means_default(cls, data: Any) -> Any:
        """Models often send null for "leave as is" (remind: null). Use the field's default."""
        if isinstance(data, dict):
            for name, f in cls.model_fields.items():
                if name in data and data[name] is None and not f.is_required() and f.default is not None:
                    data = {k: v for k, v in data.items() if k != name}
        return data


class Todo(_Strict):
    id: str
    subject: Annotated[str, Field(max_length=24)] | None = None
    text: Short
    done: bool
    reviews: list[bool] | None = None
    due: float | None = None


class DDay(_Strict):
    kind: Literal["dday"]
    label: Annotated[str, Field(max_length=24)]
    date: Annotated[str, Field(max_length=24)]


class Streak(_Strict):
    kind: Literal["streak"]
    label: Annotated[str, Field(max_length=24)]


Todos = Annotated[list[Todo], Field(max_length=12)]


class Today3(_Strict):
    kind: Literal["today3"]
    todos: Todos
    laterCount: int = 0


class Portion(_Strict):
    kind: Literal["portion"]
    todos: Todos
    daysLeft: int


class Focus(_Strict):
    kind: Literal["focus"]
    todos: Todos
    blocksDone: int = 0


class Review(_Strict):
    kind: Literal["review"]
    todos: Todos


class Roles(_Strict):
    kind: Literal["roles"]
    todos: Todos


class Milestones(_Strict):
    kind: Literal["milestones"]
    todos: Todos
    goal: Annotated[str, Field(max_length=40)]


class Log(_Strict):
    kind: Literal["log"]
    fields: Annotated[list[LogField], Field(min_length=1, max_length=6)]
    values: dict[LogField, str] = {}
    oneTap: bool = False
    prompt: Short | None = None
    remind: bool = False


class Habit(_Strict):
    id: str
    name: Annotated[str, Field(max_length=24)]
    week: Annotated[list[bool], Field(min_length=7, max_length=7)]


class Habits(_Strict):
    kind: Literal["habits"]
    habits: Annotated[list[Habit], Field(min_length=1, max_length=8)]
    remind: bool = False


class Entry(_Strict):
    id: str
    reason: str | None = None
    unit: str | None = None
    reviewAt: float


class Wrong(_Strict):
    kind: Literal["wrong"]
    photo: str | None = None
    reasons: Annotated[list[Annotated[str, Field(max_length=24)]], Field(max_length=8)]
    reason: str | None = None
    reviewInDays: Annotated[int, Field(ge=1, le=60)]
    notes: list[Short] = []
    units: Annotated[list[Annotated[str, Field(max_length=24)]], Field(max_length=12)] | None = None
    unit: str | None = None
    retryCount: int | None = None
    stats: bool = False
    entries: list[Entry] = []


class Timetable(_Strict):
    kind: Literal["timetable"]


Main = Annotated[Today3 | Portion | Focus | Review | Roles | Milestones | Log | Habits | Wrong | Timetable, Field(discriminator="kind")]


class Widget(_Strict):
    size: Literal["small", "large"]
    templates: Annotated[list[WidgetTpl], Field(min_length=1, max_length=2)]


class PageDoc(BaseModel):
    """Editable part of a page. Sharing/bookkeeping fields pass through untouched (extra=allow)."""

    model_config = ConfigDict(extra="allow")

    name: Annotated[str, Field(min_length=1, max_length=24)]
    theme: Theme
    top: Annotated[DDay | Streak, Field(discriminator="kind")] | None = None
    reason: Short | None = None
    main: Main
    side: Literal["timetable", "week"] | None = None
    memo: Annotated[str, Field(max_length=2000)] | None = None
    big: bool = False
    dimDone: bool = False
    widget: Widget

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


# Paths the model may never touch.
PROTECTED = {"id", "owner", "members", "inviteToken", "createdAt", "updatedAt", "version"}

# Top-level key → the app's highlight ring (Change in page.ts).
HIGHLIGHT = {"name": "name", "theme": "theme", "top": "big", "big": "big", "memo": "memo", "dimDone": "dim", "side": "side", "main": "main"}


# ───────── what the model returns ─────────


class Op(BaseModel):
    op: Literal["set", "insert", "remove"]
    path: str = Field(description="점으로 이은 경로. 리스트는 0부터 세는 번호. 예: main.todos.1.text, theme, top")
    value: str | None = Field(description="set/insert에 넣을 값을 JSON 문자열로 (예: \"\\\"sky\\\"\", \"true\", \"{...}\"). remove면 null")


class EditOps(BaseModel):
    ops: list[Op] = Field(description="요청을 이루는 최소한의 변경. 이 구조로 다 표현할 수 없으면 빈 리스트 (그러면 페이지를 코드 앱으로 다시 만든다)")
    summary: str = Field(description="바꾼 것을 '~했어요'로 끝나는 한 문장, 25자 이내 (예: 할 일 2개를 더 넣었어요)")
    message: str | None = Field(description="항상 null")


SYSTEM = """너는 학생용 아이패드 플래너 앱 seyo의 페이지 편집기야. 사용자가 한국어로 말하면 현재 페이지 JSON을 고치는 ops 목록을 만든다.

# 페이지 구조
- name: 페이지 이름 (24자 이내)
- theme: butter | sky | rose | clean | mint (노랑 | 하늘 | 분홍 | 흰색 | 초록)
- top: 맨 위 숫자. {"kind":"dday","label":"중간고사","date":"2026. 12. 1"} 또는 {"kind":"streak","label":"연속 기록"} 또는 null
- big: top 숫자를 크게 (true/false)
- reason: 페이지 위 한 줄 설명 또는 null
- side: 오른쪽 칸. "timetable"(시간표) | "week"(이번 주) | null
- memo: 메모 칸 내용 문자열, null이면 메모 칸 없음 (켜려면 "")
- dimDone: 끝난 할 일 흐리게
- widget: 홈 위젯 {"size":"small"|"large","templates":[...1~2개]} 템플릿: bigNumber, shortList, dots, nextItem, fallback
- main: 본문. kind별 모양:
  - today3 {todos, laterCount}: 오늘 할 일
  - portion {todos, daysLeft}: 남은 날로 나눈 오늘 분량
  - focus {todos, blocksDone}: 25분 집중 블록
  - review {todos}: 1,3,7일 복습 (todo.reviews: [bool,bool,bool])
  - roles {todos}: 사람별 역할 (todo.subject = 사람)
  - milestones {todos, goal}: 목표까지 중간 마감 (todo.due = 그날 0시 ms 또는 null)
  - log {fields, values, oneTap, prompt, remind}: 하루 기록. fields는 "오늘 기분","날씨","한 줄 일기","사진 한 장","읽은 책","감사한 일" 중에서만
  - habits {habits:[{id,name,week:[7개 bool]}], remind}: 습관 체크
  - wrong {photo, reasons, reason, reviewInDays, notes, units, unit, retryCount, stats, entries}: 오답노트
  - timetable {}: 시간표
- todo: {"id","subject"(과목/사람, 없으면 생략),"text","done"}

# ops
- set: path 자리에 value를 넣는다 (없으면 만든다). 리스트 통째로, main 통째로 바꿔도 된다.
- insert: path는 리스트 안의 자리 (예: main.todos.3). 끝에 붙이려면 main.todos.-
- remove: path 자리를 지운다. 여러 개를 지울 땐 뒤쪽 번호부터.
- value는 JSON 문자열. 새 todo/habit의 id는 "" 로 두면 서버가 채운다.
- kind를 바꿀 땐 main 전체를 set 하고, 기존 할 일 내용은 최대한 옮긴다.

# 규칙
- 요청한 것만 바꾼다. 사용자가 이미 적은 내용, 체크, 사진, 기록은 요청이 없으면 건드리지 않는다.
- id, owner, members, inviteToken, createdAt, updatedAt는 절대 건드리지 않는다.
- 값을 비울 땐 null 대신 그 자리의 기본값을 쓴다 (bool은 false, 리스트는 []). memo, side, top만 null이 "끄기"다.
- 페이지 안 문구는 짧은 한국어. 이모지, 중간점(·), 대시(—) 쓰지 않기.
- 요청이 애매하면 가장 그럴듯한 쪽으로 바꾼다. 되묻지 않는다.
- 이 구조로 요청을 전부 표현할 수 없으면(새 종류의 칸, 그래프, 그림, 게임, 애니메이션, 새 기능) 일부만 흉내 내지 말고 ops를 비운다. 그러면 페이지가 코드 앱으로 다시 만들어져 요청이 그대로 반영된다.
- 날짜는 "YYYY. M. D" 형식. 오늘 날짜를 기준으로 계산한다.

# summary, message 말투 (사용자에게 그대로 보여요)
- 학생에게 말하듯 '~했어요', '~요'로 끝나는 한 문장. 줄바꿈, 목록, 영어, JSON 이름(main, kind, todos 같은 것) 쓰지 않기.
- summary 예: "할 일 2개를 더 넣었어요", "시험 날짜를 12월 10일로 옮겼어요", "습관 체크표로 바꿨어요"
- message 예: "캐릭터 키우기 화면은 아직 없어요. 습관 체크표로 매일 쌓아 가는 건 어때요?\""""


def _one_line(s: str | None, limit: int) -> str | None:
    if not s:
        return s
    line = s.strip().splitlines()[0].strip(" •-")
    return line if len(line) <= limit else line[: limit - 1].rstrip() + "…"


# ───────── applying ops ─────────


class OpError(ValueError):
    pass


def _seg(s: str) -> str | int:
    return int(s) if s.lstrip("-").isdigit() else s


def _walk(doc: Any, parts: list[str | int]) -> Any:
    cur = doc
    for p in parts:
        if isinstance(cur, dict) and isinstance(p, str) and p in cur:
            cur = cur[p]
        elif isinstance(cur, list) and isinstance(p, int) and -len(cur) <= p < len(cur):
            cur = cur[p]
        else:
            raise OpError(f"no such path: {p}")
    return cur


def apply_ops(page: dict, ops: list[Op]) -> dict:
    doc = copy.deepcopy(page)
    for o in ops:
        raw = [x for x in o.path.strip().strip(".").split(".") if x != ""]
        if not raw:
            raise OpError("empty path")
        if raw[0] in PROTECTED:
            raise OpError(f"protected: {raw[0]}")
        parts = [_seg(x) for x in raw]
        parent = _walk(doc, parts[:-1])
        last = parts[-1]
        if o.op == "remove":
            if isinstance(parent, list) and isinstance(last, int) and -len(parent) <= last < len(parent):
                parent.pop(last)
            elif isinstance(parent, dict) and isinstance(last, str) and last in parent:
                # optional sections are "off" when null, not missing
                parent[last] = None
            else:
                raise OpError(f"cannot remove {o.path}")
            continue
        try:
            value = json.loads(o.value) if o.value is not None else None
        except json.JSONDecodeError as e:
            raise OpError(f"bad value at {o.path}") from e
        if o.op == "insert":
            if not isinstance(parent, list):
                raise OpError(f"insert target is not a list: {o.path}")
            idx = len(parent) if last == "-" else last
            if not isinstance(idx, int):
                raise OpError(f"bad index: {o.path}")
            parent.insert(max(0, min(idx, len(parent))), value)
        else:  # set
            if isinstance(parent, dict) and isinstance(last, str):
                parent[last] = value
            elif isinstance(parent, list) and isinstance(last, int) and -len(parent) <= last < len(parent):
                parent[last] = value
            elif isinstance(parent, list) and last == "-":
                parent.append(value)
            else:
                raise OpError(f"cannot set {o.path}")
    return doc


def _fill_ids(doc: dict) -> None:
    main = doc.get("main")
    if not isinstance(main, dict):
        return
    for key, prefix in (("todos", "t"), ("habits", "h"), ("entries", "e")):
        for item in main.get(key) or []:
            if isinstance(item, dict) and not item.get("id"):
                item["id"] = f"{prefix}_{uuid.uuid4().hex[:10]}"
    for h in main.get("habits") or []:
        if isinstance(h, dict) and isinstance(h.get("week"), list):
            h["week"] = (h["week"] + [False] * 7)[:7]
        elif isinstance(h, dict):
            h["week"] = [False] * 7
    for t in main.get("todos") or []:
        if isinstance(t, dict):
            t.setdefault("done", False)
            t.setdefault("text", "")
            if t.get("subject") in ("", None):
                t.pop("subject", None)


# Big blobs (photos as data URIs) never go to the model: swapped for a token, restored after.
def _stash(doc: Any, bag: list[str]) -> Any:
    if isinstance(doc, dict):
        return {k: _stash(v, bag) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_stash(v, bag) for v in doc]
    if isinstance(doc, str) and (len(doc) > 400 or doc.startswith(("data:", "file:", "blob:", "content:", "ph:"))):
        bag.append(doc)
        return f"@keep{len(bag) - 1}"
    return doc


def _unstash(doc: Any, bag: list[str]) -> Any:
    if isinstance(doc, dict):
        return {k: _unstash(v, bag) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_unstash(v, bag) for v in doc]
    if isinstance(doc, str) and doc.startswith("@keep") and doc[5:].isdigit() and int(doc[5:]) < len(bag):
        return bag[int(doc[5:])]
    return doc


def prompt_for(page: dict, command: str, today: date | None = None) -> tuple[str, list[str]]:
    bag: list[str] = []
    visible = _stash({k: v for k, v in page.items() if k not in PROTECTED}, bag)
    text = f"오늘 날짜: {(today or date.today()).isoformat()}\n현재 페이지:\n{json.dumps(visible, ensure_ascii=False)}\n\n요청: {command}"
    return text, bag


BROKEN = "그렇게 바꾸면 페이지가 깨져서 멈췄어요. 조금 다르게 말해 볼래요?"


def check(page: dict, plan: EditOps, bag: list[str]) -> tuple[dict | None, str | None]:
    """Apply + validate. Returns (validated doc, None) or (None, error text for a retry)."""
    try:
        doc = apply_ops(page, plan.ops)
        doc = _unstash(doc, bag)
        _fill_ids(doc)
        return PageDoc.model_validate(doc).model_dump(mode="json", exclude_unset=True), None
    except (OpError, ValidationError) as e:
        log.info("vibe edit rejected: %s", e)
        return None, str(e)[:800]


def result_page(page: dict, plan: EditOps, bag: list[str]) -> tuple[dict | None, list[str], str]:
    """Apply the model's ops. Returns (new page or None, changed top-level keys, user-facing text)."""
    if not plan.ops:
        return None, [], _one_line(plan.message, 80) or "이 페이지에서는 그렇게 바꾸기 어려워요. 다르게 말해 볼래요?"
    new, err = check(page, plan, bag)
    if new is None:
        return None, [], BROKEN
    changed = [k for k in new if k not in PROTECTED and new.get(k) != page.get(k)]
    if not changed:
        return None, [], _one_line(plan.message, 80) or "바뀐 게 없어요. 조금 더 구체적으로 말해 볼래요?"
    return new, changed, _one_line(plan.summary, 40) or "바뀌었어요"


def highlight_for(changed: list[str]) -> str | None:
    order = ["main", "top", "big", "memo", "side", "dimDone", "theme", "name"]
    for k in order:
        if k in changed:
            return HIGHLIGHT[k]
    return None
