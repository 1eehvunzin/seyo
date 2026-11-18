import { ThemeId } from '@/theme';
import { addDays, dotted, parseLooseDate } from './date';
import { applyCommand, LogField, LOG_FIELDS, Main, newToken, Page, uid } from './page';
import { defaultWidget } from './widget';

/*
 * Local stand-in for the page generator. It reads a few keywords from what the user said and
 * assembles one of the fixed page blocks. A real model would replace `planFromPrompt`; the
 * screen only depends on its output shape (page + ordered build steps).
 */

export type BuildStep = { key: string; text: string };
export type Plan = { page: Page; steps: BuildStep[]; followUps: string[] };

const SUBJECTS = ['수학', '영어', '국어', '과학', '화학', '물리', '생명', '지구과학', '사회', '한국사', '역사'];

/** Templates on the empty preview side. Each is just a prompt, so it runs through the same builder as free text. */
export const TEMPLATES = [
  { id: 'exam', title: '시험 플래너', desc: 'd-day와 오늘 할 일', prompt: '중간고사 플래너 만들어줘. d-day랑 오늘 할 일, 시간표도' },
  { id: 'wrong', title: '오답노트', desc: '사진, 틀린 이유, 다시 풀기', prompt: '수학 오답노트 만들어줘. 문제 사진 붙이고, 틀린 이유 고를 수 있게, 3일 뒤에 다시 풀라고 알려줘' },
  { id: 'team', title: '팀플 보드', desc: '역할 나누기와 함께 체크', prompt: '팀플 발표 준비 페이지. 역할 나누고 같이 체크' },
  { id: 'tt', title: '시간표', desc: '다음 수업이 바로 보여요', prompt: '시간표 만들어줘' },
  { id: 'habit', title: '습관 체크', desc: '이번 주 점 체크', prompt: '물 마시기랑 스트레칭 습관 체크표 만들어줘' },
  { id: 'diary', title: '하루 한 장', desc: '기분, 날씨, 한 줄 일기', prompt: '기분이랑 날씨, 한 줄 일기 쓰는 다이어리' },
  { id: 'book', title: '독서 기록', desc: '읽은 책과 감사한 일', prompt: '읽은 책이랑 감사한 일 기록하는 독서 기록' },
];

export const PROMPT_EXAMPLES = [
  '수학 오답노트 만들어줘. 문제 사진 붙이고, 틀린 이유 고를 수 있게, 3일 뒤에 다시 풀라고 알려줘',
  '매일 물 마시기랑 스트레칭 습관 체크표 만들어줘',
  '기분이랑 날씨, 한 줄 일기 쓰는 다이어리',
];

function themeFrom(t: string, fallback: ThemeId): ThemeId {
  if (/하늘|파란|블루/.test(t)) return 'sky';
  if (/핑크|분홍|로즈/.test(t)) return 'rose';
  if (/흰|하얀|깔끔/.test(t)) return 'clean';
  if (/노란|버터/.test(t)) return 'butter';
  if (/초록|민트/.test(t)) return 'mint';
  return fallback;
}

const base = (name: string, theme: ThemeId, main: Main): Page => ({
  id: uid('page'),
  name,
  theme,
  top: null,
  reason: null,
  main,
  side: null,
  memo: null,
  big: false,
  dimDone: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  owner: null,
  members: [],
  inviteToken: newToken(),
  widget: { size: 'small', templates: ['fallback'] },
});

