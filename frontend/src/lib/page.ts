import { ThemeId } from '@/theme';
import { addDays, parseLooseDate } from './date';
import { defaultWidget, describeWidget } from './widget';

/* ───────── page model ───────── */

export type Todo = { id: string; subject?: string; text: string; done: boolean; reviews?: boolean[]; /** start-of-day ms (team back-planning) */ due?: number };

export type Top =
  | { kind: 'dday'; label: string; date: string } // exam d-day or deadline countdown
  | { kind: 'streak'; label: string }; // log / habit pages

export type LogField = '오늘 기분' | '날씨' | '한 줄 일기' | '사진 한 장' | '읽은 책' | '감사한 일';

export type Main =
  | { kind: 'today3'; todos: Todo[]; laterCount: number }
  | { kind: 'portion'; todos: Todo[]; daysLeft: number }
  | { kind: 'focus'; todos: Todo[]; blocksDone: number }
  | { kind: 'review'; todos: Todo[] }
  /** team: who does what (subject = person) */
  | { kind: 'roles'; todos: Todo[] }
  /** team: interim deadlines planned back from the milestone */
  | { kind: 'milestones'; todos: Todo[]; goal: string }
  | {
      kind: 'log';
      fields: LogField[];
      values: Partial<Record<LogField, string>>;
      oneTap: boolean;
      prompt: string | null;
      remind: boolean;
    }
  | { kind: 'habits'; habits: { id: string; name: string; week: boolean[] }[]; remind: boolean }
  | {
      kind: 'wrong';
      photo: string | null;
      reasons: string[];
      reason: string | null;
      reviewInDays: number;
      notes: string[];
      units: string[] | null;
      unit: string | null;
      retryCount: number | null;
      stats: boolean;
      /** saved problems; reviewAt = start-of-day ms when it should be solved again */
      entries: { id: string; reason: string | null; unit: string | null; reviewAt: number }[];
    }
  | { kind: 'timetable' }
  /** 바이브 코딩: an HTML/JS app the AI wrote. `state` is what the app saved with seyo.save(). */
  | { kind: 'app'; html: string; state: Record<string, unknown> };

export type Side = 'timetable' | 'week' | null;

/**
 * Home widget — fixed templates only. Generation picks which page data goes in which template;
 * values are read live from the page (see lib/widget.ts).
 */
export type WidgetTpl = 'bigNumber' | 'shortList' | 'dots' | 'nextItem' | 'fallback';
export type Widget = { size: 'small' | 'large'; templates: WidgetTpl[] };

export type Person = { id: string; name: string; initial: string; bg: string };

export type Page = {
  widget: Widget;
  /** null = I made it (방장). Otherwise I was invited (멤버). */
  owner: Person | null;
  /** people I share this page with (owner view) */
  members: Person[];
  inviteToken: string;
  updatedAt: number;
  id: string;
  name: string;
  theme: ThemeId;
  top: Top | null;
  reason: string | null;
  main: Main;
  side: Side;
  memo: string | null; // null = no memo section
  big: boolean;
  dimDone: boolean;
  createdAt: number;
};

export type Change = 'theme' | 'big' | 'memo' | 'dim' | 'side' | 'name' | 'main';

let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/* ───────── onboarding answers ───────── */

export const PURPOSES = [
  '시험 공부',
  '수능 준비',
  '과제 · 레포트',
  '오답노트',
  '시간표',
  '필기 정리',
  '독서 기록',
  '다이어리',
  '습관 체크',
  '팀플 · 동아리',
  '일정 관리',
  '다꾸',
] as const;

export type Branch = '시험' | '마감' | '기록' | '습관';

const GROUP: Record<(typeof PURPOSES)[number], Branch> = {
  '시험 공부': '시험',
  '수능 준비': '시험',
  오답노트: '시험',
  시간표: '시험',
  '필기 정리': '시험',
  '과제 · 레포트': '마감',
  '팀플 · 동아리': '마감',
  '일정 관리': '마감',
  다이어리: '기록',
  다꾸: '기록',
  '독서 기록': '기록',
  '습관 체크': '습관',
};

