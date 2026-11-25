import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Live, liveLabel } from '@/lib/vibecode';
import { C } from '@/theme';
import { Icon, Star, T } from './ui';

/** A value that loops 0→1 while mounted (spin, shimmer, pulse). */
function useLoop(ms: number) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v, ms]);
  return v;
}

function useFade(on: boolean) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [on, v]);
  return v;
}

/** The brand star turning slowly: seyo is working. */
export function Spinner({ size = 18 }: { size?: number }) {
  const t = useLoop(1600);
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Star size={size} fill={C.blue} />
    </Animated.View>
  );
}

/**
 * Over a page while the AI changes it: the page stays in view under a soft veil, and a small
 * card shows the plan the AI wrote, ticking items off as its changes land.
 */
export function MakingOverlay({ on, live }: { on: boolean; live: Live | null }) {
  const fade = useFade(on);
  const pulse = useLoop(900);
  // stays mounted for the fade-out after `on` turns off
  const [shown, setShown] = useState(on);
  if (on && !shown) setShown(true);
  useEffect(() => {
    if (on) return;
    const t = setTimeout(() => setShown(false), 220);
    return () => clearTimeout(t);
  }, [on]);
  if (!shown) return null;
  const plan = live?.plan ?? [];
  const blocks = live?.blocks ?? 0;
  const dot = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
  return (
    <Animated.View pointerEvents={on ? 'auto' : 'none'} accessibilityLiveRegion="polite" style={[StyleSheet.absoluteFill, { opacity: fade, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
      <View style={{ width: 340, maxWidth: '100%', borderRadius: 20, backgroundColor: C.white, paddingVertical: 20, paddingHorizontal: 22, gap: 14, shadowColor: C.ink, shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, borderWidth: 1, borderColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Spinner />
          <T w={500} s={15} style={{ flex: 1 }} numberOfLines={1}>
            {liveLabel(live, true)}
          </T>
        </View>
        {plan.length > 0 && (
          <View style={{ gap: 10, paddingLeft: 2 }}>
            {plan.map((p, i) => {
              const done = i < blocks;
              const doing = i === Math.min(blocks, plan.length - 1) && !done;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                    {done ? (
                      <Icon name="check" size={14} stroke={2.2} />
                    ) : doing ? (
                      <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, opacity: dot }} />
                    ) : (
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.dot }} />
                    )}
                  </View>
                  <T s={13.5} c={done ? C.ink : doing ? C.ink2 : C.faint} numberOfLines={1} style={{ flex: 1 }}>
                    {p}
                  </T>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** A page-shaped placeholder that shimmers until the first part of a new page arrives. */
export function PageSkeleton({ label }: { label: string }) {
  const t = useLoop(1400);
  const o = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] });
  const bar = (w: number | `${number}%`, h = 12, bg: string = C.fill) => <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: bg }} />;
  return (
    <View style={{ flex: 1, padding: 34, gap: 26 }}>
      <Animated.View style={{ opacity: o, gap: 26 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 10 }}>
            {bar(48, 10)}
            {bar(150, 26)}
          </View>
          {bar(110, 44, C.blueSoft)}
        </View>
        <View style={{ gap: 0 }}>
          <View style={{ height: 1, backgroundColor: C.line, marginBottom: 6 }} />
          {[72, 58, 64].map((w, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 52, borderBottomWidth: 1, borderBottomColor: C.hair }}>
              {bar(18, 10)}
              <View style={{ flex: 1 }}>{bar(`${w}%`)}</View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.line }} />
            </View>
          ))}
        </View>
        {bar('40%', 10, C.pinkSoft)}
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Spinner />
        <T s={14} c={C.sub}>
          {label}
        </T>
      </View>
    </View>
  );
}
