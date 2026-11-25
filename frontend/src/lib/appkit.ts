/**
 * seyo design kit for 바이브 코딩 apps. Injected before the app's own <style>, so apps can
 * override anything. The class list is documented for the model in backend/app/skills/core.md —
 * keep the two in sync when adding or renaming classes.
 */
export const APP_KIT_SRC = `
:root{--ink:#1d1d1f;--sub:#6e6e73;--faint:#aeaeb2;--line:#e5e5ea;--fill:#f5f5f7;--card:#fff;--pink:#f8d7e2;--pink-soft:#fcedf2;--blue:#cfe2f6;--blue-soft:#eef4fb;--accent:#ec8cb1;--accent-2:#79a8e6;--accent-soft:#fcedf2;--good:#248a3d;--bad:#d70015;--r:20px;
font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",system-ui,sans-serif;color:var(--ink);letter-spacing:-.015em;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:transparent;min-height:100%}
body{font-size:15px;line-height:1.52;word-break:keep-all;overflow-wrap:break-word}
h1,h2,h3{margin:0;letter-spacing:-.03em;font-weight:600}h1{font-size:28px}h2{font-size:20px}h3{font-size:16px}
p{margin:0}
button{font:inherit;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:var(--fill);color:var(--ink);font-weight:500;cursor:pointer;transition:transform .2s ease,opacity .2s ease,background .15s;touch-action:manipulation}
button:active{transform:scale(.98)}button:disabled{opacity:.35;pointer-events:none}
.primary{background:var(--ink);color:#fff}.btn-accent{background:var(--pink);color:var(--ink)}.btn-blue{background:var(--blue);color:var(--ink)}.btn-ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--ink)}
.btn-soft{background:var(--fill);color:var(--ink)}
.icon-btn{width:44px;padding:0;display:inline-grid;place-items:center;background:var(--fill);color:var(--ink)}
.chip{min-height:36px;padding:0 14px;font-size:14px;background:var(--card);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line);font-weight:500}
.chip.on{background:var(--pink);color:var(--ink);box-shadow:none;font-weight:600}.chip.blue{background:var(--blue);box-shadow:none}
input,textarea,select{font:inherit;color:var(--ink);width:100%;min-height:44px;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:var(--card);outline:none;transition:border-color .15s}
input:focus,textarea:focus,select:focus{border-color:var(--accent)}textarea{min-height:88px;resize:vertical}
input[type=checkbox],input[type=radio]{width:22px;min-height:22px;accent-color:var(--accent)}input[type=range]{padding:0;border:0;accent-color:var(--accent)}
.field{display:flex;flex-direction:column;gap:6px}
.app{max-width:880px;margin:0 auto;padding:24px 20px 40px;display:flex;flex-direction:column;gap:20px}
.stack{display:flex;flex-direction:column;gap:12px}.row{display:flex;align-items:center;gap:10px}.between{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wrap{flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--card);border-radius:var(--r);padding:20px;box-shadow:0 0 0 1px var(--line),0 6px 16px rgba(0,0,0,.04)}
.soft{background:var(--fill);border-radius:var(--r);padding:18px}.tint-pink{background:var(--pink-soft)}.tint-blue{background:var(--blue-soft)}
.hero{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 0;text-align:center}
.title{font-size:26px;font-weight:600;letter-spacing:-.035em;line-height:1.2}.label{font-size:13px;color:var(--sub)}.muted{color:var(--sub)}
.big{font-size:56px;font-weight:300;letter-spacing:-.04em;line-height:1.05;font-variant-numeric:tabular-nums}
.list{display:flex;flex-direction:column}.item{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 2px;border-bottom:1px solid var(--line)}
.item:last-child{border-bottom:0}.item.done{color:var(--faint)}.item.done .text{text-decoration:line-through}
.check{width:26px;height:26px;min-height:26px;padding:0;border-radius:50%;background:transparent;box-shadow:inset 0 0 0 1.5px var(--faint);flex:none}
.item.done .check,.check.on{background:var(--accent);box-shadow:none}
.bar{height:8px;border-radius:99px;background:var(--fill);overflow:hidden}.bar>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .35s ease}
.badge{display:inline-flex;align-items:center;gap:4px;min-height:26px;padding:0 10px;border-radius:999px;background:var(--fill);color:var(--ink);font-size:13px;font-weight:600;white-space:nowrap}.badge.pink{background:var(--pink)}.badge.blue{background:var(--blue)}
.empty{padding:28px 12px;text-align:center;color:var(--sub);font-size:14px}
@keyframes seyo-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes seyo-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes seyo-shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
.pop{animation:seyo-pop .32s ease}.fade{animation:seyo-fade .3s ease both}.shake{animation:seyo-shake .35s}
.card,.soft{position:relative}
body{background:var(--bg,transparent)}
.title-serif{font-family:Georgia,"Times New Roman","AppleMyungjo","Nanum Myeongjo",serif;font-weight:500;letter-spacing:-.01em}
.mono{font-family:"SF Mono",Menlo,"Courier New",monospace;letter-spacing:0}
.paper-dot{background-color:var(--paper,#fff);background-image:radial-gradient(var(--paper-ink,rgba(29,29,31,.16)) 1px,transparent 1.2px);background-size:18px 18px}
.paper-grid{background-color:var(--paper,#fff);background-image:linear-gradient(var(--paper-ink,rgba(29,29,31,.07)) 1px,transparent 1px),linear-gradient(90deg,var(--paper-ink,rgba(29,29,31,.07)) 1px,transparent 1px);background-size:18px 18px}
.paper-line{background-color:var(--paper,#fff);background-image:linear-gradient(transparent 31px,var(--paper-ink,rgba(29,29,31,.09)) 32px);background-size:100% 32px;line-height:32px}
.tape{position:absolute;top:-11px;left:50%;width:96px;height:24px;margin-left:-48px;transform:rotate(-3deg);background:rgba(248,215,226,.82);box-shadow:0 1px 2px rgba(0,0,0,.06);z-index:2;pointer-events:none}
.tape.blue{background:rgba(207,226,246,.85)}.tape.yellow{background:rgba(250,236,170,.85)}.tape.mint{background:rgba(201,222,212,.88)}
.tape.check{background:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 6px,transparent 6px 12px),rgba(248,215,226,.85)}
.tape.left{left:16px;margin-left:0;transform:rotate(-6deg)}.tape.right{left:auto;right:16px;margin-left:0;transform:rotate(5deg)}
.tilt-l{transform:rotate(-2deg)}.tilt-r{transform:rotate(2deg)}
.sticker{display:inline-grid;place-items:center;padding:6px 12px;border-radius:999px;background:var(--card);border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.12);font-weight:600;font-size:13px;transform:rotate(-4deg)}
.polaroid{background:#fff;padding:10px 10px 34px;border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.1);display:inline-block}
.polaroid img,.polaroid .ph{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:2px;background:var(--fill)}
.stamp{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:64px;padding:8px 10px;border:1.5px dashed var(--accent);border-radius:12px;color:var(--accent);font-weight:700;line-height:1.1}
.mark{background:linear-gradient(transparent 58%,var(--accent-soft) 58%);padding:0 2px}
.cover{height:120px;border-radius:var(--r);background:linear-gradient(120deg,var(--blue-soft),var(--pink-soft));position:relative;overflow:hidden}
.callout{display:flex;gap:10px;align-items:flex-start;padding:14px 16px;border-radius:14px;background:var(--fill)}
.tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--fill)}.tabs button{min-height:36px;background:transparent;font-size:14px}.tabs button.on{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.cal-dow{text-align:center;font-size:12px;color:var(--sub);padding:4px 0}
.cal-cell{min-height:64px;padding:6px;border-radius:12px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:13px;display:flex;flex-direction:column;gap:3px;cursor:pointer}
.cal>:not(.cal-dow):not(.cal-cell),.cal>.cal-dow:has(>*){grid-column:1/-1}.cal>:not(.cal-cell):has(>.cal-cell),.cal>.cal-dow:has(>*){display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.cal-cell.out{opacity:.35}.cal-cell.today{box-shadow:inset 0 0 0 2px var(--accent)}.cal-cell.sun{color:var(--bad)}
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.day-col{display:flex;flex-direction:column;gap:6px;min-height:150px;padding:12px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
@media (max-width:760px){.week{grid-template-columns:repeat(2,minmax(0,1fr))}.cal-cell{min-height:48px}}
body.theme-pastel{--bg:#fff8fb;--card:#fff;--fill:#fdf0f5;--line:#f5dde7;--accent:#f08fb8;--accent-2:#8fbdf0;--accent-soft:#fde3ee;--r:22px}
body.theme-kitsch{--bg:#fff;--card:#fff;--fill:#ffe8f3;--line:#1d1d1f;--accent:#ff4fa0;--accent-2:#6c63ff;--accent-soft:#ffd1e8;--r:16px;background:repeating-conic-gradient(#ffe1ef 0 25%,#fff 0 50%) 0 0/28px 28px}
body.theme-kitsch .card{box-shadow:0 0 0 2px #1d1d1f,4px 4px 0 #1d1d1f}
body.theme-ribbon{--bg:#fff6f7;--card:#fffdfd;--fill:#fbeef0;--line:#f0d7dc;--accent:#d98aa0;--accent-2:#c9b6e4;--accent-soft:#f9e1e7;--r:20px}
body.theme-ribbon h1,body.theme-ribbon h2,body.theme-ribbon .title{font-family:Georgia,"AppleMyungjo","Nanum Myeongjo",serif;font-weight:500}
body.theme-retro{--bg:#f3eadb;--card:#fbf6ec;--fill:#efe4d2;--line:#e0d2bb;--ink:#3b3026;--sub:#7a6a58;--accent:#c4643c;--accent-2:#6f8f6a;--accent-soft:#f1d9c9;--r:8px}
body.theme-notion{--bg:#fff;--card:#fff;--fill:#f7f6f3;--line:#ebeae6;--ink:#37352f;--sub:#787774;--accent:#2f80ed;--accent-2:#9065b0;--accent-soft:#e7f0fd;--r:6px}
body.theme-notion .card{box-shadow:none;border:1px solid var(--line)}
body.theme-ios{--bg:#f2f2f7;--card:#fff;--fill:#e9e9ef;--line:#e4e4ea;--accent:#0a84ff;--accent-2:#34c759;--accent-soft:#e1efff;--r:14px}
body.theme-ios .card{box-shadow:none}
body.theme-dark{--bg:#121214;--card:#1c1c20;--fill:#26262b;--line:#2f2f35;--ink:#f2f2f4;--sub:#a1a1aa;--faint:#6b6b73;--accent:#ff7eb6;--accent-2:#8ab4ff;--accent-soft:#3a2230;--r:18px;color-scheme:dark}
body.theme-grid{--bg:#fff;--card:rgba(255,255,255,.88);--accent:#4a6cf7;--accent-soft:#e3e9ff;--r:14px;background-image:linear-gradient(rgba(74,108,247,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(74,108,247,.08) 1px,transparent 1px);background-size:20px 20px}
body[class*=theme-] .primary{background:var(--ink);color:var(--bg,#fff)}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (max-width:480px){.app{padding:18px 14px 32px}.big{font-size:44px}}
`;

/** On one line, so line numbers in the app's errors match its own source. */
export const APP_KIT = APP_KIT_SRC.replace(/\n/g, '');