const BRANCH_ORDER: Branch[] = ['시험', '마감', '기록', '습관'];

/** Most-picked group wins; ties go 시험 > 마감 > 기록 > 습관. */
export function resolveBranch(purposes: string[]): Branch {
  const count: Record<Branch, number> = { 시험: 0, 마감: 0, 기록: 0, 습관: 0 };
  purposes.forEach((p) => {
    const g = GROUP[p as keyof typeof GROUP];
    if (g) count[g]++;
  });
  return BRANCH_ORDER.reduce((best, b) => (count[b] > count[best] ? b : best), '시험' as Branch);
}

/** The picked purpose that represents the winning group, e.g. "시험 공부". */
export function primaryPurpose(purposes: string[], branch: Branch): string {
  // the first chip tapped in the winning group (pick order = priority)
  return purposes.find((p) => GROUP[p as keyof typeof GROUP] === branch) ?? PURPOSES.find((p) => GROUP[p] === branch)!;
}

export const LOG_FIELDS: LogField[] = ['오늘 기분', '날씨', '한 줄 일기', '사진 한 장', '읽은 책', '감사한 일'];

export type Answers = {
  purposes: string[];
  exam: { name: string; date: string };
  due: { task: string; date: string };
  logs: LogField[];
  habits: string[];
  pain: string | null;
  mood: ThemeId | null;
};

/** 팀플·동아리를 고르고 마감 그룹으로 분기했을 때만 팀 관점으로 묻는다 (과제·일정 관리만 고르면 혼자 하는 일). */
export function isTeam(purposes: string[]) {
  return purposes.includes('팀플 · 동아리') && resolveBranch(purposes) === '마감';
}

export const SURVEY_COPY: Record<Branch, { question: string; helper: string }> = {
  시험: { question: '가장 가까운 시험이 언제예요?', helper: '첫 페이지 맨 위에 d-day로 넣어 둘게요.' },
  마감: { question: '가장 중요한 마일스톤이 언제예요?', helper: '중간 발표, 제출일처럼 꼭 지켜야 하는 날을 맨 위에 d-day로 넣어 둘게요.' },
  기록: { question: '매일 남기고 싶은 걸 골라 주세요', helper: '고른 것들로 하루 한 장짜리 기록 칸을 만들어요.' },
  습관: { question: '매일 지키고 싶은 습관을 적어 주세요', helper: '2–3개면 충분해요. 체크표로 만들어 둘게요.' },
};

/* Q3: the pain point reshapes the first page. Each option carries the one-line reason shown on it. */
export type Pain = { label: string; reason: string; step: string };

export type PainSet = 'study' | 'keep' | 'team';

