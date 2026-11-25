/**
 * Client for seyo/backend. The store (src/store.tsx) syncs pages through it once logged in.
 * Set EXPO_PUBLIC_API_URL (e.g. http://192.168.0.10:8000 for a device on the same Wi-Fi).
 */
import { fetch as streamFetch } from 'expo/fetch';
import type { Change, Page, Person } from './page';
import { saveToken } from './session';

// an empty value (an unset CI variable) counts as not set
const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
let token: string | null = null;
/** where the app runs on the web (invite links point here) */
const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.sayitseyo.kr';

export type Me = Person & { plus: boolean; plusUntil: string | null; paywallSeen: boolean };
export type ServerPage = Page & { version: number };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Install id for the onboarding AI tries (before there is an account). Web keeps it in
 * localStorage; native keeps it for the session until a storage module is added.
 */
let installId: string | null = null;
export function deviceId(): string {
  if (installId) return installId;
  try {
    installId = globalThis.localStorage?.getItem('seyo.install') ?? null;
  } catch {}
  if (!installId) {
    installId = `i_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    try {
      globalThis.localStorage?.setItem('seyo.install', installId);
    } catch {}
  }
  return installId;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  // the server's detail strings are already user-facing Korean copy
  if (!res.ok) throw new ApiError(res.status, typeof data.detail === 'string' ? data.detail : '잠시 후 다시 해 주세요');
  return data as T;
}

/** 바이브 코딩 stream events (backend/app/code.py). */
export type AppEvent =
  | { t: 'code'; d: string }
  | { t: 'restart' }
  | { t: 'skills'; names: string[] }
  | { t: 'fixing'; issues: string[] }
  | { t: 'checking' }
  | { t: 'done'; html: string | null; summary: string; left: number }
  | { t: 'error'; message: string };

/**
 * Create (no html) or edit (html) a code app. Calls `on` for each event as it streams in;
 * resolves after the last one. Throws ApiError (402 = out of tries) before the stream starts.
 */
async function appStream(body: { prompt: string; html?: string | null; name?: string; error?: string; page?: Page; images?: string[] }, on: (e: AppEvent) => void): Promise<void> {
  const res = await streamFetch(`${BASE}/ai/app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as { detail?: unknown });
    throw new ApiError(res.status, typeof data.detail === 'string' ? data.detail : '잠시 후 다시 해 주세요');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const flush = (all: boolean) => {
    const lines = buf.split('\n');
    buf = all ? '' : (lines.pop() ?? '');
    for (const l of lines) if (l.trim()) on(JSON.parse(l) as AppEvent);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    flush(false);
  }
  buf += dec.decode();
  flush(true);
}

type Session = { accessToken: string; user: Me };
/** escalate: the fixed blocks can't do it → rebuild the page as a code app (appStream with `page`) */
export type EditResult = { page: Page | null; change: Change | null; changed: string[]; message: string; source: string; left: number; escalate?: boolean };
export type Usage = { limit: number; left: number; period: 'month' | 'trial' };
// a login keeps its token for API calls and across reloads (lib/session.ts)
const keep = (s: Session) => {
  token = s.accessToken;
  saveToken(token);
  return s.user;
};

export const api = {
  setToken: (t: string | null) => (token = t),
  loginApple: (identityToken: string, name?: string, nonce?: string) => call<Session>('POST', '/auth/apple', { identity_token: identityToken, name, nonce }).then(keep),
  loginKakao: (accessToken: string) => call<Session>('POST', '/auth/kakao', { access_token: accessToken }).then(keep),
  /** web: the code Kakao sent back to /auth/kakao */
  loginKakaoCode: (code: string, redirectUri: string) => call<Session>('POST', '/auth/kakao/code', { code, redirect_uri: redirectUri }).then(keep),
  me: () => call<Me>('GET', '/me'),
  paywallSeen: () => call<Me>('POST', '/me/paywall-seen'),
  deleteAccount: () => call<void>('DELETE', '/me'),

  pages: () => call<ServerPage[]>('GET', '/pages'),
  page: (id: string) => call<ServerPage>('GET', `/pages/${id}`),
  createPage: (page: Page) => call<ServerPage>('POST', '/pages', { page }),
  /** 402 = free limit (show the paywall), 409 = someone else saved first (refetch) */
  updatePage: (id: string, patch: Partial<Page>, baseVersion?: number) => call<ServerPage>('PATCH', `/pages/${id}`, { patch, base_version: baseVersion }),
  deletePage: (id: string) => call<void>('DELETE', `/pages/${id}`),

  resetInvite: (id: string) => call<{ inviteToken: string; inviteUrl: string }>('POST', `/pages/${id}/invite/reset`),
  kick: (id: string, userId: string) => call<void>('DELETE', `/pages/${id}/members/${userId}`),
  leave: (id: string) => call<void>('POST', `/pages/${id}/leave`),
  invite: (t: string) => call<{ pageName: string; owner: Person; memberCount: number }>('GET', `/invites/${t}`),
  join: (t: string) => call<ServerPage>('POST', `/invites/${t}/join`),

  /** 말로 새 페이지 (login required). The page comes back without sharing fields; 402 = out of tries. */
  generate: (prompt: string) => call<{ page: Omit<Page, 'owner' | 'members' | 'inviteToken' | 'createdAt' | 'updatedAt'>; steps: { key: string; text: string }[]; followUps: string[]; source: string; left: number }>('POST', '/ai/generate', { prompt }),
  /** 말로 고치기. Logged in → monthly quota; before login → onboarding tries (guest). 402 = out of tries. */
  /** a pasted Pinterest pin link → its image (data URL), attached as a reference */
  pinImage: (url: string) => call<{ image: string }>('POST', '/ref/pinterest', { url }),
  edit: (page: Page, command: string) => call<EditResult>('POST', token ? '/ai/edit' : '/ai/guest/edit', { page, command }),
  appStream,
  usage: () => call<Usage>('GET', token ? '/ai/usage' : '/ai/guest/usage'),
  loggedIn: () => token !== null,

  verifyPurchase: (signedTransaction: string) => call<Me>('POST', '/billing/apple', { signed_transaction: signedTransaction }),
  registerPush: (expoPushToken: string) => call<void>('POST', '/devices', { expo_push_token: expoPushToken }),
  /** the invite link opens the web app's /join/<token> (works without the app installed) */
  inviteUrl: (t: string) => `${WEB}/join/${t}`,
};
