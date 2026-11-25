/**
 * Sign in with Apple on the web: out to Apple (Services ID web.seyo.kr), back to /auth/apple with
 * the id_token in the URL fragment, which the server verifies (POST /auth/apple with the nonce).
 * No name/email scope, so Apple allows the fragment response (no server-side form_post needed).
 * Like Kakao, the draft page rides along in sessionStorage. (iPad: the native Apple button.)
 */
import { Page } from './page';

const SERVICE_ID = process.env.EXPO_PUBLIC_APPLE_SERVICE_ID || 'web.seyo.kr';
const PENDING = 'seyo.apple.pending';

export type ApplePending = { state: string; nonce: string; draft: Page | null; invite: string | null };

export const appleRedirectUri = () => `${window.location.origin}/auth/apple`;

const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export function startAppleWeb(draft: Page | null, invite: string | null) {
  const state = rand();
  const nonce = rand();
  const save = (d: Page | null) => sessionStorage.setItem(PENDING, JSON.stringify({ state, nonce, draft: d, invite } satisfies ApplePending));
  try {
    save(draft);
  } catch {
    save(null); // storage full (a big photo page): log in anyway
  }
  const q = new URLSearchParams({ client_id: SERVICE_ID, redirect_uri: appleRedirectUri(), response_type: 'code id_token', response_mode: 'fragment', state, nonce });
  window.location.assign(`https://appleid.apple.com/auth/authorize?${q}`);
}

/** Apple's answer from the URL fragment + what was saved before leaving (once). */
export function takeAppleReturn(): { idToken: string | null; error: string | null; pending: ApplePending | null } {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const raw = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING);
  let pending: ApplePending | null = null;
  try {
    pending = raw ? (JSON.parse(raw) as ApplePending) : null;
  } catch {
    pending = null;
  }
  if (pending && h.get('state') !== pending.state) pending = null;
  return { idToken: h.get('id_token'), error: h.get('error'), pending };
}