export const PAINS: Record<PainSet, Pain[]> = {
  team: [
    { label: '누가 뭘 맡았는지 헷갈려요', reason: '역할이 헷갈린다고 해서, 사람마다 맡은 일을 나눠 뒀어요', step: '사람별로 역할 나누기' },
    { label: '마감 직전에 다 몰려요', reason: '막판에 몰린다고 해서, 마일스톤까지 중간 마감을 거꾸로 잡아 뒀어요', step: '중간 마감 거꾸로 잡기' },
    { label: '서로 어디까지 했는지 몰라요', reason: '진행이 안 보인다고 해서, 다 같이 체크하는 칸으로 만들었어요. 팀원을 초대해 보세요', step: '함께 체크하는 칸 만들기' },
    { label: '회의하고 나면 정리가 안 돼요', reason: '회의 정리가 안 된다고 해서, 정한 것과 할 일을 한 장에 모았어요', step: '회의 정리 칸 넣기' },
  ],
  study: [
    { label: '계획은 세우는데 다 못 지켜요', reason: '계획을 다 못 지킨다고 해서, 오늘은 꼭 할 3개만 꺼내 뒀어요', step: '오늘 할 일을 3개로 줄이기' },
    { label: '뭐부터 해야 할지 모르겠어요', reason: '뭐부터 할지 모르겠다고 해서, 남은 날짜로 나눠 오늘 분량만 보여 드려요', step: '남은 날짜로 오늘 분량 나누기' },
    { label: '집중이 금방 깨져요', reason: '집중이 금방 깨진다고 해서, 25분 집중 블록과 타이머를 넣어 뒀어요', step: '25분 집중 블록 넣기' },
    { label: '공부한 걸 금방 까먹어요', reason: '금방 까먹는다고 해서, 1, 3, 7일 복습 칸을 붙여 뒀어요', step: '1, 3, 7일 복습 칸 붙이기' },
  ],
  keep: [
    { label: '귀찮아서', reason: '귀찮다고 해서, 눌러서 고르기만 하면 끝나게 만들었어요', step: '한 번 누르면 끝나게 만들기' },
    { label: '쓸 게 없어서', reason: '쓸 게 없다고 해서, 매일 질문 하나를 꺼내 둘게요', step: '오늘의 질문 넣기' },
    { label: '까먹어서', reason: '자꾸 까먹는다고 해서, 매일 밤 9시에 알려 드릴게요', step: '밤 9시 알림 켜기' },
  ],
};

export const UNIT_COPY: Record<Branch, { question: string; helper: string; set: PainSet }> = {
  시험: { question: '공부할 때 제일 힘든 게 뭐예요?', helper: '솔직하게 골라 주세요.', set: 'study' },
  마감: { question: '마감까지 갈 때 제일 힘든 게 뭐예요?', helper: '솔직하게 골라 주세요.', set: 'study' },
  기록: { question: '기록이 왜 자꾸 끊겨요?', helper: '제일 가까운 걸 하나만 골라 주세요.', set: 'keep' },
  습관: { question: '습관이 왜 자꾸 끊겨요?', helper: '제일 가까운 걸 하나만 골라 주세요.', set: 'keep' },
};

const TEAM_COPY = { question: '팀으로 할 때 제일 힘든 게 뭐예요?', helper: '우리 팀이 제일 자주 막히는 걸 골라 주세요.', set: 'team' as PainSet };

export function unitCopy(a: Pick<Answers, 'purposes'>) {
  return isTeam(a.purposes) ? TEAM_COPY : UNIT_COPY[resolveBranch(a.purposes)];
}

/** The chosen pain, or null when nothing in the current set is chosen yet. */
export function chosenPain(a: Answers): Pain | null {
  return PAINS[unitCopy(a).set].find((p) => p.label === a.pain) ?? null;
}

export function painFor(a: Answers): Pain {
  return chosenPain(a) ?? PAINS[unitCopy(a).set][0];
}

const PROMPTS = ['오늘 제일 오래 한 일은?', '오늘 웃었던 순간은?', '내일의 나에게 한마디', '오늘 새로 알게 된 것'];

/* ───────── first page: rule table (purpose × Q3 pain), no generation ─────────
 * The winning group decides Q2; inside it, the chip the user tapped first decides the page type.
 * Q3 then swaps the page's main block and the one-line reason shown on it.
 */

type Rule = { name: string; main: Main; side?: Side; memo?: string | null; reason?: string; step?: string; top?: Top | null; themeHint?: ThemeId };

const t3 = (rows: [string | undefined, string][], doneFirst = true): Todo[] =>
  rows.map(([subject, text], i) => ({ id: uid('t'), subject, text, done: doneFirst && i === 0 }));

