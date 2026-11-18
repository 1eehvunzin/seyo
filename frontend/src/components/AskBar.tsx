import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, TextInput, TextInputInstance, View } from 'react-native';
import { applyCommand, Change, Page } from '@/lib/page';
import { C, F } from '@/theme';
import { Btn, IconButton, T } from './ui';

/** Page edit session: say a change → page updates, ring on what changed, one-tap undo. */
export function usePageEditor(initial: Page | null, onCommit?: (p: Page) => void) {
  const [own, setPage] = useState<Page | null>(null);
  const page = own ?? initial;
  const [history, setHistory] = useState<Page[]>([]);
  const [change, setChange] = useState<Change | null>(null);
  const [toast, setToast] = useState<{ text: string; undo: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const say = (text: string) => {
    if (!page || !text.trim()) return false;
    const r = applyCommand(page, text);
    if (!r.page) {
      flash(r.message, false);
      return false;
    }
    setHistory((h) => [...h, page]);
    setPage(r.page);
    onCommit?.(r.page);
    setChange(r.change);
    flash('바뀌었어요', true);
    return true;
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

  return { page, update, say, undo, change, toast, changed: history.length > 0 };
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
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  placeholder?: string;
  accent?: string;
  autoFocus?: boolean;
  height?: number;
}) {
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? accent : C.line,
        backgroundColor: C.white,
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
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="send"
        onSubmitEditing={onSend}
        blurOnSubmit={false}
        style={{ flex: 1, minWidth: 0, height: 44, fontFamily: F[400], fontSize: 15, color: C.ink }}
      />
      <IconButton name="pencil" label="펜슬로 쓰기" onPress={() => ref.current?.focus()} color={C.sub} iconSize={20} />
      <IconButton name="send" label="보내기" onPress={onSend} bg={C.ink} color={C.white} iconSize={18} />
    </View>
  );
}
