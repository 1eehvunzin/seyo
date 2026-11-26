"""바이브 코딩: the model writes a real single-file HTML/JS app that runs inside a page.

- New app: the model streams a whole HTML file. The app shows it while it's being written.
- Edit: the model streams only SEARCH/REPLACE blocks (much shorter than a rewrite, so faster).
  If a block doesn't match the file, the model is asked once for the whole file instead.
- Quality floor: skills/*.md (core always + matching topic skills) go into the prompt, the app
  side injects the design kit CSS, and lint() checks the result; anything it catches gets one
  automatic repair pass. No second model "grades" the result: quality is measured offline with
  evals/ (screenshots + smoke test, reviewed by a person), not paid for on every request.
- Tokens: the system prompt is the same for every request of a mode (core skill + output rules),
  so the provider's prompt cache covers it; topic skills ride in the user message. A SEARCH that
  doesn't match is retried as blocks once before falling back to a full rewrite (output tokens
  are the expensive part). usage() reports what a run spent.
- The app runs sandboxed (iframe sandbox / WebView) with a CSP that blocks all network, so it
  can't load outside scripts or send data anywhere. It keeps its data with `seyo.save(state)`.

The stream to the app is NDJSON, one event per line:
  {"t":"skills","names":[...]}  topic skills (skills/*.md) picked for this request
  {"t":"code","d":"..."}       a piece of the model's output (HTML while creating, blocks while editing)
  {"t":"restart"}              edit blocks didn't match; a full rewrite streams next
  {"t":"fixing","issues":[...]} the quality check found problems; one repair pass runs
  {"t":"done","html":"...","summary":"...","left":n,"usage":{calls,input,cached,output}}
  {"t":"error","message":"..."}
"""

import contextvars
import hashlib
import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import anthropic
import openai

from .config import get_settings

log = logging.getLogger("seyo.code")

MAX_HTML = 120_000

# ───────── skills: markdown guides that set the quality floor ─────────
# backend/app/skills/*.md. core.md always goes in; topic skills are picked by keywords in the
# request (and the app's title when editing), at most two. Picking is local: no extra model call.


@dataclass(frozen=True)
class Skill:
    name: str
    keywords: tuple[str, ...]
    always: bool
    body: str


SKILLS_DIR = Path(__file__).parent / "skills"


