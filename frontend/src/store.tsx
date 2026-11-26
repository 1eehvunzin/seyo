import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, Me, ServerPage } from './lib/api';
import { Answers, Page } from './lib/page';
import { loadToken, saveToken } from './lib/session';

/**
 * App state. Before login: the onboarding draft lives here only. After login (Apple / Kakao), pages
 * live on the server (Postgres) and this is their local copy:
 * - the session token is kept across reloads (lib/session.ts) and restored on launch
 * - a change shows at once and is sent to the server in the background (edits are batched)
 * - a page made on the device gets its server id when it's saved; the old id keeps working
 */
type Store = {
  answers: Answers;
  setAnswers: (patch: Partial<Answers>) => void;
  /** Page made during onboarding, before the user saves it by logging in. */
  draft: Page | null;
  setDraft: (p: Page | null) => void;
  pages: Page[];
  /** insert or replace (a new page is created on the server) */
  savePage: (p: Page) => void;
  /** merge fields into a stored page; sent to the server shortly after the last change */
  patchPage: (id: string, patch: Partial<Page>) => void;
  /** delete (owner) or leave (shared page) */
  removePage: (id: string) => void;
  getPage: (id: string) => Page | undefined;
  /** false until the saved session has been checked on launch */
  ready: boolean;
  loggedIn: boolean;
  me: Me | null;
  /** change the nickname (server first, then here) */
  setName: (name: string) => Promise<void>;
  /** 만 14세 이상 + 약관 동의: once per account, right after the first login */
  agree: () => Promise<void>;
  /** the soft paywall was shown once after onboarding: don't show it on its own again */
  markPaywallSeen: () => void;
  /**
   * After api.loginApple / api.loginKakaoCode succeeded: load the account and keep the draft as a
   * page. `draft` overrides the stored one (it came back from before a login redirect).
   */
  login: (provider: 'apple' | 'kakao', opts?: { draft?: Page | null }) => void;
  logout: () => void;
  plus: boolean;
  /** Invite link opened before login: joined right after login. */
  pendingInvite: string | null;
  setPendingInvite: (t: string | null) => void;
  /** Join a page from an invite link (logged in). Resolves with its id. */
  joinInvite: (token: string) => Promise<string>;
  /** A shared page: take the server's latest copy (skipped while local edits are waiting). */
  refreshPage: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

const initialAnswers = (): Answers => ({
  purposes: [],
  exam: { name: '', date: '' },
  due: { task: '', date: '' },
  logs: [],
  habits: ['', '', ''],
  pain: null,
  mood: null,
});

/** The page's own content (the server keeps sharing fields and timestamps itself). */
const SHARING = ['id', 'owner', 'members', 'inviteToken', 'createdAt', 'updatedAt', 'version'] as const;
function docOf(p: Partial<Page>): Partial<Page> {
  const out: Record<string, unknown> = { ...p };
  SHARING.forEach((k) => delete out[k]);
  return out as Partial<Page>;
}

const PATCH_DELAY = 700;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [answers, setA] = useState<Answers>(initialAnswers);
  const [draft, setDraft] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const loggedIn = !!me;

  /** local id → server id, for pages made on the device before the server answered */
  const alias = useRef(new Map<string, string>());
  const real = (id: string) => alias.current.get(id) ?? id;
  /** pages the server knows (ids) */
  const onServer = useRef(new Set<string>());
  /** batched edits per page */
  const pending = useRef(new Map<string, { patch: Partial<Page>; timer: ReturnType<typeof setTimeout> }>());

  const setAnswers = useCallback((patch: Partial<Answers>) => setA((a) => ({ ...a, ...patch })), []);

  const fromServer = (list: ServerPage[]) => {
    list.forEach((p) => onServer.current.add(p.id));
    return list as Page[];
  };

  const loadAccount = useCallback(async () => {
    const [m, list] = await Promise.all([api.me(), api.pages()]);
    setMe(m);
    setPages(fromServer(list));
    return m;
  }, []);

  // launch: restore the saved session
  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadToken();
      if (t) {
        api.setToken(t);
        try {
          await loadAccount();
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            api.setToken(null);
            saveToken(null);
          }
        }
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadAccount]);

  const createOnServer = useCallback((p: Page) => {
    api
      .createPage(docOf(p) as Page)
      .then((sp) => {
        onServer.current.add(sp.id);
        alias.current.set(p.id, sp.id);
        // keep whatever changed locally while the create was in flight
        setPages((list) => list.map((x) => (x.id === p.id ? { ...x, id: sp.id, inviteToken: sp.inviteToken, owner: sp.owner, members: sp.members } : x)));
      })
      .catch(() => {});
  }, []);

  const flush = useCallback((id: string) => {
    const job = pending.current.get(id);
    if (!job) return;
    pending.current.delete(id);
    const sid = real(id);
    if (!onServer.current.has(sid)) return;
    api.updatePage(sid, docOf(job.patch)).catch(() => {});
  }, []);

  const queuePatch = useCallback(
    (id: string, patch: Partial<Page>) => {
      const job = pending.current.get(id);
      if (job) clearTimeout(job.timer);
      const merged = { ...(job?.patch ?? {}), ...patch };
      pending.current.set(id, { patch: merged, timer: setTimeout(() => flush(id), PATCH_DELAY) });
    },
    [flush],
  );

  const savePage = useCallback(
    (p: Page) => {
      const next = { ...p, updatedAt: Date.now() };
      let isNew = false;
      setPages((list) => {
        const i = list.findIndex((x) => x.id === p.id || x.id === real(p.id));
        if (i < 0) {
          isNew = true;
          return [next, ...list];
        }
        return list.map((x, k) => (k === i ? { ...next, id: x.id } : x));
      });
      if (!loggedIn) return;
      if (isNew && !onServer.current.has(real(p.id))) createOnServer(next);
      else queuePatch(real(p.id), next);
    },
    [loggedIn, createOnServer, queuePatch],
  );

  const patchPage = useCallback(
    (id: string, patch: Partial<Page>) => {
      setPages((list) => list.map((x) => (x.id === id || x.id === real(id) ? { ...x, ...patch, id: x.id, updatedAt: Date.now() } : x)));
      if (loggedIn) queuePatch(real(id), patch);
    },
    [loggedIn, queuePatch],
  );

  const removePage = useCallback(
    (id: string) => {
      const sid = real(id);
      const page = pages.find((p) => p.id === sid || p.id === id);
      setPages((list) => list.filter((p) => p.id !== sid && p.id !== id));
      if (!loggedIn || !onServer.current.has(sid)) return;
      (page?.owner ? api.leave(sid) : api.deletePage(sid)).catch(() => {});
      onServer.current.delete(sid);
    },
    [loggedIn, pages],
  );

  const setName = useCallback(async (name: string) => {
    setMe(await api.setName(name));
  }, []);

  const agree = useCallback(async () => {
    setMe(await api.agree());
  }, []);

  const markPaywallSeen = useCallback(() => {
    setMe((m) => (m ? { ...m, paywallSeen: true } : m));
    api.paywallSeen().catch(() => {});
  }, []);

  const joinInvite = useCallback(async (t: string) => {
    const sp = await api.join(t);
    onServer.current.add(sp.id);
    setPages((list) => (list.some((x) => x.id === sp.id) ? list.map((x) => (x.id === sp.id ? sp : x)) : [sp, ...list]));
    return sp.id;
  }, []);

  const refreshPage = useCallback((id: string) => {
    const sid = real(id);
    if (!onServer.current.has(sid) || pending.current.has(sid)) return;
    api
      .page(sid)
      .then((sp) => {
        if (pending.current.has(sid)) return; // edited meanwhile: keep the local copy
        setPages((list) => list.map((x) => (x.id === sid ? (sp as Page) : x)));
      })
      .catch(() => {});
  }, []);

  const login = useCallback(
    (_provider: 'apple' | 'kakao', opts?: { draft?: Page | null }) => {
      const first = opts?.draft !== undefined ? opts.draft : draft;
      (async () => {
        const [m, list] = await Promise.all([api.me(), api.pages()]);
        setMe(m);
        const existing = fromServer(list);
        setPages(first ? [first, ...existing.filter((x) => x.id !== first.id)] : existing);
        setDraft(null);
        // the page made during onboarding becomes the account's first page
        if (first) createOnServer(first);
        if (pendingInvite) {
          joinInvite(pendingInvite).catch(() => {});
          setPendingInvite(null);
        }
      })().catch(() => {});
    },
    [draft, pendingInvite, createOnServer, joinInvite],
  );

  const logout = useCallback(() => {
    pending.current.forEach((_, id) => flush(id));
    api.setToken(null);
    saveToken(null);
    setMe(null);
    setPages([]);
    setDraft(null);
    setPendingInvite(null);
    setA(initialAnswers());
    alias.current.clear();
    onServer.current.clear();
  }, [flush]);

  // leaving the page: send edits still waiting
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const on = () => pending.current.forEach((_, id) => flush(id));
    window.addEventListener('pagehide', on);
    return () => window.removeEventListener('pagehide', on);
  }, [flush]);

  const value = useMemo<Store>(
    () => ({
      answers,
      setAnswers,
      draft,
      setDraft,
      pages,
      savePage,
      patchPage,
      removePage,
      getPage: (id) => pages.find((p) => p.id === id || p.id === alias.current.get(id)) ?? (draft?.id === id ? draft : undefined),
      ready,
      loggedIn,
      me,
      setName,
      agree,
      markPaywallSeen,
      login,
      logout,
      plus: !!me?.plus,
      pendingInvite,
      setPendingInvite,
      joinInvite,
      refreshPage,
    }),
    [answers, setAnswers, draft, pages, savePage, patchPage, removePage, ready, loggedIn, me, setName, agree, markPaywallSeen, login, logout, pendingInvite, joinInvite, refreshPage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
