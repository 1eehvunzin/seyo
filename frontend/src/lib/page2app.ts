/**
 * A fixed-block page → the same page as a 바이브 코딩 HTML app.
 *
 * When the blocks can't do what was asked, the AI edits *this* (SEARCH/REPLACE) instead of
 * writing a new app from scratch: the first design stays, only the asked part changes, and an
 * edit streams far fewer tokens than a whole new file. Everything on the page (todos, checks,
 * habits, log answers, memo, d-day) is the app's starting state.
 *
 * The markup mirrors PageCanvas (theme card, "today" header, top number, ink section rule,
 * hairline rows, round checks, star in the corner) using the design kit classes (lib/appkit.ts).
 * Kept short and plain so the model can find its way around it.
 * Pages it can't express (wrong-note, timetable) return null → the old full rebuild.
 */
import { THEMES } from '@/theme';
import { Page } from './page';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON that's safe inside <script> */
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

const STAR = 'M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 8.7l7.1-.6z';

const LIST_HEAD: Record<string, string> = {
  today3: '오늘 꼭 할 일',
  portion: '오늘 분량',
  review: '오늘 공부한 것',
  roles: '누가 뭘 하나요',
  milestones: '중간 마감',
};

const LIST_NOTE: Record<string, string> = {
  today3: '오늘 할 일은 이게 전부예요',
  portion: '남은 날로 나눈 오늘 몫이에요',
  review: '날짜를 누르면 그날 복습한 걸로 남아요',
  roles: '각자 맡은 일을 체크해요',
  milestones: '중간 마감을 지키면 마지막 날이 편해져요',
};

export function canBecomeApp(page: Page): boolean {
  return !['wrong', 'timetable', 'app'].includes(page.main.kind);
}

