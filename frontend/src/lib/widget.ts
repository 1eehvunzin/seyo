import { addDays, dday, parseLooseDate, shortEn, weekdayIndex } from './date';
import type { Page, Widget, WidgetTpl } from './page';
import { nextClass, TIMETABLE_PERIODS } from './timetable';

/*
 * Widgets never get their own layout: each is a fixed template whose values are bound to
 * the page's data. Because they read the page live, checking something on the page updates
 * the widget at once (members' writes too, once there's a server).
 */

export type BigNumber = { label: string; value: string; suffix?: string };
export type ShortList = { title: string; count?: string; items: { text: string; done: boolean }[] };
export type Dots = { label: string; days: boolean[]; today: number };
export type NextItem = { label: string; title: string; sub?: string };
export type Fallback = { name: string; sub: string };

const todayStart = () => addDays(new Date(), 0).getTime();

export function bigNumber(p: Page): BigNumber | null {
  const m = p.main;
  if (p.top?.kind === 'dday') return { label: p.top.label, value: dday(parseLooseDate(p.top.date)) };
  if (m.kind === 'wrong') return { label: '다시 풀 문제', value: String(m.entries.filter((e) => e.reviewAt <= todayStart()).length), suffix: '개 · 오늘' };
  if (m.kind === 'habits') {
    const upto = weekdayIndex() + 1;
    const done = m.habits.reduce((n, h) => n + h.week.slice(0, upto).filter(Boolean).length, 0);
    return { label: '이번 주 달성', value: String(done), suffix: `/ ${m.habits.length * upto}` };
  }
  if (m.kind === 'log') return { label: '오늘 기록', value: String(m.fields.filter((f) => m.values[f]).length), suffix: `/ ${m.fields.length} 칸` };
  if ('todos' in m) return { label: '남은 할 일', value: String(m.todos.filter((t) => !t.done).length), suffix: '개' };
  return null;
}

export function shortList(p: Page): ShortList | null {
  const m = p.main;
  if ('todos' in m) {
    const title = m.kind === 'portion' ? '오늘 분량' : m.kind === 'focus' ? '블록마다 하나씩' : m.kind === 'review' ? '오늘 공부한 것' : m.kind === 'roles' ? '누가 뭘 하나요' : m.kind === 'milestones' ? '중간 마감' : `오늘 꼭 할 ${m.todos.length}개`;
    return { title, count: `${m.todos.filter((t) => t.done).length} / ${m.todos.length}`, items: m.todos.slice(0, 3).map((t) => ({ text: t.subject && !t.done ? `${t.subject} ${t.text}` : t.text, done: t.done })) };
  }
  if (m.kind === 'habits') {
    const d = weekdayIndex();
    return { title: '오늘 습관', count: `${m.habits.filter((h) => h.week[d]).length} / ${m.habits.length}`, items: m.habits.slice(0, 3).map((h) => ({ text: h.name, done: h.week[d] })) };
  }
  if (m.kind === 'wrong') {
    const due = m.entries.filter((e) => e.reviewAt <= todayStart());
    return { title: '오늘 다시 풀 문제', count: `${due.length}개`, items: due.slice(0, 3).map((e, i) => ({ text: `${i + 1}번 ${e.unit ?? e.reason ?? ''}`.trim(), done: false })) };
  }
  if (m.kind === 'timetable') {
    const d = weekdayIndex();
    const n = nextClass();
    const rest = d > 4 || !n ? [] : TIMETABLE_PERIODS.slice(n.row).filter((x) => x.subjects[d]);
    return { title: '오늘 남은 수업', count: `${rest.length}개`, items: rest.slice(0, 3).map((x) => ({ text: `${x.label} ${x.subjects[d]}`, done: false })) };
  }
  return null;
}

export function dots(p: Page): Dots | null {
  const m = p.main;
  const today = weekdayIndex();
  if (m.kind === 'habits' && m.habits[0]) return { label: m.habits.length === 1 ? m.habits[0].name : '이번 주 습관', days: [0, 1, 2, 3, 4, 5, 6].map((i) => m.habits.every((h) => h.week[i])), today };
  if (m.kind === 'log') return { label: '이번 주 기록', days: [0, 1, 2, 3, 4, 5, 6].map((i) => i === today && Object.values(m.values).some(Boolean)), today };
  return null;
}