@lru_cache
def load_skills() -> tuple[Skill, ...]:
    out = []
    for f in sorted(SKILLS_DIR.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        meta: dict[str, str] = {}
        body = text
        if text.startswith("---"):
            head, body = text[3:].split("---", 1)
            for line in head.strip().splitlines():
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        kws = tuple(k.strip() for k in meta.get("keywords", "").strip("[]").split(",") if k.strip())
        out.append(Skill(meta.get("name", f.stem), kws, meta.get("always") == "true", body.strip()))
    return tuple(out)


def pick_skills(text: str, limit: int = 3) -> list[Skill]:
    t = text.lower()
    skills = load_skills()
    scored = sorted(((sum(t.count(k.lower()) for k in s.keywords), s) for s in skills if not s.always), key=lambda x: -x[0])
    return [s for s in skills if s.always] + [s for n, s in scored[:limit] if n > 0]


def _core() -> str:
    return "\n\n".join(s.body for s in load_skills() if s.always)


def _topics(skills: list[Skill]) -> str:
    """Topic skills for this request: sent in the user message so the system prompt stays cacheable."""
    t = [s.body for s in skills if not s.always]
    return ("# 이번 요청에 맞는 추가 스킬\n\n" + "\n\n".join(t) + "\n\n---\n\n") if t else ""


@lru_cache
def create_system() -> str:
    return f"""너는 seyo의 바이브 코딩 엔진이야. 사용자가 한국어로 말한 것을 실제로 동작하는 HTML 앱 한 파일로 만든다. 무엇이든 만들 수 있지만, 아래 스킬과 (있으면) 사용자 메시지 앞의 추가 스킬을 반드시 따른다.

{_core()}

# 출력
- 첫 줄: <!-- 요약: 만든 것을 '~만들었어요'로 끝나는 한 문장, 30자 이내 -->
- 그 다음 바로 <!doctype html>로 시작하는 완성된 HTML. <title>에는 12자 이내 페이지 이름.
- 코드 펜스(```)나 설명 없이 HTML만."""


@lru_cache
def rewrite_system() -> str:
    """Full rewrite of an existing app (the last resort when edit blocks don't apply): same
    design, same data, only the asked change."""
    return create_system().replace("만든 것을 '~만들었어요'", "바꾼 것을 '~했어요'") + """
- 지금 파일을 고쳐 쓰는 것이다. 디자인(색, 배치, 클래스, 문구), 기능, seyo.state 구조를 그대로 두고 요청한 부분만 바꾼다. 처음부터 새로 디자인하지 않는다."""


@lru_cache
def edit_system() -> str:
    return f"""너는 seyo의 바이브 코딩 엔진이야. 이미 있는 HTML 앱을 사용자의 한국어 요청대로 고친다. 아래 스킬과 (있으면) 사용자 메시지 앞의 추가 스킬을 따른다.

{_core()}

# 출력 (바꿀 부분만)
- 첫 줄: 바꾼 것을 '~했어요'로 끝나는 한 문장, 30자 이내.
- 그 다음 할 일 목록 (최대 6줄): 요청을 기능 단위로 쪼개 '- '로 시작하는 줄로 쓴다. 한 줄은 `사용자에게 보이는 말 :: 고칠 곳 메모` 두 부분이다.
  - 앞부분은 사용자 화면에 그대로 뜬다. 코딩을 모르는 학생이 읽는 말로, 20자 안팎 '~ 넣기/바꾸기/만들기'. 마크업, CSS, 상태, render, 이벤트 같은 개발 용어 금지.
  - `::` 뒤는 너만 보는 메모: 고쳐야 하는 곳(마크업, CSS, 상태, render, 이벤트, 타이머)을 짧게.
  예) - 문제마다 10초 제한 걸기 :: 마크업 바, 시작 시각 저장, 250ms마다 줄이기, 0초면 오답
- 그 다음 목록의 모든 항목을 실제로 구현하는 블록들 (반드시 1개 이상. 목록만 쓰고 끝내면 아무것도 바뀌지 않는다). 화면에 보이기만 하고 동작하지 않는 반쪽 구현 금지.
- 바꿀 곳마다 아래 블록. SEARCH는 지금 파일에 글자 하나 안 틀리고 그대로 있는 연속된 줄 (들여쓰기 포함, 앞뒤를 구분할 수 있을 만큼만 짧게, 보통 1~4줄). 바뀌지 않는 긴 코드를 다시 쓰지 않는다.

<<<<<<< SEARCH
지금 코드
=======
바꿀 코드
>>>>>>> REPLACE

- 블록 안에 <<<<<<<, =======, >>>>>>> 줄을 다시 쓰지 않는다. 블록끼리 겹치지 않게. 코드 펜스 금지. diff 형식(*** Begin Patch, 줄 앞 + / -)도 금지: REPLACE에는 파일에 들어갈 코드 그대로만.
- 지금 페이지의 디자인(색, 배치, 글꼴 크기, 클래스, 문구 톤)이 사용자가 이미 받아 본 디자인이다. 요청한 부분만 바꾸고, 새로 넣는 것도 지금 디자인과 같은 말투·간격·색으로 맞춘다. 디자인을 바꾸라는 요청일 때만 디자인을 바꾼다.
- 지금 있는 내용(문구, 항목, 안내 줄, 데이터)은 지우거나 다른 내용으로 덮어쓰지 않는다. 새로 보여줄 것은 새 요소로 추가한다 ("위에 크게"면 위쪽에 새 큰 숫자).
- 사용자가 저장한 데이터 구조(seyo.state)는 요청이 없으면 바꾸지 않는다. 바꿔야 하면 예전 모양도 읽을 수 있게.
- 거절하지 않는다. 막힌 것(인터넷, 카메라, 알림, 소리)이 필요한 요청도 앱 안에서 최대한 가깝게 구현한다 (예: 검색 대신 직접 입력, 알림 대신 화면 안 배너). 사진은 seyo.photo / seyo.onPhotoPaste로 실제로 넣는다.."""


# ───────── quality check: catches what the skills say never to do ─────────

_EXTERNAL = re.compile(r"""(?:src|href)\s*=\s*["']?\s*(?:https?:)?//|@import\s+url|\bfetch\s*\(|XMLHttpRequest|<script[^>]+src=""", re.I)
_DIALOG = re.compile(r"(?<![\w.$])(?:window\.)?(?:alert|confirm|prompt)\s*\(")
_DIALOG_DEF = re.compile(r"function\s+(?:alert|confirm|prompt)\s*\(")


def lint(html: str) -> list[str]:
    """Problems that break the app or lose data. Each is a sentence the repair pass gets as-is."""
    low = html.lower()
    flat = low.replace(" ", "")
    issues = []
    if "</html>" not in low:
        issues.append("파일이 중간에 끊겼어요. </html>까지 완성해야 해요.")
    if _PATCH.search(html) or re.search(r"^@@", html, re.M) or len(re.findall(r"^\+ {2,}\S", html, re.M)) >= 3:
        issues.append("코드 안에 diff 흔적(*** Begin/End Patch, 줄 앞 +/-)이 남아 있어서 스크립트가 멈춰요. 지우고 실제 코드만 남겨야 해요.")
    if _MARK.search(html):
        issues.append("코드 안에 <<<<<<< / ======= / >>>>>>> 줄이 남아 있어서 스크립트가 멈춰요. 지워야 해요.")
    if _EXTERNAL.search(html):
        issues.append("외부 주소(CDN, 웹폰트, 외부 이미지, fetch)를 쓰고 있어요. 인터넷이 막혀 있으니 인라인 코드와 SVG로 바꿔야 해요.")
    if _DIALOG.search(_DIALOG_DEF.sub("", html)):
        issues.append("alert/confirm/prompt를 쓰고 있어요. 막혀 있으니 화면 안에 직접 그려야 해요.")
    interactive = re.search(r"<(?:input|textarea|select)\b|addEventListener\(|onclick", html, re.I)
    if interactive and "seyo.save" not in html and "localStorage" not in html:
        issues.append("seyo.save를 부르지 않아서 페이지를 닫으면 데이터가 사라져요. 상태가 바뀔 때마다 seyo.save(S)를 불러야 해요.")
    if "seyo.save" in html and "seyo.state" not in html:
        issues.append("저장은 하는데 열 때 seyo.state를 읽지 않아요. 시작할 때 Object.assign(기본값, seyo.state)로 읽어야 해요.")
    used = set(re.findall(r"""(?:getElementById\(\s*['"]|(?:querySelector(?:All)?|\$\$?)\(\s*['"`]#)([\w-]+)""", html))
    defined = set(re.findall(r"""\bid\s*=\s*["']?([\w-]+)""", html))
    missing = sorted(used - defined)
    if missing:
        issues.append(f"스크립트가 찾는 요소가 HTML에 없어요: {', '.join('#' + m for m in missing[:6])}. 그대로면 null 오류로 화면이 멈춰요.")
    if "toisostring().slice(0,10)" in flat or "toisostring().split(" in flat:
        issues.append("toISOString으로 날짜 키를 만들면 한국 시간 아침에 어제로 기록돼요. 로컬 날짜(getFullYear/getMonth/getDate)로 만들어야 해요.")
    return issues


# ───────── parsing ─────────

_BLOCK = re.compile(r"<<<<<<< SEARCH\n(.*?)\n?=======\n(.*?)\n?>>>>>>> REPLACE", re.S)
_SUMMARY = re.compile(r"<!--\s*요약:\s*(.*?)\s*-->")


def split_created(text: str) -> tuple[str, str]:
    """Model output for a new app → (html, summary)."""
    t = text.strip()
    t = re.sub(r"^```(?:html)?\s*|\s*```$", "", t)
    m = _SUMMARY.search(t[:400])
    summary = m.group(1) if m else ""
    start = t.lower().find("<!doctype")
    if start < 0:
        start = t.lower().find("<html")
    html = t[start:] if start >= 0 else t
    return html.strip(), _one_line(summary) or "만들었어요"


_DIFF_LINE = re.compile(r"^(?:@@(?: .*)?|[+-](?: {1,}\S.*|\S.*\S)?)$", re.M)


def _diffy(code: str) -> bool:
    """Unified-diff lines (`@@`, `+  foo`, `-  bar`) the model sometimes writes instead of plain code."""
    n = len(_DIFF_LINE.findall(code))
    return n >= 2 and ("@@" in code or n >= 3)


_PATCH = re.compile(r"^\*\*\* (?:Begin|End|Update|Add) (?:Patch|File)", re.M)
_MARK = re.compile(r"^\s*(<{7} SEARCH|={7}|>{7} REPLACE)\s*$", re.M)


_NEAR_MARK = re.compile(r"^[ \t]*(?:(<{5,})[ \t]*SEARCH|(={5,})|(>{5,})[ \t]*(?:REPLACE)?)[ \t]*$", re.M)


def _norm_marks(text: str) -> str:
    """Near-miss markers the model sometimes writes (`>>>>>>`, `<<<<<< SEARCH`, `========`)
    → the exact ones, so one sloppy line doesn't throw a whole edit away."""
    return _NEAR_MARK.sub(lambda m: "<<<<<<< SEARCH" if m.group(1) else "=======" if m.group(2) else ">>>>>>> REPLACE", text)


def parse_blocks(text: str) -> tuple[list[tuple[str, str]], bool]:
    """Line-by-line SEARCH/REPLACE parser → (blocks, malformed). A stray or doubled marker makes
    the whole answer malformed instead of leaking marker lines into the code."""
    blocks: list[tuple[str, str]] = []
    state, search, replace, bad = "out", [], [], False
    for line in _norm_marks(text).split("\n"):
        mark = line.strip()
        if state == "out":
            if mark == "<<<<<<< SEARCH":
                state, search, replace = "search", [], []
            elif mark in ("=======", ">>>>>>> REPLACE"):
                bad = True
        elif state == "search":
            if mark == "=======":
                state = "replace"
            elif mark.startswith(("<<<<<<<", ">>>>>>>")):
                bad = True
                state = "out"
            else:
                search.append(line)
        else:  # replace
            if mark == ">>>>>>> REPLACE":
                blocks.append(("\n".join(search), "\n".join(replace)))
                state = "out"
            elif mark == "=======" or mark.startswith("<<<<<<<"):
                bad = True
                state = "out"
            else:
                replace.append(line)
    return blocks, bad or state != "out"


def checklist(text: str) -> list[str]:
    """The '- ' lines the model writes before its blocks (what it plans to change), user-facing part only."""
    head = text.split("<<<<<<< SEARCH", 1)[0]
    return [l.strip()[2:].split("::", 1)[0].strip() for l in head.split("\n") if l.strip().startswith("- ")][:12]


def apply_blocks(html: str, text: str) -> tuple[str | None, str, int]:
    """Edit output → (new html, or None when a block doesn't match / is malformed; summary; block count)."""
    text = _PATCH.sub("", text)
    first = text.strip().split("\n", 1)[0]
    summary = "" if first.startswith(("<<<<<<<", "- ")) else first
    blocks, bad = parse_blocks(text)
    if bad:
        log.info("code edit: malformed blocks")
        return None, _one_line(summary), max(1, len(blocks))
    out = html
    if any(_diffy(r) for _, r in blocks):
        log.info("code edit: diff-style replace")
        return None, _one_line(summary), len(blocks)
    for search, replace in blocks:
        if search and search in out:
            out = out.replace(search, replace, 1)
            continue
        # tolerate trailing-space / indentation drift: match line by line, stripped
        hit = _loose_find(out, search) if search.strip() else None
        if hit is None:
            log.info("code edit: SEARCH not found: %r", search[:120])
            return None, _one_line(summary), len(blocks)
        a, b = hit
        out = out[:a] + replace + out[b:]
    if len(_MARK.findall(out)) > len(_MARK.findall(html)):
        return None, _one_line(summary), len(blocks)
    return out, _one_line(summary), len(blocks)


def _loose_find(hay: str, needle: str) -> tuple[int, int] | None:
    want = [l.strip() for l in needle.strip("\n").split("\n")]
    lines = hay.split("\n")
    pos, offs = 0, []
    for l in lines:
        offs.append(pos)
        pos += len(l) + 1
    for i in range(len(lines) - len(want) + 1):
        if all(lines[i + k].strip() == want[k] for k in range(len(want))):
            end = offs[i + len(want) - 1] + len(lines[i + len(want) - 1])
            return offs[i], end
    return None


def apply_partial(html: str, text: str) -> tuple[str, int, list[str]]:
    """Lenient: apply every well-formed block that matches, and return the raw text of the ones
    that are broken (a missing ======= line, cut off at the end) or don't match, so only those
    get asked for again. → (html with the good blocks, applied count, failed block texts)."""
    text = _norm_marks(_PATCH.sub("", text))
    good: list[tuple[str, str]] = []
    failed: list[str] = []
    cur: list[str] | None = None
    for line in text.split("\n"):
        mark = line.strip()
        if mark == "<<<<<<< SEARCH":
            if cur is not None:
                failed.append("\n".join(cur))
            cur = [line]
        elif cur is not None:
            cur.append(line)
            if mark == ">>>>>>> REPLACE":
                blocks, bad = parse_blocks("\n".join(cur))
                if bad or len(blocks) != 1 or _diffy(blocks[0][1]):
                    failed.append("\n".join(cur))
                else:
                    good.append(blocks[0])
                cur = None
    if cur is not None:
        failed.append("\n".join(cur))
    out, n = html, 0
    for search, replace in good:
        if search and search in out:
            out = out.replace(search, replace, 1)
            n += 1
            continue
        hit = _loose_find(out, search) if search.strip() else None
        if hit is None:
            failed.append(f"<<<<<<< SEARCH\n{search}\n=======\n{replace}\n>>>>>>> REPLACE")
            continue
        out = out[: hit[0]] + replace + out[hit[1] :]
        n += 1
    return out, n, failed


def _one_line(s: str) -> str:
    s = (s or "").strip().strip("<!->").strip()
    s = s.split("\n")[0]
    return s if len(s) <= 60 else s[:59] + "…"


# ───────── model streaming ─────────

_clients: dict[str, object] = {}

# token spend of the current run (a list per request via contextvars, so concurrent runs don't mix)
_usage: contextvars.ContextVar[list[dict] | None] = contextvars.ContextVar("code_usage", default=None)
# paid (plus) users get the stronger model for new pages; everyone else runs on the free model
_plus: contextvars.ContextVar[bool] = contextvars.ContextVar("code_plus", default=False)


def usage() -> dict:
    """What the current run has spent so far: calls, input (and how much of it was cached), output."""
    calls = _usage.get() or []
    return {k: (len(calls) if k == "calls" else sum(c[k] for c in calls)) for k in ("calls", "input", "cached", "output")}


def _record(model: str, input_: int, cached: int, output: int) -> None:
    calls = _usage.get()
    if calls is not None:
        calls.append({"model": model, "input": input_, "cached": cached, "output": output})
    log.info("code tokens: %s in=%d (cached %d) out=%d", model, input_, cached, output)


def _user_content(user: str, images: list[str] | None, kind: str) -> str | list[dict]:
    if not images:
        return user
    if kind == "openai":
        return [{"type": "input_text", "text": user}, *({"type": "input_image", "image_url": u, "detail": "auto"} for u in images)]
    blocks: list[dict] = []
    for u in images:
        head, _, data = u.partition(",")
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": head[5:].split(";")[0], "data": data}})
    return [*blocks, {"type": "text", "text": user}]


async def _stream(system: str, user: str, images: list[str] | None = None, edit: bool = False) -> AsyncIterator[str]:
    """`images`: data URLs the user attached to this request (only the calls that do the request
    get them; repair passes don't need to look again). `edit`: a SEARCH/REPLACE edit, which runs on
    the faster edit model; new pages and full rewrites run on the main code model."""
    s = get_settings()
    model = s.openai_code_edit_model if edit or not _plus.get() else s.openai_code_model
    if s.openai_api_key and s.ai_provider != "anthropic":
        if "openai" not in _clients:
            _clients["openai"] = openai.AsyncOpenAI(api_key=s.openai_api_key, base_url=s.openai_base_url or None, timeout=120)
        client: openai.AsyncOpenAI = _clients["openai"]  # type: ignore[assignment]
        stream = await client.responses.create(
            model=model,
            instructions=system,
            input=[{"role": "user", "content": _user_content(user, images, "openai")}] if images else user,
            reasoning={"effort": s.openai_code_reasoning},
            max_output_tokens=16000,
            # one key per system prompt, so requests are routed to where its prefix is cached
            prompt_cache_key="seyo-code-" + hashlib.sha1(system.encode()).hexdigest()[:12],
            stream=True,
        )
        async for ev in stream:
            if ev.type == "response.output_text.delta":
                yield ev.delta
            elif ev.type == "response.completed" and ev.response.usage:
                u = ev.response.usage
                det = getattr(u, "input_tokens_details", None)
                _record(model, u.input_tokens, getattr(det, "cached_tokens", 0) or 0, u.output_tokens)
            elif ev.type in ("response.failed", "error"):
                raise RuntimeError(str(getattr(ev, "error", ev)))
        return
    if s.anthropic_api_key:
        if "anthropic" not in _clients:
            _clients["anthropic"] = anthropic.AsyncAnthropic(api_key=s.anthropic_api_key)
        client2: anthropic.AsyncAnthropic = _clients["anthropic"]  # type: ignore[assignment]
        sys_blocks = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        async with client2.messages.stream(model=s.claude_code_model, max_tokens=16000, system=sys_blocks, messages=[{"role": "user", "content": _user_content(user, images, "anthropic")}]) as st:  # type: ignore[arg-type]
            async for chunk in st.text_stream:
                yield chunk
            u = (await st.get_final_message()).usage
            read = u.cache_read_input_tokens or 0
            _record(s.claude_code_model, u.input_tokens + read + (u.cache_creation_input_tokens or 0), read, u.output_tokens)
        return
    raise RuntimeError("no model key")


def available() -> bool:
    s = get_settings()
    return bool(s.openai_api_key or s.anthropic_api_key)


_DATA_URI = re.compile(r"data:image/[a-z+.-]+;base64,[A-Za-z0-9+/=]{200,}")
_SLOT = re.compile(r"\{\{\s*photo(\d)\s*\}\}")
MAX_IMAGES = 3
MAX_IMAGE_CHARS = 1_500_000  # ≈ 1.1 MB JPEG; the app sends ~100–300 KB after shrinking


def stash_images(html: str) -> tuple[str, list[str]]:
    """Photos already inside a page's code (from an earlier {{photoN}}) → short tokens, so the
    model doesn't read (and pay for) base64 on every edit. Restored by unstash_images."""
    kept: list[str] = []

    def keep(m: re.Match) -> str:
        kept.append(m.group(0))
        return f"data:seyo/{len(kept) - 1}"

    return _DATA_URI.sub(keep, html), kept


def unstash_images(html: str, kept: list[str]) -> str:
    return re.sub(r"data:seyo/(\d+)", lambda m: kept[int(m.group(1))] if int(m.group(1)) < len(kept) else m.group(0), html)


def fill_photos(html: str, images: list[str]) -> str:
    """{{photo1}}… → the attached photo itself (the model never writes base64)."""
    return _SLOT.sub(lambda m: images[int(m.group(1)) - 1] if 0 < int(m.group(1)) <= len(images) else "", html)


# words that ask for the photo itself to be on the page (otherwise it's only a reference)
_PLACE = re.compile(r"넣|배경|붙여|붙이|로고|그대로|보여|표시|커버|프로필|사진으로|이미지로|사진을 써|사진 써|사진도|사진을 쓰")


def wants_photo_in_page(prompt: str) -> bool:
    return bool(_PLACE.search(prompt or ""))


# words that ask for the page to be laid out like the photo ("이렇게 생긴 위클리")
_LAYOUT = re.compile(r"이렇게\s*생긴|이렇게\s*만들|이런\s*(모양|구성|레이아웃|배치|식|느낌의?\s*구성)|(사진|이미지|그림|이거|이것|요거)\s*처럼|똑같이|비슷하게|따라\s*(만들|해)|같은\s*(구성|모양|레이아웃|배치)")


def wants_photo_layout(prompt: str) -> bool:
    return bool(_LAYOUT.search(prompt or ""))


_MOOD = ("`<!-- 무드: -->` 주석에 사진에서 읽은 것을 먼저 적는다: 꾸밈 정도(플레인/꾸밈), 주요 색 2~3개(hex). "
         "사진이 플레인·미니멀하면 테마 클래스와 장식 없이 seyo 기본 그대로 두고 색만 맞춘다. "
         "사진이 분명히 꾸며져 있을 때만(체크·리본·스티커·빈티지 등) 가장 가까운 테마 하나를 고른다. ")


def _photo_note(images: list[str] | None, place: bool = False, layout: bool = False) -> str:
    if not images:
        return ""
    n = len(images)
    if place:
        names = ", ".join(f"{{{{photo{i + 1}}}}}" for i in range(n))
        return (f"\n\n(사용자가 사진 {n}장을 함께 보냈고, 요청에 그 사진을 쓰는 방법이 있어요. 그대로 따른다. "
                f"사진 자체를 넣는 곳의 src에는 {names}를 그대로 쓴다. 나머지 구조는 seyo 기준 그대로, 사진은 무드만 참고한다.)")
    if layout:
        return (f"\n\n(사용자가 사진 {n}장을 보내고 '이렇게 생긴' 페이지를 원해요. 사진 자체는 페이지에 넣지 않는다. "
                "먼저 `<!-- 구성: -->` 주석에 사진의 영역을 위에서 아래로 빠짐없이 적는다(예: 헤더 · 7열 요일 · 칸마다 할 일 목록 · 시간대 격자 · 메모 · 미니 달력). "
                "그 영역과 배치(열 수, 순서, 비율)를 그대로 만들고 각 영역이 실제로 동작하게 한다. 스킬의 기본 뼈대보다 사진의 구성이 우선이다. "
                "글꼴·색·간격·키트 컴포넌트는 seyo 기준(고딕, 플레인)으로 입힌다. 사진 속 글자·할 일·로고·캐릭터는 베끼지 않고 한국어 예시나 빈 칸으로 둔다. "
                + _MOOD + ")")
    return (f"\n\n(사용자가 사진 {n}장을 함께 보냈어요. 무드 참고용이에요. 사진 자체는 페이지에 넣지 않는다. "
            + _MOOD + "레이아웃·구조·간격은 seyo 기준(스킬과 키트) 그대로 두고 사진의 배치를 따라 하지 않는다.)")


def _ev(**kw) -> str:
    return json.dumps(kw, ensure_ascii=False) + "\n"


async def _fix(html: str, issues: list[str], skills: list[Skill]) -> str:
    """One quiet repair pass for lint issues (edit blocks; a full rewrite only if it was cut off)."""
    ask = "품질 점검에서 아래 문제가 나왔어요. 이것만 고쳐 주세요.\n- " + "\n- ".join(issues)
    if any("끊겼" in i for i in issues):
        buf = [d async for d in _stream(rewrite_system(), f"{_topics(skills)}지금 파일 (중간에 끊김):\n{html}\n\n{ask}\n더 짧고 간결하게 처음부터 다시 써 주세요.")]
        new, _ = split_created("".join(buf))
        return new if "</html>" in new.lower() else html
    buf = [d async for d in _stream(edit_system(), f"지금 파일:\n{html}\n\n{ask}", edit=True)]
    new, _, n = apply_blocks(html, "".join(buf))
    return new if new and n else html


def repair_prompt(error: str, html: str | None = None) -> str:
    """The error plus the lines around where it happened, so the fix lands in the right place."""
    where = ""
    m = re.search(r"(\d+)번째 줄|@(\d+)", error)
    if html and m:
        n = int(m.group(1) or m.group(2))
        lines = html.split("\n")
        a, b = max(0, n - 6), min(len(lines), n + 5)
        where = "\n오류가 난 곳 (줄 번호: 코드):\n" + "\n".join(f"{i + 1}: {lines[i]}" for i in range(a, b))
    hint = ""
    if "already been declared" in error or "Unexpected token" in error or "SyntaxError" in error:
        hint = "\n문법 오류는 스크립트 전체를 멈춰요. 같은 이름의 const/let/function이 파일 안에 두 번 있는지 전체에서 찾아 하나로 합치고, 괄호와 따옴표 짝을 확인해 주세요."
    return f"앱을 실행하면 이 오류가 나요:\n{error}{where}{hint}\n원인을 찾아서 오류가 나지 않게 고쳐 주세요. 관련 없는 곳은 바꾸지 마세요. 첫 줄 요약은 '오류를 고쳤어요'."


def from_page_prompt(page: dict, prompt: str) -> str:
    """A fixed-block page that the blocks can't change the way the user wants → a code app that
    keeps everything on it (names, todos, checks, dates, records) and does what was asked."""
    from . import vibe

    bag: list[str] = []
    keep = {k: v for k, v in page.items() if k not in vibe.PROTECTED and k != "widget"}
    visible = json.dumps(vibe._stash(keep, bag), ensure_ascii=False)
    return f"""지금 페이지 (앱의 정해진 블록으로 만든 것, JSON):
{visible}

요청: {prompt}

이 페이지를 HTML 앱으로 다시 만들면서 요청을 반영한다.
- 지금 페이지에 있는 내용(이름, 할 일과 체크 상태, 날짜, 습관, 기록, 메모)을 하나도 빠뜨리지 말고 옮긴다. 그 내용을 seyo.state의 기본값으로 넣어서 처음 열자마자 그대로 보이게.
- @keep으로 시작하는 값은 사진이라 옮기지 않는다.
- theme 색(butter 노랑, sky 하늘, rose 분홍, mint 초록, clean 흰색)을 강조색으로."""


def _retry_note(failed: list[str], partial: bool) -> str:
    if not failed:
        return "\n\n(지난번 답은 블록 형식이 깨져서 적용하지 못했어요. 형식을 정확히 지켜 다시 써 주세요.)"
    shown = "\n\n".join(f[:800] for f in failed[:5])
    if partial:
        return ("\n\n(요청의 나머지는 위 파일에 이미 반영했어요. 아래 블록만 형식이 깨졌거나 SEARCH가 파일에 없어서 못 넣었어요. "
                "위 파일에서 글자 그대로 복사한 짧은 SEARCH로 이 블록들만 다시 써 주세요. 이미 반영된 것은 다시 쓰지 않는다.)\n" + shown)
    return f"\n\n(지난번 답의 아래 블록은 형식이 깨졌거나 SEARCH가 파일에 그대로 없어서 적용하지 못했어요. 지금 파일에서 글자 그대로 복사한 짧은 SEARCH로 블록 전체를 다시 써 주세요.)\n{shown}"


async def run(prompt: str, html: str | None, name: str | None = None, page: dict | None = None, images: list[str] | None = None, plus: bool = False) -> AsyncIterator[str]:
    """Yields NDJSON events. The last one is done or error; done carries the full html and the
    tokens the run spent. `page` (with no html): rebuild that fixed-block page as a code app.
    `images`: photos attached to the request (a design reference unless the request says how to
    use them; the page can show them through {{photoN}})."""
    _usage.set([])
    _plus.set(plus)
    images = [u for u in (images or []) if u.startswith("data:image/")][:MAX_IMAGES]
    kept: list[str] = []
    if html:
        html, kept = stash_images(html)
    place = bool(images) and wants_photo_in_page(prompt)
    prompt = prompt + _photo_note(images, place, bool(images) and wants_photo_layout(prompt))
    placed = images if place else []  # only a request that asks for it gets the photo itself
    try:
        title = re.search(r"<title>(.*?)</title>", html or "", re.I | re.S)
        skills = pick_skills(f"{prompt} {name or ''} {title.group(1) if title else ''}")
        topics = _topics(skills)
        yield _ev(t="skills", names=[s.name for s in skills if not s.always])
        if not html:
            if page:
                user = from_page_prompt(page, prompt)
            else:
                user = f"페이지 이름: {name}\n요청: {prompt}" if name else f"요청: {prompt}"
            buf = []
            async for d in _stream(create_system(), topics + user, images):
                buf.append(d)
                yield _ev(t="code", d=d)
            new, summary = split_created("".join(buf))
            issues = lint(new)
            if issues:
                log.info("code create: fixing %s", issues)
                yield _ev(t="fixing", issues=issues)
                new = await _fix(new, issues, skills)
            if "<" not in new or len(new) > MAX_HTML:
                yield _ev(t="error", message="앱을 만들다 멈췄어요. 다시 말해 볼래요?")
                return
            yield _ev(t="done", html=fill_photos(new, placed), summary=summary, usage=usage())
            return

        before = set(lint(html))
        user = f"{topics}지금 파일:\n{html}\n\n요청: {prompt}"
        buf = []
        async for d in _stream(edit_system(), user, images, edit=True):
            buf.append(d)
            yield _ev(t="code", d=d)
        out = "".join(buf)
        new, summary, n = apply_blocks(html, out)
        if new is None or n == 0:
            # cheap retry before a rewrite: keep the blocks that applied, ask again only for the
            # broken / unmatched ones (short output instead of the whole file)
            part, ok, failed = apply_partial(html, out)
            log.info("code edit: %d blocks applied, retrying %d", ok, len(failed))
            base = part if ok else html
        if (new is None or n == 0) and ok and not failed:  # only stray markers outside the blocks
            new, n = part, ok
        elif new is None or n == 0:
            ask = f"{topics}지금 파일:\n{base}\n\n요청: {prompt}" + _retry_note(failed, partial=bool(ok))
            again = "".join([d async for d in _stream(edit_system(), ask, images, edit=True)])
            new, s2, n = apply_blocks(base, again)
            if new is None and ok:
                more, n2, still = apply_partial(base, again)
                new, n = (more, n2) if n2 and not still else (None, 0)
            summary = summary or s2
        if new is None or n == 0:
            # still no match: one full rewrite (slow and output-heavy, but always applies)
            yield _ev(t="restart")
            buf = []
            async for d in _stream(rewrite_system(), f"{topics}지금 파일:\n{html}\n\n요청: {prompt}", images):
                buf.append(d)
                yield _ev(t="code", d=d)
            new, s2 = split_created("".join(buf))
            summary = summary or s2
        issues = [i for i in lint(new) if i not in before]  # only what this edit broke
        if issues:
            log.info("code edit: fixing %s", issues)
            yield _ev(t="fixing", issues=issues)
            new = await _fix(new, issues, skills)
        if len(new) > MAX_HTML:
            yield _ev(t="error", message="앱이 너무 커졌어요. 조금 덜어 내고 다시 해 볼래요?")
            return
        yield _ev(t="done", html=unstash_images(fill_photos(new, placed), kept), summary=summary or "바꿨어요", usage=usage())
    except (openai.APIStatusError, openai.APIConnectionError, anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        from .ai import OFFLINE, _down

        _down("code", e)
        yield _ev(t="error", message=OFFLINE)
    except Exception:
        log.exception("code run failed")
        yield _ev(t="error", message="잠시 문제가 생겼어요. 다시 말해 볼래요?")
