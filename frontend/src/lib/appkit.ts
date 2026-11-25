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
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (max-width:480px){.app{padding:18px 14px 32px}.big{font-size:44px}}
`;

/** On one line, so line numbers in the app's errors match its own source. */
export const APP_KIT = APP_KIT_SRC.replace(/\n/g, '');