export function pageToApp(page: Page): string | null {
  if (!canBecomeApp(page)) return null;
  const m = page.main;
  const theme = THEMES[page.theme];

  // the app's starting data: everything the page holds
  const data: Record<string, unknown> = { memo: page.memo, top: page.top, dim: page.dimDone };
  let body = '';
  let script = '';

  if (m.kind === 'today3' || m.kind === 'portion' || m.kind === 'review' || m.kind === 'roles' || m.kind === 'milestones' || m.kind === 'focus') {
    data.todos = m.todos.map((t) => ({ id: t.id, text: t.text, done: t.done, ...(t.subject ? { who: t.subject } : {}), ...(t.reviews ? { reviews: t.reviews } : {}), ...(t.due ? { due: t.due } : {}) }));
    if (m.kind === 'focus') data.blocks = m.blocksDone;
    const head = m.kind === 'focus' ? '블록마다 하나씩' : m.kind === 'milestones' ? `${m.goal}까지 중간 마감` : LIST_HEAD[m.kind];
    const note = m.kind === 'focus' ? '25분 집중하고 하나씩 지워요' : m.kind === 'today3' && m.laterCount > 0 ? `나머지 ${m.laterCount}개는 내일로 미뤄 뒀어요` : m.kind === 'portion' ? `남은 ${m.daysLeft}일로 나눈 오늘 몫이에요` : LIST_NOTE[m.kind];
    body = `${
      m.kind === 'focus'
        ? `
    <section class="timer">
      <div class="stack" style="gap:4px;flex:1">
        <p class="label">25분 집중 블록</p>
        <p class="big" id="clock">25:00</p>
        <div class="row" id="blocks" style="gap:6px"></div>
      </div>
      <button class="icon-btn" id="reset" aria-label="처음부터">↺</button>
      <button class="primary" id="go">시작</button>
    </section>`
        : ''
    }
    <section>
      <div class="head"><span>${esc(head)}</span><span id="count"></span></div>
      <div class="list" id="list"></div>
      <button class="add" id="add">+ 할 일 추가</button>
      <p class="label note">${esc(note)}</p>
    </section>`;
    script = `
function dayLabel(ms) {
  const d = new Date(ms);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return ms <= t.getTime() ? '오늘까지' : (d.getMonth() + 1) + '.' + d.getDate();
}

function renderMain() {
  const done = S.todos.filter(t => t.done).length;
  $('count').textContent = done + ' / ' + S.todos.length;
  $('list').innerHTML = S.todos.map((t, i) => \`
    <div class="item\${t.done ? ' done' : ''}\${t.done && S.dim ? ' dim' : ''}" data-id="\${t.id}">
      <span class="lead">\${esc(t.who || String(i + 1))}</span>
      <input class="text" data-act="text" value="\${esc(t.text)}" placeholder="할 일 적기">
      \${KIND === 'review' ? [1, 3, 7].map((d, k) => \`<button class="chip rv\${t.reviews && t.reviews[k] ? ' on' : ''}" data-act="rv" data-k="\${k}">\${dayLabel(Date.now() + d * 864e5)}</button>\`).join('') : ''}
      \${KIND === 'milestones' && t.due ? \`<span class="label">\${dayLabel(t.due)}</span>\` : ''}
      \${KIND === 'portion' ? '<span class="label">오늘 몫</span>' : ''}
      <button class="check\${t.done ? ' on' : ''}" data-act="check" aria-label="완료"></button>
    </div>\`).join('');
  seyo.widget('남은 할 일', S.todos.length - done);
}

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  const row = e.target.closest('.item');
  if (!b || !row) return;
  const t = S.todos.find(x => x.id === row.dataset.id);
  if (b.dataset.act === 'check') t.done = !t.done;
  else if (b.dataset.act === 'rv') { t.reviews = t.reviews || [false, false, false]; t.reviews[+b.dataset.k] = !t.reviews[+b.dataset.k]; }
  else return;
  save(); render();
});
$('list').addEventListener('input', e => {
  if (e.target.dataset.act !== 'text') return;
  S.todos.find(x => x.id === e.target.closest('.item').dataset.id).text = e.target.value;
  save();
});
$('add').onclick = () => {
  S.todos.push({ id: 't' + Date.now(), text: '', done: false });
  save(); render();
  const inputs = document.querySelectorAll('#list .text');
  inputs[inputs.length - 1].focus();
};
${
  m.kind === 'focus'
    ? `
const LEN = 25 * 60 * 1000;
let endAt = 0, leftMs = LEN, tick = 0;
function clock() {
  const ms = endAt ? Math.max(0, endAt - Date.now()) : leftMs;
  const s = Math.ceil(ms / 1000);
  $('clock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  if (endAt && ms === 0) { clearInterval(tick); endAt = 0; leftMs = LEN; S.blocks++; save(); render(); }
}
$('go').onclick = () => {
  if (endAt) { leftMs = endAt - Date.now(); endAt = 0; clearInterval(tick); }
  else { endAt = Date.now() + leftMs; tick = setInterval(clock, 250); }
  $('go').textContent = endAt ? '잠깐 멈추기' : '시작';
  clock();
};
$('reset').onclick = () => { clearInterval(tick); endAt = 0; leftMs = LEN; $('go').textContent = '시작'; clock(); };
const _renderMain = renderMain;
renderMain = function () {
  _renderMain();
  $('blocks').innerHTML = [0, 1, 2, 3].map(i => \`<i class="block\${i < S.blocks ? ' on' : ''}"></i>\`).join('');
};`
    : ''
}`;
  } else if (m.kind === 'habits') {
    data.habits = m.habits.map((h) => ({ id: h.id, name: h.name, week: h.week }));
    data.remind = m.remind;
    body = `
    <section>
      <div class="head habit-row"><span style="flex:1">이번 주</span><span id="days" class="days"></span></div>
      <div class="list" id="list"></div>
      <button class="add" id="add">+ 습관 추가</button>
    </section>`;
    script = `
const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const todayIdx = (new Date().getDay() + 6) % 7;

function renderMain() {
  $('days').innerHTML = WEEK.map((d, i) => \`<b class="\${i === todayIdx ? 'now' : ''}">\${d}</b>\`).join('');
  $('list').innerHTML = S.habits.map(h => \`
    <div class="item habit-row" data-id="\${h.id}">
      <input class="text" data-act="name" value="\${esc(h.name)}" placeholder="습관 이름">
      <span class="days">\${h.week.map((on, i) => \`<button class="dot\${on ? ' on' : ''}\${i === todayIdx ? ' now' : ''}" data-act="day" data-i="\${i}" \${i > todayIdx ? 'disabled' : ''} aria-label="\${WEEK[i]}요일"></button>\`).join('')}</span>
    </div>\`).join('');
  const done = S.habits.reduce((n, h) => n + h.week.slice(0, todayIdx + 1).filter(Boolean).length, 0);
  seyo.widget('이번 주', done + '/' + S.habits.length * (todayIdx + 1));
}

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-act="day"]');
  if (!b) return;
  const h = S.habits.find(x => x.id === b.closest('.item').dataset.id);
  h.week[+b.dataset.i] = !h.week[+b.dataset.i];
  save(); render();
});
$('list').addEventListener('input', e => {
  if (e.target.dataset.act !== 'name') return;
  S.habits.find(x => x.id === e.target.closest('.item').dataset.id).name = e.target.value;
  save();
});
$('add').onclick = () => {
  S.habits.push({ id: 'h' + Date.now(), name: '', week: [false, false, false, false, false, false, false] });
  save(); render();
};`;
  } else if (m.kind === 'log') {
    data.fields = m.fields;
    // a photo picked in the block page is a device file path the sandboxed page can't load
    data.values = Object.fromEntries(Object.entries(m.values).filter(([k, v]) => k !== '사진 한 장' || String(v).startsWith('data:')));
    data.question = m.prompt;
    data.oneTap = m.oneTap;
    body = `
    <section>
      <div class="head"><span>하루 한 장</span><span id="count"></span></div>
      <div class="stack" id="fields" style="gap:22px;padding-top:18px"></div>
    </section>`;
    script = `
const OPTIONS = {
  '날씨': ['맑음', '흐림', '비', '눈'],
  '한 줄 일기': ['평범했어', '뿌듯해', '피곤해', '즐거웠어'],
  '감사한 일': ['밥이 맛있었어', '친구가 도와줬어', '푹 잤어'],
};
const MOODS = ['#cfe2f6', '#c9ded4', '#efe7b4', '#f3d3b5', '#f8d7e2'];
const HINT = { '한 줄 일기': '오늘을 한 줄로', '읽은 책': '책 제목, 몇 쪽까지', '감사한 일': '작은 것도 좋아요' };

function field(f) {
  const v = S.values[f] || '';
  if (f === '사진 한 장') return v
    ? \`<div class="photo"><img src="\${v}" alt="오늘 사진"><button class="chip" data-photo="pick">바꾸기</button></div>\`
    : '<button class="photo photo--empty" data-photo="pick">사진을 고르거나 붙여넣어요</button>';
  if (f === '오늘 기분') return '<div class="row">' + MOODS.map((c, i) => \`<button class="mood\${v === String(i + 1) ? ' on' : ''}" style="background:\${c}" data-f="\${f}" data-v="\${i + 1}" aria-label="기분 \${i + 1}점"></button>\`).join('') + '</div>';
  if (OPTIONS[f] && (f === '날씨' || S.oneTap)) return '<div class="row wrap">' + OPTIONS[f].map(o => \`<button class="chip\${v === o ? ' on' : ''}" data-f="\${f}" data-v="\${esc(o)}">\${esc(o)}</button>\`).join('') + '</div>';
  return \`<input class="line" data-f="\${f}" value="\${esc(v)}" placeholder="\${HINT[f] || ''}">\`;
}

function renderMain() {
  const filled = S.fields.filter(f => S.values[f]).length;
  $('count').textContent = filled + ' / ' + S.fields.length;
  $('fields').innerHTML =
    (S.question ? \`<div class="stack" style="gap:8px"><p class="label">오늘의 질문</p><h3>\${esc(S.question)}</h3></div>\` : '') +
    S.fields.map(f => \`<div class="stack" style="gap:10px"><p class="label">\${f}</p>\${field(f)}</div>\`).join('');
  seyo.widget('오늘 기록', filled + '/' + S.fields.length);
}

seyo.onPhotoPaste(url => { S.values['사진 한 장'] = url; save(); render(); });
$('fields').addEventListener('click', e => {
  if (e.target.closest('[data-photo]')) {
    seyo.photo().then(url => { S.values['사진 한 장'] = url; save(); render(); });
    return;
  }
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  S.values[b.dataset.f] = S.values[b.dataset.f] === b.dataset.v ? '' : b.dataset.v;
  save(); render();
});
$('fields').addEventListener('input', e => {
  if (!e.target.dataset.f) return;
  S.values[e.target.dataset.f] = e.target.value;
  save();
});`;
  }

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(page.name)}</title>
<style>
  :root { --page: ${theme.card}; --star: ${theme.star}; }
  body { background: var(--page); }
  .page { position: relative; z-index: 1; max-width: 920px; padding: 30px 34px 48px; gap: 22px; }
  .star { position: fixed; right: -20px; bottom: -24px; width: 120px; height: 120px; z-index: 0; pointer-events: none; }
  .star path { fill: var(--star); }
  .top-num { font-size: 56px; font-weight: 200; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; }
  .top-label::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-right: 6px; vertical-align: middle; }
  .date-in { width: 160px; min-height: 36px; padding: 4px 10px; font-size: 14px; }
  .reason { align-self: flex-start; padding: 9px 14px; border-radius: 12px; background: rgba(255,255,255,.75); font-size: 13.5px; }
  .head { display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--ink); font-size: 13px; color: var(--sub); }
  .item { border-bottom: 1px solid rgba(29,29,31,.08); gap: 14px; min-height: 50px; }
  .item.dim { opacity: .35; }
  .lead { font-size: 12px; color: var(--sub); min-width: 30px; }
  .text, .line { border: 0; border-radius: 0; background: transparent; padding: 0; min-height: 44px; flex: 1; }
  .line { border-bottom: 1px solid rgba(29,29,31,.12); font-weight: 300; }
  .item.done .text { color: var(--faint); text-decoration: line-through; }
  .check { width: 22px; min-height: 22px; box-shadow: inset 0 0 0 1.5px rgba(29,29,31,.25); }
  .check.on, .item.done .check { background: var(--ink); }
  .chip.rv { min-height: 30px; padding: 0 10px; font-size: 12px; }
  .chip.rv.on { background: var(--ink); color: #fff; }
  .add { align-self: flex-start; background: transparent; padding: 0; color: var(--sub); font-weight: 400; font-size: 14px; }
  .note { padding-top: 12px; }
  .timer { display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 18px; background: rgba(255,255,255,.75); }
  .block { display: block; width: 18px; height: 6px; border-radius: 3px; background: rgba(29,29,31,.1); }
  .block.on { background: var(--accent); }
  .habit-row { display: flex; align-items: center; }
  .days { display: flex; }
  .days b { width: 40px; text-align: center; font-weight: 400; font-size: 12px; }
  .days b.now { color: var(--ink); font-weight: 600; }
  .dot { width: 40px; min-height: 44px; padding: 0; background: transparent; position: relative; }
  .dot::after { content: ""; position: absolute; left: 9px; top: 11px; width: 22px; height: 22px; border-radius: 50%; background: rgba(29,29,31,.08); }
  .dot:disabled { opacity: 1; }
  .dot:disabled::after { background: rgba(29,29,31,.04); }
  .dot.now::after { box-shadow: inset 0 0 0 1.5px var(--ink); }
  .dot.on::after { background: #93bbaa; box-shadow: none; }
  .photo { position: relative; width: 220px; height: 160px; border-radius: 16px; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo .chip { position: absolute; right: 8px; bottom: 8px; min-height: 30px; font-size: 12px; }
  .photo--empty { display: grid; place-items: center; padding: 0 18px; background: transparent; border: 1px dashed var(--faint); color: var(--sub); font-weight: 400; font-size: 13.5px; border-radius: 16px; }
  .mood { width: 30px; min-height: 30px; padding: 0; border-radius: 50%; }
  .mood.on { box-shadow: 0 0 0 2px var(--ink); transform: scale(1.15); }
  .memo textarea { border: 0; border-bottom: 1px solid rgba(29,29,31,.12); border-radius: 0; background: transparent; padding: 8px 0; min-height: 44px; font-weight: 300; }
  @media (max-width: 480px) { .page { padding: 22px 18px 40px; } .days b, .dot { width: 32px; } .dot::after { left: 5px; } }
</style>
</head>
<body>
  <main class="app page">
    <header class="between" style="align-items:flex-end">
      <div class="stack" style="gap:4px">
        <p class="label">today</p>
        <h1 id="today"></h1>
      </div>
      <div class="stack" id="topBox" style="gap:4px;align-items:flex-end"></div>
    </header>
    ${page.reason ? `<p class="reason">★ ${esc(page.reason)}</p>` : ''}
${body}
    <section class="memo stack" id="memoBox" style="gap:8px">
      <p class="label">memo</p>
      <textarea id="memo" placeholder="여기에 적어요"></textarea>
    </section>
  </main>
  <svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg>
<script>
const KIND = ${js(m.kind)};
const S = Object.assign(${js(data)}, seyo.state);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function save() { seyo.save(S); }

function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function ddayText(date) {
  const p = String(date).match(/(\\d{4})\\D+(\\d{1,2})\\D+(\\d{1,2})/);
  if (!p) return 'D-?';
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(+p[1], p[2] - 1, +p[3]) - t) / 864e5);
  return n > 0 ? 'D-' + n : n === 0 ? 'D-DAY' : 'D+' + -n;
}

function renderTop() {
  const now = new Date();
  $('today').textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!S.top) { $('topBox').innerHTML = ''; return; }
  if (S.top.kind === 'dday') {
    $('topBox').innerHTML = \`<p class="label top-label">\${esc(S.top.label)}</p><p class="top-num">\${ddayText(S.top.date)}</p><input class="date-in" id="topDate" value="\${esc(S.top.date)}" aria-label="날짜">\`;
    $('topDate').onchange = e => { S.top.date = e.target.value; save(); render(); };
  } else {
    // streak: habits → checks so far this week, log → whether today is filled
    let value = '';
    if (S.habits) {
      const upto = (now.getDay() + 6) % 7 + 1;
      value = S.habits.reduce((n, h) => n + h.week.slice(0, upto).filter(Boolean).length, 0) + '/' + S.habits.length * upto;
    } else if (S.values) value = (Object.values(S.values).some(Boolean) ? 1 : 0) + '일';
    $('topBox').innerHTML = \`<p class="label top-label">\${esc(S.top.label)}</p><p class="top-num">\${value}</p>\`;
  }
}
${script}

function render() {
  renderTop();
  renderMain();
  $('memoBox').style.display = S.memo === null ? 'none' : '';
}

$('memo').value = S.memo || '';
$('memo').addEventListener('input', e => { S.memo = e.target.value; save(); });
render();
</script>
</body>
</html>
`;
}
