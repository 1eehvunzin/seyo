/**
 * seyo design system — same tokens as the landing (seyo_landing/assets/css/style.css):
 * Apple-gray ink scale + baby pink / baby blue. Pink and blue are fills (ink text on top),
 * never text colors; the deeper accents are for small marks (dots, rings, progress).
 */
export const C = {
  ink: '#1D1D1F',
  ink2: '#424245',
  sub: '#6E6E73',
  muted: '#86868B',
  faint: '#AEAEB2',
  dot: '#C7C7CC',
  line: '#E5E5EA',
  track: '#E5E5EA',
  hair: '#EDEDF0',
  fill: '#F5F5F7',
  white: '#FFFFFF',
  /** baby pink / blue (landing --pink, --blue and their soft tints) */
  pink: '#F8D7E2',
  pinkSoft: '#FCEDF2',
  blue: '#CFE2F6',
  blueSoft: '#EEF4FB',
  /** kept for the butter mood theme */
  butter: '#F6F1CC',
  /** marks and selected borders: the deep end of the "세요" pink↔blue shimmer */
  accent: '#EC8CB1',
  accentSoft: '#FCEDF2',
  accentBlue: '#79A8E6',
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
  /** brand star: baby blue with an ink outline (landing hero) */
  star: '#CFE2F6',
  error: '#C2416B',
};

/** landing cover: baby blue → baby pink */
export const BRAND_GRADIENT = ['#E3EEFA', '#FBE6EE'] as const;

/** radii from the landing: big panels 32, cards 20, inputs 14, pills full */
export const R = { lg: 32, md: 20, sm: 14 } as const;

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
  butter: { label: 'butter', card: '#FBF8E2', swatch: '#F6F1CC', star: '#CFE2F6' },
  sky: { label: 'powder blue', card: '#EEF4FB', swatch: '#CFE2F6', star: '#FFFFFF' },
  rose: { label: 'rose', card: '#FCEDF2', swatch: '#F8D7E2', star: '#CFE2F6' },
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