export function nextItem(p: Page): NextItem | null {
  const m = p.main;
  if (m.kind === 'timetable') {
    const n = nextClass();
    return n ? { label: '다음 수업', title: n.subject, sub: `${n.period} ${n.time}` } : { label: '다음 수업', title: '오늘 수업 끝' };
  }
  if ('todos' in m) {
    const t = m.todos.find((x) => !x.done);
    return { label: '다음 할 일', title: t ? t.text : '오늘 다 했어요', sub: t?.subject };
  }
  if (m.kind === 'wrong') {
    const next = m.entries.map((e) => e.reviewAt).sort((a, b) => a - b)[0];
    return { label: '다음 복습', title: next ? shortEn(new Date(next)) : '아직 없어요', sub: next ? `${m.entries.length}문제 모아 둠` : undefined };
  }
  if (m.kind === 'log') {
    const empty = m.fields.find((f) => !m.values[f]);
    return { label: m.prompt ? '오늘의 질문' : '아직 비어 있어요', title: m.prompt ?? empty ?? '오늘 다 썼어요' };
  }
  if (m.kind === 'habits') {
    const d = weekdayIndex();
    const h = m.habits.find((x) => !x.week[d]);
    return { label: '오늘 남은 습관', title: h ? h.name : '오늘 다 했어요' };
  }
  return null;
}

export function fallback(p: Page): Fallback {
  const mins = Math.max(0, Math.round((Date.now() - p.updatedAt) / 60000));
  const sub = mins < 1 ? '방금 기록' : mins < 60 ? `${mins}분 전 기록` : mins < 1440 ? `${Math.round(mins / 60)}시간 전 기록` : `${Math.round(mins / 1440)}일 전 기록`;
  return { name: p.name, sub };
}

const available = (p: Page): WidgetTpl[] => (['bigNumber', 'shortList', 'dots', 'nextItem'] as WidgetTpl[]).filter((t) => ({ bigNumber, shortList, dots, nextItem })[t as 'bigNumber'](p) !== null);

/** What generation picks by default for this kind of page. */
export function defaultWidget(p: Page): Widget {
  const m = p.main;
  if ('todos' in m) return p.top ? { size: 'large', templates: ['bigNumber', 'shortList'] } : { size: 'large', templates: ['shortList'] };
  if (m.kind === 'habits') return { size: 'small', templates: ['dots'] };
  if (m.kind === 'timetable') return { size: 'small', templates: ['nextItem'] };
  if (m.kind === 'wrong' || m.kind === 'log') return { size: 'small', templates: ['bigNumber'] };
  return { size: 'small', templates: ['fallback'] };
}

/** 2–3 other template combos offered by "바꾸기". */
export function widgetOptions(p: Page): Widget[] {
  const av = available(p);
  const opts: Widget[] = [defaultWidget(p)];
  const push = (w: Widget) => {
    if (!opts.some((o) => o.size === w.size && o.templates.join() === w.templates.join())) opts.push(w);
  };
  if (av.includes('bigNumber') && av.includes('shortList')) push({ size: 'large', templates: ['bigNumber', 'shortList'] });
  av.forEach((t) => push({ size: 'small', templates: [t] }));
  if (av.includes('shortList')) push({ size: 'large', templates: ['shortList'] });
  push({ size: 'small', templates: ['fallback'] });
  return opts.slice(0, 4);
}

const TPL_NAME: Record<WidgetTpl, (p: Page) => string> = {
  bigNumber: (p) => (p.top?.kind === 'dday' ? 'd-day' : (bigNumber(p)?.label ?? '숫자')),
  shortList: (p) => shortList(p)?.title.replace(/ \d+개$/, '') ?? '목록',
  dots: () => '이번 주 점 체크',
  nextItem: (p) => nextItem(p)?.label ?? '다음 항목',
  fallback: () => '페이지 이름',
};

export function describeWidget(p: Page, w: Widget) {
  return w.templates.map((t) => TPL_NAME[t](p)).join(' + ');
}
