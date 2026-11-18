export const C = {
  ink: '#1D1D1F',
  ink2: '#3A3A3C',
  sub: '#515154',
  muted: '#6E6E73',
  faint: '#A1A1A6',
  dot: '#C7C7CC',
  line: '#D2D2D7',
  track: '#E5E5EA',
  hair: '#EDEDF0',
  fill: '#F5F5F7',
  white: '#FFFFFF',
  butter: '#F6F1CC',
  accent: '#D69AC9',
  accentSoft: '#FAEDF6',
  scrim: 'rgba(29, 29, 31, 0.32)',
  kakao: '#FEE500',
  /** row dividers inside a page */
  rowLine: 'rgba(29, 29, 31, 0.08)',
  /** underline under writable fields */
  fieldLine: 'rgba(29, 29, 31, 0.12)',
  /** empty checkbox ring */
  ring: 'rgba(29, 29, 31, 0.25)',
  /** translucent chip on a themed page card */
  glass: 'rgba(255, 255, 255, 0.75)',
  /** checked habit / done state */
  done: '#93BBAA',
  doneSoft: '#C9DED4',
  /** brand star on butter */
  star: '#B7D0EE',
  error: '#C2416B',
};

export const F = {
  200: 'Pretendard-ExtraLight',
  300: 'Pretendard-Light',
  400: 'Pretendard-Regular',
  500: 'Pretendard-Medium',
  600: 'Pretendard-SemiBold',
} as const;

export type Weight = keyof typeof F;

export const STAR = 'M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 8.7l7.1-.6z';

export type ThemeId = 'butter' | 'sky' | 'rose' | 'clean' | 'mint';

/** Moods offered in onboarding Q4 (mint is reachable only by asking for it). */
export const MOODS: ThemeId[] = ['butter', 'sky', 'rose', 'clean'];

export const THEMES: Record<ThemeId, { label: string; card: string; swatch: string; star: string }> = {
  butter: { label: 'butter', card: '#FBF8E2', swatch: '#F6F1CC', star: '#B7D0EE' },
  sky: { label: 'powder blue', card: '#E6EFF9', swatch: '#DCE8F6', star: '#FFFFFF' },
  rose: { label: 'rose', card: '#F8E6F1', swatch: '#F3DCEC', star: '#93BBAA' },
  clean: { label: 'clean', card: '#F5F5F7', swatch: '#F5F5F7', star: '#1D1D1F' },
  mint: { label: 'mint', card: '#E9F1EC', swatch: '#E9F1EC', star: '#93BBAA' },
};

export const TIMETABLE = {
  E: 'rgba(29, 29, 31, 0.05)',
  P: '#EBC6E2',
  M: '#C9DED4',
  B: '#C7DBF2',
  Y: '#EFE7B4',
};
