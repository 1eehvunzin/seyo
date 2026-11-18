const EN_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** "11.18 wed" */
export function shortEn(d: Date) {
  return `${d.getMonth() + 1}.${d.getDate()} ${EN_DAYS[d.getDay()]}`;
}

/** "11월 18일 수요일" */
export function longKo(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${KO_DAYS[d.getDay()]}요일`;
}

/** "2026. 11. 30" */
export function dotted(d: Date) {
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

/** "11. 21 (금)" */
export function monthDayKo(d: Date) {
  return `${d.getMonth() + 1}. ${d.getDate()} (${KO_DAYS[d.getDay()]})`;
}

/**
 * Parses loose Korean date input: "2026. 11. 30", "11. 21 (금)", "11/21", "11월 21일".
 * Missing year → the next occurrence from today.
 */
export function parseLooseDate(input: string, today = new Date()): Date | null {
  const nums = input.match(/\d+/g)?.map(Number) ?? [];
  let y: number | undefined, m: number, d: number;
  if (nums.length >= 3 && nums[0] > 31) [y, m, d] = nums;
  else if (nums.length >= 2) [m, d] = nums;
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const base = startOfDay(today);
  let date = new Date(y ?? base.getFullYear(), m - 1, d);
  if (y === undefined && date < base) date = new Date(base.getFullYear() + 1, m - 1, d);
  return date;
}

export function daysUntil(target: Date, today = new Date()) {
  return Math.round((startOfDay(target).getTime() - startOfDay(today).getTime()) / 86400000);
}

/** "D-12", "D-DAY", "D+3" */
export function dday(target: Date | null, today = new Date()) {
  if (!target) return 'D-?';
  const n = daysUntil(target, today);
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

export const WEEK_KO = ['월', '화', '수', '목', '금', '토', '일'];

/** Monday-based index of today (0 = 월) */
export function weekdayIndex(d = new Date()) {
  return (d.getDay() + 6) % 7;
}
