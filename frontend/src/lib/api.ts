/**
 * Client for seyo/backend. Screens still run on the local store; switch a screen over by calling
 * these instead of the store actions (see INTEGRATIONS.md, "앱 연결").
 * Set EXPO_PUBLIC_API_URL (e.g. http://192.168.0.10:8000 for a device on the same Wi-Fi).
 */
import type { Page, Person } from './page';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
let token: string | null = null;

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

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  // the server's detail strings are already user-facing Korean copy
  if (!res.ok) throw new ApiError(res.status, typeof data.detail === 'string' ? data.detail : '잠시 후 다시 해 주세요');
  return data as T;
}

type Session = { accessToken: string; user: Me };
const keep = (s: Session) => ((token = s.accessToken), s.user);

export const api = {
  setToken: (t: string | null) => (token = t),
  loginApple: (identityToken: string, name?: string) => call<Session>('POST', '/auth/apple', { identity_token: identityToken, name }).then(keep),
  loginKakao: (accessToken: string) => call<Session>('POST', '/auth/kakao', { access_token: accessToken }).then(keep),
  loginDev: (name = '나') => call<Session>('POST', '/auth/dev', { name }).then(keep),
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

  generate: (prompt: string) => call<{ page: Page; steps: { key: string; text: string }[]; followUps: string[]; source: 'claude' | 'rules' }>('POST', '/ai/generate', { prompt }),
  edit: (page: Page, command: string) => call<{ page: Page | null; change?: string; message?: string; source: string }>('POST', '/ai/edit', { page, command }),

  verifyPurchase: (signedTransaction: string) => call<Me>('POST', '/billing/apple', { signed_transaction: signedTransaction }),
  registerPush: (expoPushToken: string) => call<void>('POST', '/devices', { expo_push_token: expoPushToken }),
  inviteUrl: (t: string) => `${BASE}/join/${t}`,
};
