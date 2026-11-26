import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, TextInput, TextInputInstance, View } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { applyCommand, Change, Page } from '@/lib/page';
import { canBecomeApp } from '@/lib/page2app';
import { convertToApp, Live, liveLabel, repairApp, runApp } from '@/lib/vibecode';
import { C, F } from '@/theme';
import { MAX_ATTACH, usePastePhotos, useReferences } from '@/lib/attach';
import { AttachButton, AttachTray, RefStatus, refPlaceholder } from './Attach';
import { Btn, IconButton, noOutline, T } from './ui';

/**
 * Page edit session: say a change → AI edits the page, ring on what changed, one-tap undo.
 * The server (말로 고치기) can change any part of the page; offline it falls back to the local
 * rule menu. `left` = AI tries left (onboarding trial or this month); `limited` = out of tries.
 */
export function usePageEditor(initial: Page | null, onCommit?: (p: Page) => void) {
  const [own, setPage] = useState<Page | null>(null);
  const page = own ?? initial;
  const [history, setHistory] = useState<Page[]>([]);
  const [change, setChange] = useState<Change | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  /** code app being edited: progress line while the AI streams */
  const [live, setLive] = useState<Live | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repaired = useRef(new Set<string>());
  /** automatic repairs in a row (a fix that breaks again gets one more try, then stop) */
  const repairChain = useRef(0);

  const alive = useRef(true);
  /** this month's tries from the server (again after subscribing: plus has more) */
  const recheck = useCallback(() => {
    api
      .usage()
      .then((u) => alive.current && (setLeft(u.left), setLimited(u.left <= 0)))
      .catch(() => {}); // offline: rules only, no count to show
  }, []);
  useEffect(() => {
    alive.current = true;
    recheck();
    return () => {
      alive.current = false;
    };
  }, [recheck]);

  const flash = (text: string, undo: boolean) => {
    setToast({ text, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setToast(null);
      setChange(null);
    }, 4000);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** Direct edits (checkboxes, inputs) — no undo entry, no toast. */
  const update = useCallback(
    (p: Page) => {
      setPage(p);
      onCommit?.(p);
    },
    [onCommit],
  );

  const commit = (from: Page, next: Page, ch: Change | null, text: string) => {
    setHistory((h) => [...h, from]);
    setPage(next);
    onCommit?.(next);
    setChange(ch);
    flash(text, true);
  };

  /** Resolves true when the page changed (the caller clears the input). */
  /** `images`: photos attached to this request (design reference unless the words say otherwise). */
  const say = async (text: string, images?: string[]): Promise<boolean> => {
    if (!page || !text.trim() || busy) return false;
    setBusy(true);
    repairChain.current = 0;
    try {
      if (page.main.kind === 'app') {
        const app = page.main;
        const r = await runApp(text.trim(), app.html, setLive, page.name, undefined, undefined, images, page.device);
        if (r.left !== null) {
          setLeft(r.left);
          setLimited(r.left <= 0);
        }
        if (!r.html) {
          flash(r.summary, false);
          return false;
        }
        commit(page, { ...page, main: { ...app, html: r.html }, updatedAt: Date.now() }, 'main', r.summary);
        return true;
      }
      // pages page2app can draw go straight to 바이브 코딩: the AI edits the same design in
      // HTML (one call). The block editor was a slower extra call that also bent explicit design
      // asks ("까만 배경") into the nearest preset theme.
      const direct = canBecomeApp(page) || !!images?.length;
      const r = direct ? null : await api.edit(page, text.trim());
      if (r) {
        setLeft(r.left);
        setLimited(r.left <= 0);
      }
      if (!r || r.escalate) {
        // the fixed blocks can't do this: the page becomes a code app that does it
        const c = await convertToApp(page, text.trim(), setLive, images);
        if (c.left !== null) {
          setLeft(c.left);
          setLimited(c.left <= 0);
        }
        if (!c.page) {
          flash(c.summary || '잠시 문제가 생겼어요. 다시 말해 볼래요?', false);
          return false;
        }
        commit(page, c.page, 'main', c.summary);
        return true;
      }
      if (!r.page) {
        flash(r.message, false);
        return false;
      }
      // the server only edits the page's content; sharing fields stay as the app has them
      const next: Page = { ...page, ...r.page, id: page.id, owner: page.owner, members: page.members, inviteToken: page.inviteToken, createdAt: page.createdAt, updatedAt: Date.now() };
      commit(page, next, r.change, r.message || '바뀌었어요');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setLeft(0);
        setLimited(true);
        flash(e.message, false);
        return false;
      }
      if (page.main.kind === 'app') {
        flash(e instanceof Error && e.message ? e.message : '잠시 문제가 생겼어요. 다시 말해 볼래요?', false);
        return false;
      }
      // server unreachable or failing: the local rule menu still covers the basics
      const r = applyCommand(page, text);
      if (!r.page) {
        flash(r.message, false);
        return false;
      }
      commit(page, r.page, r.change, '바뀌었어요');
      return true;
    } finally {
      setBusy(false);
      setLive(null);
    }
  };

  /** A code app threw: fix it once per version of the code (free). */
  const repair = async (error: string) => {
    if (!page || page.main.kind !== 'app' || busy || repaired.current.has(page.main.html) || repairChain.current >= 2) return;
    repairChain.current += 1;
    const app = page.main;
    repaired.current.add(app.html);
    setBusy(true);
    flash('앱에 오류가 있어서 고치고 있어요', false);
    const fixed = await repairApp(app.html, error, setLive, page.name);
    setBusy(false);
    setLive(null);
    if (fixed && fixed !== app.html) commit(page, { ...page, main: { ...app, html: fixed }, updatedAt: Date.now() }, 'main', '오류를 고쳤어요');
    else flash('오류를 다 못 고쳤어요. 어떤 게 안 되는지 말해 주세요', false);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setPage(prev);
    onCommit?.(prev);
    setChange(null);
    setToast(null);
  };

  return { page, update, say, undo, repair, recheck, change, toast, busy, live, left, limited, changed: history.length > 0, progress: busy && (page?.main.kind === 'app' || live) ? liveLabel(live, page?.main.kind === 'app') : null };
}