export function planFromPrompt(text: string): Plan {
  const t = text.trim();
  const subject = SUBJECTS.find((s) => t.includes(s));
  const widgetStep = { key: 'widget', text: '홈 위젯 고르기' };

  /* 오답노트 */
  if (/오답|틀린 문제/.test(t)) {
    const wantPhoto = /사진|찍/.test(t);
    const wantReason = /이유|왜 틀/.test(t);
    const days = Number(t.match(/(\d+)\s*일\s*(뒤|후)/)?.[1] ?? 0);
    const wantReview = days > 0 || /다시|복습|알려/.test(t);
    const all = !wantPhoto && !wantReason && !wantReview;
    const reviewInDays = days || 3;
    const page = base(`${subject ? `${subject} ` : ''}오답노트`, themeFrom(t, 'rose'), {
      kind: 'wrong',
      photo: null,
      reasons: ['계산 실수', '개념 부족', '시간 부족', '문제 잘못 읽음'],
      reason: null,
      reviewInDays,
      notes: [],
      units: null,
      unit: null,
      retryCount: null,
      stats: false,
      entries: [],
    });
    const steps: BuildStep[] = [];
    if (all || wantPhoto) steps.push({ key: 'photo', text: '문제 사진 칸' });
    if (all || wantReason) steps.push({ key: 'reason', text: '틀린 이유 고르기' });
    if (all || wantReview) steps.push({ key: 'review', text: `${reviewInDays}일 뒤 다시 풀기 알림` });
    steps.push({ key: 'notes', text: '풀이 메모 칸' });
    steps.push(widgetStep);
    page.widget = defaultWidget(page);
    return { page, steps, followUps: ['단원별로 나눠줘', '다시 푼 횟수 표시'] };
  }

  /* 팀플 */
  if (/팀플|팀 프로젝트|동아리|역할/.test(t)) {
    const label = t.match(/(발표|공모전|프로젝트|축제|행사|과제)/)?.[1] ?? '팀플';
    const page = base(`${label} 준비`, themeFrom(t, 'butter'), {
      kind: 'roles',
      todos: ['나', '팀원 1', '팀원 2'].map((subject) => ({ id: uid('t'), subject, text: '', done: false })),
    });
    page.top = { kind: 'dday', label, date: dotted(addDays(new Date(), 14)) };
    page.widget = defaultWidget(page);
    return {
      page,
      steps: [{ key: 'top', text: `${label} d-day (날짜는 눌러서 바꾸기)` }, { key: 'body', text: '사람별로 역할 나누기' }, widgetStep],
      followUps: ['아래에 메모 칸 넣어줘', '할 일 추가해줘'],
    };
  }

  /* 시간표 */
  if (/시간표|수업/.test(t)) {
    const page = base('시간표', themeFrom(t, 'sky'), { kind: 'timetable' });
    page.widget = defaultWidget(page);
    return { page, steps: [{ key: 'body', text: '월–금 시간표 칸' }, { key: 'next', text: '다음 수업 알려 주기' }, widgetStep], followUps: ['하늘색으로 바꿔줘', '아래에 메모 칸 넣어줘'] };
  }

  /* 습관 */
  if (/습관|챌린지|매일/.test(t) && !/일기|기록|다이어리/.test(t)) {
    const names = t
      .replace(/(매일|습관|체크표|체크|만들어\s*줘|만들어|하고 싶어|챌린지)/g, ' ')
      .split(/,|랑|이랑|하고|그리고|및|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 16);
    const habits = (names.length ? names : ['습관 1', '습관 2']).slice(0, 5);
    const page = base('습관 체크', themeFrom(t, 'mint'), { kind: 'habits', habits: habits.map((name) => ({ id: uid('h'), name, week: Array(7).fill(false) })), remind: /알려|알림|까먹/.test(t) });
    page.top = { kind: 'streak', label: '이번 주' };
    page.side = 'week';
    page.widget = defaultWidget(page);
    return { page, steps: [{ key: 'body', text: `${habits.join(', ')} 체크표` }, { key: 'week', text: '이번 주 한눈에 보기' }, widgetStep], followUps: ['초록색으로 바꿔줘', '아래에 메모 칸 넣어줘'] };
  }

  /* 기록 */
  if (/일기|기록|다이어리|다꾸|독서|읽은/.test(t)) {
    const map: [RegExp, LogField][] = [
      [/기분/, '오늘 기분'],
      [/날씨/, '날씨'],
      [/일기|한 줄/, '한 줄 일기'],
      [/사진/, '사진 한 장'],
      [/책|독서|읽은/, '읽은 책'],
      [/감사/, '감사한 일'],
    ];
    const fields = map.filter(([r]) => r.test(t)).map(([, f]) => f);
    const list = fields.length ? LOG_FIELDS.filter((f) => fields.includes(f)) : (['오늘 기분', '한 줄 일기'] as LogField[]);
    const page = base(/독서|책/.test(t) ? '독서 기록' : '하루 한 장', themeFrom(t, 'butter'), { kind: 'log', fields: list, values: {}, oneTap: false, prompt: null, remind: /알려|알림/.test(t) });
    page.top = { kind: 'streak', label: '연속 기록' };
    page.side = 'week';
    page.widget = defaultWidget(page);
    return { page, steps: [{ key: 'body', text: `${list.join(', ')} 칸` }, { key: 'week', text: '이번 주 기록 보기' }, widgetStep], followUps: ['하늘색으로 바꿔줘', '아래에 메모 칸 넣어줘'] };
  }

  /* 할 일 · 플래너 (기본) */
  const dateMatch = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})[./](\d{1,2})/);
  const date = dateMatch ? parseLooseDate(dateMatch[0]) : null;
  const label = t.match(/(중간고사|기말고사|수능|모의고사|시험|발표|마감)/)?.[1];
  const page = base(label ? `${label} 플래너` : '할 일', themeFrom(t, 'butter'), {
    kind: 'today3',
    todos: [0, 1, 2].map(() => ({ id: uid('t'), text: '', done: false })),
    laterCount: 0,
  });
  if (label) page.top = { kind: 'dday', label, date: dotted(date ?? addDays(new Date(), 14)) };
  if (/시간|타임/.test(t)) page.side = 'timetable';
  page.widget = defaultWidget(page);
  const steps: BuildStep[] = [];
  if (label) steps.push({ key: 'top', text: `${label} d-day${date ? '' : ' (날짜는 눌러서 바꾸기)'}` });
  steps.push({ key: 'body', text: '오늘 할 일 3칸' });
  steps.push(widgetStep);
  return { page, steps, followUps: ['아래에 메모 칸 넣어줘', 'd-day 더 크게 보여줘'] };
}

/** Follow-up while generating ("이어서 말해 보기"). Returns the changed page and a step line, or a hint. */
export function followUp(page: Page, text: string): { page: Page; step: string } | { page: null; message: string } {
  const m = page.main;
  if (m.kind === 'wrong' && /단원/.test(text)) {
    const units = ['1단원', '2단원', '3단원', '4단원'];
    return { page: { ...page, main: { ...m, units, unit: units[0], stats: true } }, step: '단원별로 나누기' };
  }
  if (m.kind === 'wrong' && /횟수|몇 번/.test(text)) return { page: { ...page, main: { ...m, retryCount: 0 } }, step: '다시 푼 횟수 칸' };
  if (m.kind === 'wrong' && /통계/.test(text)) return { page: { ...page, main: { ...m, stats: true } }, step: '틀린 이유별 통계' };
  const r = applyCommand(page, text);
  if (!r.page) return { page: null, message: r.message };
  const label: Record<string, string> = { theme: '색 바꾸기', big: '크기 바꾸기', memo: '메모 칸', dim: '끝난 일 흐리게', side: '시간표 칸', name: '이름 바꾸기', main: '할 일 추가' };
  return { page: r.page, step: label[r.change] };
}