/** Study pains (0 plan, 1 order, 2 focus, 3 forget) reshape a todo list. */
function studyMain(todos: Todo[], idx: number, daysLeft: number): Main {
  if (idx === 1) return { kind: 'portion', todos, daysLeft };
  if (idx === 2) return { kind: 'focus', todos, blocksDone: 1 };
  if (idx === 3) return { kind: 'review', todos: todos.map((t, i) => ({ ...t, reviews: [i === 0, false, false] })) };
  return { kind: 'today3', todos, laterCount: 3 };
}

const wrongMain = (over: Partial<Extract<Main, { kind: 'wrong' }>>): Main => ({
  kind: 'wrong',
  photo: null,
  reasons: ['계산 실수', '개념 부족', '시간 부족', '문제 잘못 읽음'],
  reason: null,
  reviewInDays: 3,
  notes: [],
  units: null,
  unit: null,
  retryCount: null,
  stats: false,
  entries: [],
  ...over,
});

const DUE_PURPOSES = ['과제 · 레포트', '팀플 · 동아리', '일정 관리'];

function ruleFor(purpose: string, a: Answers, painLabel: string, today: Date): Rule {
  const idx = PAINS.study.findIndex((p) => p.label === painLabel);
  const keep = PAINS.keep.findIndex((p) => p.label === painLabel);
  const team = PAINS.team.findIndex((p) => p.label === painLabel);
  const exam = a.exam.name.trim() || '시험';
  const goal = a.due.task.trim() || '목표';
  const target = parseLooseDate(DUE_PURPOSES.includes(purpose) ? a.due.date : a.exam.date, today);
  const daysLeft = Math.max(1, target ? Math.round((target.getTime() - addDays(today, 0).getTime()) / 86400000) : 7);
  const back = [0.3, 0.65, 0.9].map((r) => addDays(today, Math.max(0, Math.round(daysLeft * r) - 1)).getTime());
  const examTop: Top = { kind: 'dday', label: exam, date: a.exam.date };
  const goalTop: Top = { kind: 'dday', label: goal, date: a.due.date };
  const steps3 = (texts: string[]): Todo[] => texts.map((text, i) => ({ id: uid('t'), text, done: false, due: back[i] }));
  const pick = <T,>(arr: T[]) => arr[Math.max(0, idx)];

  switch (purpose) {
    case '수능 준비':
      return {
        name: `${exam} 플래너`,
        top: examTop,
        main: studyMain(t3([['국어', '비문학 3지문'], ['수학', '수2 기출 10문제'], ['영어', '단어 50개']]), idx, daysLeft),
        side: 'timetable',
      };
    case '오답노트':
      return {
        name: `${exam} 오답노트`,
        top: examTop,
        main: pick([
          wrongMain({}),
          wrongMain({ units: ['1단원', '2단원', '3단원', '4단원'], unit: '1단원', stats: true }),
          wrongMain({ retryCount: 0 }),
          wrongMain({ reviewInDays: 1 }),
        ]),
        reason: pick([
          '계획을 다 못 지킨다고 해서, 하루에 틀린 문제만 모아 두게 했어요',
          '뭐부터 할지 모르겠다고 해서, 단원별로 나누고 많이 틀린 단원이 보이게 했어요',
          '집중이 금방 깨진다고 해서, 한 문제씩 다시 푼 횟수만 세게 했어요',
          '금방 까먹는다고 해서, 다음 날 바로 다시 풀라고 알려 드려요',
        ]),
        step: pick(['틀린 문제 모으는 칸 만들기', '단원별로 나누기', '다시 푼 횟수 칸 넣기', '다음 날 다시 풀기 알림']),
        themeHint: 'rose',
      };
    case '시간표':
      return {
        name: '시간표',
        top: examTop,
        main: { kind: 'timetable' },
        memo: idx === 1 || idx === 3 ? '' : null,
        reason: pick([
          '계획을 다 못 지킨다고 해서, 다음 수업만 크게 보이게 했어요',
          '뭐부터 할지 모르겠다고 해서, 다음 수업과 수업 메모를 한 장에 뒀어요',
          '집중이 금방 깨진다고 해서, 지금 들어야 할 수업 하나만 표시해요',
          '금방 까먹는다고 해서, 수업이 끝나면 바로 적는 메모 칸을 붙였어요',
        ]),
        step: pick(['다음 수업 크게 보여 주기', '수업 메모 칸 넣기', '지금 수업 표시하기', '수업 메모 칸 넣기']),
        themeHint: 'sky',
      };
    case '필기 정리':
      return {
        name: '필기 정리',
        top: examTop,
        main: studyMain(t3([['수학', '2단원 공식 정리'], ['화학', '3단원 개념 요약'], ['영어', '본문 구문 정리']]), idx, daysLeft),
        memo: '',
      };
    case '과제 · 레포트':
      return {
        name: `${goal} 플래너`,
        top: goalTop,
        main: idx === 1 ? { kind: 'milestones', goal, todos: steps3(['자료 조사 끝내기', '초안 쓰기', '퇴고하고 제출']) } : studyMain(t3([[undefined, '자료 모으기'], [undefined, '초안 쓰기'], [undefined, '퇴고하기']]), idx, daysLeft),
        reason: idx === 1 ? '뭐부터 할지 모르겠다고 해서, 제출일까지 단계별 중간 마감을 잡아 뒀어요' : undefined,
        step: idx === 1 ? '제출일까지 단계 나누기' : undefined,
      };
    case '일정 관리':
      return {
        name: '일정 관리',
        top: goalTop,
        main: idx === 2 ? { kind: 'focus', todos: steps3(['준비물 챙기기', '중간 점검', '최종 확인']), blocksDone: 0 } : { kind: 'milestones', goal, todos: steps3(['준비물 챙기기', '중간 점검', '최종 확인']) },
        reason: idx === 0 ? '계획을 다 못 지킨다고 해서, 날짜마다 할 일 하나씩만 잡아 뒀어요' : idx === 1 ? '뭐부터 할지 모르겠다고 해서, 날짜 순서대로 할 일을 줄 세웠어요' : undefined,
        step: idx === 0 || idx === 1 ? '날짜별로 할 일 하나씩 잡기' : undefined,
      };
    case '팀플 · 동아리':
      return {
        name: `${goal} 준비`,
        top: goalTop,
        main: team === 1 ? { kind: 'milestones', goal, todos: steps3(['자료 조사 끝내기', '초안 합치기', '리허설']) } : { kind: 'roles', todos: t3([['나', '자료 조사'], ['팀원 1', '발표 자료 만들기'], ['팀원 2', '대본 정리']]) },
        memo: team === 3 ? '' : null,
      };
    case '다이어리':
    case '다꾸':
    case '독서 기록': {
      const must: LogField | null = purpose === '독서 기록' ? '읽은 책' : purpose === '다꾸' ? '사진 한 장' : null;
      const picked = a.logs.length ? a.logs : (['오늘 기분', '한 줄 일기'] as LogField[]);
      const fields = must && !picked.includes(must) ? [must, ...picked] : picked;
      return {
        name: purpose === '독서 기록' ? '독서 기록' : purpose === '다꾸' ? '오늘의 다꾸' : '하루 한 장',
        top: { kind: 'streak', label: '연속 기록' },
        main: { kind: 'log', fields, values: {}, oneTap: keep === 0, prompt: keep === 1 ? PROMPTS[today.getDate() % PROMPTS.length] : null, remind: keep === 2 },
        side: 'week',
        themeHint: purpose === '다꾸' ? 'rose' : undefined,
      };
    }
    case '습관 체크': {
      const list = a.habits.map((h) => h.trim()).filter(Boolean);
      return {
        name: '습관 체크',
        top: { kind: 'streak', label: '이번 주' },
        main: { kind: 'habits', habits: (list.length ? list : ['습관 1']).map((n) => ({ id: uid('h'), name: n, week: Array(7).fill(false) })), remind: keep === 2 },
        side: 'week',
        themeHint: 'mint',
      };
    }
    default: // 시험 공부
      return {
        name: `${exam} 플래너`,
        top: examTop,
        main: studyMain(t3([['수학', '쎈 p.84–92'], ['화학', '3단원 오답 정리'], ['영어', '영단어 day 15']]), idx, daysLeft),
        side: 'timetable',
      };
  }
}