export function Toast({ toast, onUndo }: { toast: { text: string; undo: boolean } | null; onUndo: () => void }) {
  const o = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(o, { toValue: toast ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [toast, o]);
  if (!toast) return null;
  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ opacity: o, height: 40, paddingLeft: 16, paddingRight: toast.undo ? 6 : 16, borderRadius: 20, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <T s={13.5} c={C.white}>
        {toast.text}
      </T>
      {toast.undo && (
        <Btn onPress={onUndo} style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.ink2, justifyContent: 'center' }}>
          <T s={12.5} c={C.white}>
            되돌리기
          </T>
        </Btn>
      )}
    </Animated.View>
  );
}

/** "이 페이지를 어떻게 바꿀까요?" bar. Pencil focuses the field so Apple Pencil Scribble can write into it. */
export function AskBar({
  value,
  onChangeText,
  onSend,
  placeholder = '이 페이지를 어떻게 바꿀까요?',
  accent = C.accent,
  autoFocus,
  height = 60,
  busy = false,
  disabled = false,
  photos,
  onPhotos,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  placeholder?: string;
  accent?: string;
  autoFocus?: boolean;
  height?: number;
  /** waiting for the AI: input locked, spinner instead of send */
  busy?: boolean;
  /** out of tries */
  disabled?: boolean;
  /** photos attached to the next request; pass both to show the photo button (paste works on web) */
  photos?: string[];
  onPhotos?: (photos: string[]) => void;
}) {
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const attach = !!onPhotos && !disabled;
  const room = MAX_ATTACH - (photos?.length ?? 0);
  const add = useCallback((more: string[]) => onPhotos?.([...(photos ?? []), ...more].slice(0, MAX_ATTACH)), [onPhotos, photos]);
  usePastePhotos(ref, add, attach && !busy);
  const refs = useReferences(add, room, ref);
  const active = (focused || !!value) && !disabled;
  const send = () => {
    if (!busy && !disabled && value.trim()) onSend();
  };
  return (
    <View style={{ gap: 10 }}>
    {!!photos?.length && <AttachTray photos={photos} onRemove={(i) => onPhotos?.(photos.filter((_, k) => k !== i))} />}
    {attach && <RefStatus refs={refs} />}
    <View
      style={{
        height,
        borderRadius: height / 2,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? accent : C.line,
        backgroundColor: disabled ? C.fill : C.white,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 24,
        paddingRight: 8,
        shadowColor: C.ink,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <TextInput
        ref={ref}
        accessibilityLabel="이 페이지 바꾸기"
        value={value}
        onChangeText={(v) => onChangeText(attach ? refs.take(v) : v)}
        placeholder={busy ? '바꾸는 중이에요' : refPlaceholder(refs, photos?.length ?? 0, placeholder)}
        placeholderTextColor={C.faint}
        autoFocus={autoFocus}
        editable={!busy && !disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="send"
        onSubmitEditing={send}
        blurOnSubmit={false}
        style={{ flex: 1, minWidth: 0, height: 44, fontFamily: F[400], fontSize: 15, color: busy ? C.sub : C.ink, ...noOutline }}
      />
      {attach && !busy && <AttachButton refs={refs} query={value} />}
      {!disabled && <IconButton name="pencil" label="펜슬로 쓰기" onPress={() => ref.current?.focus()} color={C.sub} iconSize={20} />}
      {busy ? (
        <View accessibilityLabel="바꾸는 중" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.white} size="small" />
        </View>
      ) : (
        <IconButton name="send" label="보내기" onPress={send} bg={disabled ? C.line : C.ink} color={C.white} iconSize={18} />
      )}
    </View>
    </View>
  );
}
