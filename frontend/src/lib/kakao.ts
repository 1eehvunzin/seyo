/**
 * Kakao login on the web: out to Kakao's login page, back to /auth/kakao?code=…, which the
 * server exchanges for a session (POST /auth/kakao/code).
 *
 * The app keeps its state in memory, so leaving the page would lose what the user just made:
 * the draft page (and a pending invite) ride along in sessionStorage and come back on return.
 * (iPad uses the native Kakao SDK instead; that needs a development build.)
 */
import { Page } from './page';

/** The key Kakao accepts as client_id for the web login (KAKAO_REST_KEY on the server must match). */
const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_KEY || '50d8dae991d26a67f7df5b4ee6f5bdbe';
const PENDING = 'seyo.kakao.pending';

export type KakaoPending = { state: string; draft: Page | null; invite: string | null };

export const kakaoRedirectUri = () => `${window.location.origin}/auth/kakao`;

export function startKakaoWeb(draft: Page | null, invite: string | null) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ state, draft, invite } satisfies KakaoPending));
  } catch {
    // storage full (a big photo page): log in anyway, the page just won't come along
    sessionStorage.setItem(PENDING, JSON.stringify({ state, draft: null, invite } satisfies KakaoPending));
  }
  const q = new URLSearchParams({ client_id: KAKAO_KEY, redirect_uri: kakaoRedirectUri(), response_type: 'code', state });
  window.location.assign(`https://kauth.kakao.com/oauth/authorize?${q}`);
}

/** What was saved before leaving for Kakao (once: it's removed as it's read). Null if the state doesn't match. */
export function takeKakaoPending(state: string | undefined): KakaoPending | null {
  const raw = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as KakaoPending;
    return state && p.state === state ? p : null;
  } catch {
    return null;
  }
}
