"""바이브 코딩 품질 평가.

Runs each scenario (a create + follow-up edits) through app.code.run with a given model,
then for every turn runs the app in headless Chrome:
  - <id>-<turn>.png: the first screen as a student sees it (empty state, no clicks)
  - errors: load errors + a smoke test that types into inputs and presses every button once
  - tokens: what the run spent (input, cached input, output) and wall time
Grading is done by a person (or the coding assistant) reading the screenshots and code against
the scenario's requests; no judge model is paid for. Grades go in evals/out/<run>/grades.md.

Usage (from backend/):
  PYTHONPATH=. .venv/Scripts/python evals/run_evals.py --model gpt-5.4-mini --reasoning none [--only kanban]
Writes evals/out/<model>-<reasoning>/ (html, png per turn, report.json) and prints a summary.
"""

import argparse
import asyncio
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path

from app import code
from app.config import get_settings

HERE = Path(__file__).parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
KIT = (HERE.parent.parent / "frontend/src/lib/appkit.ts").read_text(encoding="utf-8").split("`")[1].replace("\n", "")

# Same environment the app gives (kit + seyo bridge + blocked dialogs), plus an error log and a
# smoke test: fill inputs, press each button once (skipping delete-ish ones), then wait.
HARNESS = """<style id="seyo-kit">%s</style><script>(function(){
var errs=[];function log(m){errs.push(String(m).slice(0,200));var p=document.getElementById('__errs');if(p)p.textContent=JSON.stringify(errs);}
window.addEventListener('error',function(e){log(e.message+' @'+e.lineno);});
window.addEventListener('unhandledrejection',function(e){log('promise: '+(e.reason&&e.reason.message||e.reason));});
window.seyo={state:{},save:function(s){this.state=s;},widget:function(){},photo:function(){return new Promise(function(r){r('data:image/gif;base64,R0lGODlhAQABAAAAACw=');});},onPhotoPaste:function(){},photoFromFile:function(){return Promise.resolve('data:image/gif;base64,R0lGODlhAQABAAAAACw=');}};
window.alert=window.confirm=window.prompt=function(){};
document.addEventListener('DOMContentLoaded',function(){var p=document.createElement('pre');p.id='__errs';p.style.display='none';p.textContent=JSON.stringify(errs);document.documentElement.appendChild(p);
if(location.hash==='#look')return;
setTimeout(function(){try{
document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=date]):not([type=number]),textarea').forEach(function(i){i.value='사과 - apple';i.dispatchEvent(new Event('input',{bubbles:true}));});
document.querySelectorAll('input[type=number]').forEach(function(i){i.value='3';i.dispatchEvent(new Event('input',{bubbles:true}));});
var bs=[].slice.call(document.querySelectorAll('button')).filter(function(b){return !/지우|삭제|초기화|리셋/.test(b.textContent)}).slice(0,25);
bs.forEach(function(b){try{b.click();}catch(e){log('click: '+e.message);}});
}catch(e){log('smoke: '+e.message);}},400);});
})();</script>"""


def harness_doc(html: str) -> str:
    inj = HARNESS % KIT
    m = re.search(r"<head[^>]*>", html, re.I)
    return html[: m.end()] + inj + html[m.end() :] if m else inj + html