export function buildFirstPage(a: Answers, today = new Date()): { page: Page; steps: string[] } {
  const branch = resolveBranch(a.purposes);
  const pain = painFor(a);
  const purpose = primaryPurpose(a.purposes, branch);
  const r = ruleFor(purpose, a, pain.label, today);
  const theme = a.mood ?? r.themeHint ?? 'butter';

  const page: Page = {
    id: uid('page'),
    name: r.name,
    theme,
    top: r.top ?? null,
    reason: r.reason ?? pain.reason,
    main: r.main,
    side: r.side ?? null,
    memo: r.memo ?? null,
    big: false,
    dimDone: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    owner: null,
    members: [],
    inviteToken: newToken(),
    widget: { size: 'small', templates: ['fallback'] },
  };
  page.widget = defaultWidget(page);

  const m = page.main;
  const topStep =
    page.top?.kind === 'dday'
      ? `${page.top.label} d-day 넣기`
      : m.kind === 'log'
        ? `${m.fields.slice(0, 3).join(', ')} 칸 만들기`
        : m.kind === 'habits'
          ? `${m.habits.map((h) => h.name).join(', ')} 체크표 만들기`
          : '첫 칸 만들기';
  const themeLabel = { butter: 'butter', sky: 'powder blue', rose: 'rose', clean: 'clean', mint: 'mint' }[theme];
  const steps = [`${purpose}용으로 구성하기`, topStep, r.step ?? pain.step, `${themeLabel} 색 입히기`, `이름 짓기: ${page.name}`, `홈 위젯 만들기: ${describeWidget(page, page.widget)}`];
  return { page, steps };
}


