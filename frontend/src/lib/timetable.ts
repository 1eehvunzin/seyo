import { weekdayIndex } from './date';

export const TIMETABLE_DAYS = ['월', '화', '수', '목', '금'];

/** subjects[i] = Mon..Fri */
export const TIMETABLE_PERIODS = [
  { label: '1교시', time: '08:40', subjects: ['국어', '영어', '수학', '과학', '국어'] },
  { label: '2교시', time: '09:40', subjects: ['영어', '수학', '국어', '영어', '사회'] },
  { label: '3교시', time: '10:40', subjects: ['과학', '국어', '체육', '수학', '영어'] },
  { label: '4교시', time: '11:40', subjects: ['수학', '사회', '영어', '국어', '수학'] },
  { label: '5교시', time: '13:30', subjects: ['사회', '과학', '수학', '음악', '과학'] },
  { label: '6교시', time: '14:30', subjects: ['체육', '미술', '과학', '사회', '창체'] },
  { label: '7교시', time: '15:30', subjects: ['창체', '미술', '', '체육', ''] },
];

/** Next class from now on today's timetable; null on weekends or after the last class. */
export function nextClass(now = new Date()) {
  const day = weekdayIndex(now);
  if (day > 4) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let r = 0; r < TIMETABLE_PERIODS.length; r++) {
    const p = TIMETABLE_PERIODS[r];
    const [h, m] = p.time.split(':').map(Number);
    if (h * 60 + m + 45 > mins && p.subjects[day]) return { row: r, subject: p.subjects[day], period: p.label, time: p.time };
  }
  return null;
}