def run_in_chrome(html: str, png: Path) -> list[str]:
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(harness_doc(html))
        path = f.name
    url = "file:///" + path.replace("\\", "/")
    look = url + "#look"  # screenshot without the smoke-test clicks
    base = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=900,1400", "--virtual-time-budget=2500"]
    try:
        dom = subprocess.run([*base, "--dump-dom", url], capture_output=True, text=True, encoding="utf-8", timeout=60).stdout
        subprocess.run([*base, f"--screenshot={png}", look], capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return ["chrome timeout (infinite loop?)"]
    m = re.search(r'<pre id="__errs"[^>]*>(.*?)</pre>', dom, re.S)
    try:
        return json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")) if m else ["no error log (page failed?)"]
    except json.JSONDecodeError:
        return ["error log unreadable"]


async def scenario(sc: dict, out: Path) -> dict:
    # "start": an existing page (e.g. a block page drawn by frontend/src/lib/page2app.ts) to edit
    html = (HERE / sc["start"]).read_text(encoding="utf-8") if sc.get("start") else None
    if html:
        await asyncio.to_thread(run_in_chrome, html, out / f"{sc['id']}-start.png")
    turns = []
    for i, prompt in enumerate(sc["turns"]):
        t0 = time.time()
        events = []
        done = None
        async for line in code.run(prompt, html, None):
            ev = json.loads(line)
            if ev["t"] != "code":
                events.append(ev["t"] if ev["t"] != "fixing" else f"fixing:{len(ev['issues'])}")
                done = ev
        secs = time.time() - t0
        if not done or done["t"] != "done" or not done.get("html"):
            turns.append({"turn": i, "failed": done, "secs": round(secs, 1)})
            break
        html = done["html"]
        (out / f"{sc['id']}-{i}.html").write_text(html, encoding="utf-8")
        errors = await asyncio.to_thread(run_in_chrome, html, out / f"{sc['id']}-{i}.png")
        if errors and not errors[0].startswith(("chrome", "no error log", "error log")):
            # what the app does on a crash: one free repair run with the error (see vibecode.repairApp)
            events.append("repair")
            async for line in code.run(code.repair_prompt(errors[0][:300], html), html, None):
                ev = json.loads(line)
                if ev["t"] == "done" and ev.get("html"):
                    html = ev["html"]
                    u, r = done.get("usage") or {}, ev.get("usage") or {}
                    done["usage"] = {k: u.get(k, 0) + r.get(k, 0) for k in set(u) | set(r)}
            (out / f"{sc['id']}-{i}.html").write_text(html, encoding="utf-8")
            errors = await asyncio.to_thread(run_in_chrome, html, out / f"{sc['id']}-{i}.png")
        turns.append({"turn": i, "secs": round(secs, 1), "events": events, "summary": done.get("summary"), "chars": len(html), "errors": errors, "usage": done.get("usage")})
    return {"id": sc["id"], "turns": turns}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=None)
    ap.add_argument("--reasoning", default=None)
    ap.add_argument("--only", default=None)
    ap.add_argument("--tag", default="")
    a = ap.parse_args()
    s = get_settings()
    if a.model:
        s.openai_code_model = a.model
    if a.reasoning:
        s.openai_code_reasoning = a.reasoning
    out = HERE / "out" / f"{s.openai_code_model}-{s.openai_code_reasoning}{a.tag}"
    out.mkdir(parents=True, exist_ok=True)
    scs = [x for x in json.loads((HERE / "scenarios.json").read_text(encoding="utf-8")) if not a.only or x["id"] in a.only.split(",")]
    results = await asyncio.gather(*(scenario(sc, out) for sc in scs))
    (out / "report.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"== {s.openai_code_model} / {s.openai_code_reasoning}{a.tag}  ->  {out}")
    tot = {"calls": 0, "input": 0, "cached": 0, "output": 0}
    for r in results:
        for t in r["turns"]:
            if "failed" in t:
                print(f"  {r['id']}#{t['turn']} FAILED {t['failed']}")
                continue
            u = t.get("usage") or {}
            for k in tot:
                tot[k] += u.get(k, 0)
            print(f"  {r['id']}#{t['turn']} {t['secs']:5.1f}s calls={u.get('calls')} in={u.get('input')} (cached {u.get('cached')}) out={u.get('output')} errs={len(t['errors'])} {t['events']} :: {t['summary']}")
            for e in t["errors"][:3]:
                print(f"      ! {e}")
    print(f"  TOTAL calls={tot['calls']} in={tot['input']} (cached {tot['cached']}) out={tot['output']}")


if __name__ == "__main__":
    asyncio.run(main())