export const newToken = () => Math.random().toString(36).slice(2, 10);

export function tutorialExamples(page: Page) {
  // 바이브 코딩 pages: anything goes, so show the kinds of things people actually ask
  if (page.main.kind === 'app') return ['파스텔톤으로 바꿔줘', '글자 더 크게 해줘', '체크하면 귀여운 효과 넣어줘'];
  const top = page.top?.kind === 'dday' ? 'd-day 더 크게 보여줘' : '숫자 더 크게 보여줘';
  return ['하늘색으로 바꿔줘', top, '아래에 메모 칸 넣어줘'];
}

/* ───────── "말로 고치기" — local command parser ───────── */

export type CommandResult = { page: Page; change: Change } | { page: null; message: string };

export function applyCommand(page: Page, raw: string): CommandResult {
  const t = raw.trim();
  const p: Page = { ...page };
  const rename = t.match(/(?:이름|제목)(?:을|를)?\s*["'“]?(.+?)["'”]?\s*(?:으로|로)\s*(?:바꿔|해|지어)/);
  if (rename) return { page: { ...p, name: rename[1].trim() }, change: 'name' };
  if (/하늘|파란|파랑|블루|blue/i.test(t)) return { page: { ...p, theme: 'sky' }, change: 'theme' };
  if (/핑크|분홍|로즈|pink/i.test(t)) return { page: { ...p, theme: 'rose' }, change: 'theme' };
  if (/흰|하얀|하양|화이트|white|깔끔|회색|그레이/i.test(t)) return { page: { ...p, theme: 'clean' }, change: 'theme' };
  if (/노란|노랑|버터|옐로|yellow/i.test(t)) return { page: { ...p, theme: 'butter' }, change: 'theme' };
  if (/초록|민트|연두|그린|green/i.test(t)) return { page: { ...p, theme: 'mint' }, change: 'theme' };
  if (/작게|줄여/.test(t)) return { page: { ...p, big: false }, change: 'big' };
  if (/크게|키워/.test(t)) return { page: { ...p, big: true }, change: 'big' };
  if (/메모/.test(t) && /(빼|없애|지워)/.test(t)) return { page: { ...p, memo: null }, change: 'memo' };
  if (/메모/.test(t)) return { page: { ...p, memo: p.memo ?? '' }, change: 'memo' };
  if (/시간표|타임\s?테이블|time\s?table/i.test(t) && /(빼|없애|지워|숨겨)/.test(t)) return { page: { ...p, side: null }, change: 'side' };
  if (/시간표|타임\s?테이블|time\s?table/i.test(t)) return { page: { ...p, side: 'timetable' }, change: 'side' };
  if (/(끝난|완료|한 일|다 한).*(흐리|지워|숨|빼)|흐리게/.test(t)) return { page: { ...p, dimDone: true }, change: 'dim' };
  if (/(할 일|투두).*(추가|넣어)/.test(t)) {
    const m = t.match(/["'“](.+?)["'”]/);
    const main = p.main;
    if ('todos' in main) {
      return {
        page: { ...p, main: { ...main, todos: [...main.todos, { id: uid('t'), text: m?.[1] ?? '새 할 일', done: false }] } as Main },
        change: 'main',
      };
    }
  }
  return { page: null, message: '인터넷에 연결되면 말한 대로 바꿀 수 있어요' };
}

/* ───────── sample data so Home matches the design (오답노트, 시간표, 초대받은 영단어 챌린지) ───────── */

export const PEOPLE: Record<string, Person> = {
  jisu: { id: 'jisu', name: '지수', initial: '지', bg: '#D7E5F6' },
  minjun: { id: 'minjun', name: '민준', initial: '민', bg: '#D8E8E0' },
};
export const ME: Person = { id: 'me', name: '나', initial: '나', bg: '#F3DCEC' };

const common = (id: string, at: number) => ({
  id,
  reason: null,
  side: null,
  memo: null,
  big: false,
  dimDone: false,
  createdAt: at,
  updatedAt: at,
  owner: null,
  members: [],
  inviteToken: newToken(),
});

export function samplePages(): Page[] {
  const now = Date.now();
  const today = addDays(new Date(), 0).getTime();
  const wk = [true, true, false, true, true, false, false];
  const pages: Page[] = [
    {
      ...common('sample_wrong', now - 3000),
      name: '수학 오답노트',
      theme: 'rose',
      top: null,
      main: {
        kind: 'wrong',
        photo: null,
        reasons: ['계산 실수', '개념 부족', '시간 부족', '문제 잘못 읽음'],
        reason: '계산 실수',
        reviewInDays: 3,
        notes: ['부호 바꾸는 거 또 놓침'],
        units: null,
        unit: null,
        retryCount: null,
        stats: false,
        entries: [
          { id: 'e1', reason: '계산 실수', unit: null, reviewAt: today },
          { id: 'e2', reason: '개념 부족', unit: null, reviewAt: today },
          { id: 'e3', reason: '계산 실수', unit: null, reviewAt: today },
        ],
      },
      widget: { size: 'small', templates: ['bigNumber'] },
    },
    {
      ...common('sample_tt', now - 2000),
      name: '시간표',
      theme: 'sky',
      top: null,
      main: { kind: 'timetable' },
      widget: { size: 'small', templates: ['nextItem'] },
    },
    {
      ...common('sample_habit', now - 1000),
      name: '영단어 챌린지',
      theme: 'mint',
      top: { kind: 'streak', label: '이번 주' },
      main: { kind: 'habits', habits: [{ id: 'h_word', name: '하루 영단어 30개', week: wk }], remind: false },
      owner: PEOPLE.jisu,
      members: [PEOPLE.jisu],
      widget: { size: 'small', templates: ['dots'] },
    },
  ];
  return pages;
}
