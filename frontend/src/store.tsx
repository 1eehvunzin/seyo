import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Answers, Page, PEOPLE, samplePages } from './lib/page';

type Store = {
  answers: Answers;
  setAnswers: (patch: Partial<Answers>) => void;
  /** Page made at the end of onboarding, before the user saves it by logging in. */
  draft: Page | null;
  setDraft: (p: Page | null) => void;
  pages: Page[];
  /** insert or replace; bumps updatedAt (the fallback widget shows it) */
  savePage: (p: Page) => void;
  /** merge fields into a stored page (keeps sharing fields another action may have changed) */
  patchPage: (id: string, patch: Partial<Page>) => void;
  removePage: (id: string) => void;
  getPage: (id: string) => Page | undefined;
  loggedIn: boolean;
  /** Logs in and keeps the draft as the first page. */
  login: (provider: 'apple' | 'kakao') => void;
  logout: () => void;
  plus: boolean;
  setPlus: (v: boolean) => void;
  /** The paywall shows once, on the first Home visit right after login. */
  paywallPending: boolean;
  consumePaywall: () => void;
  /** Invite link opened before login: joined right after login. */
  pendingInvite: string | null;
  setPendingInvite: (t: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

const initialAnswers = (): Answers => {
  return {
    purposes: [],
    exam: { name: '', date: '' },
    due: { task: '', date: '' },
    logs: [],
    habits: ['', '', ''],
    pain: null,
    mood: null,
  };
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [answers, setA] = useState<Answers>(initialAnswers);
  const [draft, setDraft] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [plus, setPlus] = useState(false);
  const [paywallPending, setPaywallPending] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  const setAnswers = useCallback((patch: Partial<Answers>) => setA((a) => ({ ...a, ...patch })), []);

  const savePage = useCallback((p: Page) => {
    const next = { ...p, updatedAt: Date.now() };
    setPages((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? next : x)) : [next, ...list]));
  }, []);

  const patchPage = useCallback((id: string, patch: Partial<Page>) => {
    setPages((list) => list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)));
  }, []);

  const removePage = useCallback((id: string) => setPages((list) => list.filter((p) => p.id !== id)), []);

  const login = useCallback(
    (_provider: 'apple' | 'kakao') => {
      setLoggedIn(true);
      setPages((list) => {
        if (list.length) return list;
        const rest = samplePages();
        // The design shows the first page already shared with two friends; seeded so 초대·내보내기 can be tried.
        return draft ? [{ ...draft, members: [PEOPLE.jisu, PEOPLE.minjun] }, ...rest] : rest;
      });
      setPaywallPending(true);
    },
    [draft],
  );

  const logout = useCallback(() => {
    setLoggedIn(false);
    setPages([]);
    setDraft(null);
    setPlus(false);
    setPaywallPending(false);
    setPendingInvite(null);
    setA(initialAnswers());
  }, []);

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
      getPage: (id) => pages.find((p) => p.id === id) ?? (draft?.id === id ? draft : undefined),
      loggedIn,
      login,
      logout,
      plus,
      setPlus,
      paywallPending,
      consumePaywall: () => setPaywallPending(false),
      pendingInvite,
      setPendingInvite,
    }),
    [answers, setAnswers, draft, pages, savePage, patchPage, removePage, loggedIn, login, logout, plus, paywallPending, pendingInvite],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
