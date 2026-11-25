import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppFrameProps, buildDoc, parseMsg } from '@/lib/appdoc';

type Slot = { key: number; doc: string };

/**
 * Web: the app runs in a sandboxed iframe (scripts only, no same-origin access).
 * Double-buffered: a new version (a streaming preview tick or a finished edit) loads in a hidden
 * frame and fades in once it has loaded, so the page never flashes white between versions.
 */
export function AppFrame({ html, state, onSave, live, onError }: AppFrameProps) {
  const save = useRef(onSave);
  const fail = useRef(onError);
  useEffect(() => {
    save.current = live ? undefined : onSave;
    fail.current = live ? undefined : onError;
  }, [live, onSave, onError]);

  // The doc only rebuilds when the code changes (with the data saved so far). Saves flow out,
  // never back in, so typing in the app doesn't reload it.
  const [shown, setShown] = useState(() => ({ html, slots: [{ key: 0, doc: buildDoc(html, state) }] as Slot[], front: 0 }));
  if (shown.html !== html) {
    const next = { key: shown.slots[shown.slots.length - 1].key + 1, doc: buildDoc(html, state) };
    // keep the one on screen, replace whatever was still loading behind it
    const front = shown.slots.find((s) => s.key === shown.front)!;
    setShown({ html, slots: [front, next], front: shown.front });
  }
  // iframe elements by slot key (a plain Map kept across renders; filled by ref callbacks)
  const [frames] = useState(() => new Map<number, HTMLIFrameElement>());
  const newest = shown.slots[shown.slots.length - 1].key;

  useEffect(() => {
    const on = (e: MessageEvent) => {
      // only the newest version talks (the outgoing one may still be on screen for a moment)
      if (!e.source || e.source !== frames.get(newest)?.contentWindow) return;
      const m = parseMsg(e.data);
      if (m?.seyo === 'save') save.current?.(m.state);
      else if (m?.seyo === 'error') fail.current?.(m.line ? `${m.message} (${m.line}번째 줄)` : m.message);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [newest, frames]);

  // the new frame sits on top and fades in; the old one stays under it until the fade is done
  const loaded = (key: number) => {
    setShown((s) => (key === s.slots[s.slots.length - 1].key && s.front !== key ? { ...s, front: key } : s));
    setTimeout(() => setShown((s) => (s.front === key && s.slots.length > 1 ? { ...s, slots: s.slots.filter((x) => x.key === key) } : s)), 260);
  };

  return (
    <View style={{ flex: 1 }}>
      {shown.slots.map((s) =>
        createElement('iframe', {
          key: s.key,
          ref: (el: HTMLIFrameElement | null) => (el ? frames.set(s.key, el) : frames.delete(s.key)),
          title: '페이지',
          srcDoc: s.doc,
          sandbox: 'allow-scripts allow-forms',
          onLoad: () => loaded(s.key),
          style: {
            position: 'absolute',
            inset: 0,
            border: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            display: 'block',
            opacity: s.key === shown.front ? 1 : 0,
            transition: 'opacity .22s ease',
            pointerEvents: s.key === shown.front ? 'auto' : 'none',
          },
        }),
      )}
    </View>
  );
}
