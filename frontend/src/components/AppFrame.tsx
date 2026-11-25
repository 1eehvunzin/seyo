import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AppFrameProps, buildDoc, parseMsg } from '@/lib/appdoc';

type Slot = { key: number; doc: string; fade: Animated.Value };

/**
 * iPad: the app runs in a WebView. Links and navigation out of the app are blocked.
 * Double-buffered like the web frame: a new version loads in a hidden WebView and fades in once
 * it has loaded, so streaming previews and finished edits don't flash.
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
  const [shown, setShown] = useState(() => ({ html, slots: [{ key: 0, doc: buildDoc(html, state), fade: new Animated.Value(1) }] as Slot[], front: 0 }));
  if (shown.html !== html) {
    const front = shown.slots.find((s) => s.key === shown.front)!;
    const next = { key: shown.slots[shown.slots.length - 1].key + 1, doc: buildDoc(html, state), fade: new Animated.Value(0) };
    setShown({ html, slots: [front, next], front: shown.front });
  }
  const newest = shown.slots[shown.slots.length - 1].key;

  const loaded = (slot: Slot) => {
    if (slot.key !== newest || slot.key === shown.front) return;
    setShown((s) => ({ ...s, front: slot.key }));
    Animated.timing(slot.fade, { toValue: 1, duration: 220, useNativeDriver: true }).start(() =>
      setShown((s) => (s.front === slot.key ? { ...s, slots: s.slots.filter((x) => x.key === slot.key) } : s)),
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {shown.slots.map((s) => (
        <Animated.View key={s.key} pointerEvents={s.key === shown.front ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { opacity: s.fade }]}>
          <WebView
            originWhitelist={['about:*']}
            source={{ html: s.doc }}
            onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:')}
            onLoadEnd={() => loaded(s)}
            onMessage={(e) => {
              if (s.key !== newest) return; // only the newest version talks
              const m = parseMsg(e.nativeEvent.data);
              if (m?.seyo === 'save') save.current?.(m.state);
              else if (m?.seyo === 'error') fail.current?.(m.line ? `${m.message} (${m.line}번째 줄)` : m.message);
            }}
            javaScriptEnabled
            scrollEnabled
            keyboardDisplayRequiresUserAction={false}
            style={{ flex: 1, backgroundColor: 'transparent' }}
          />
        </Animated.View>
      ))}
    </View>
  );
}
