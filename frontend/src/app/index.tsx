import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Star, T, useLayout, Wordmark } from '@/components/ui';
import { useStore } from '@/store';
import { C } from '@/theme';

/** 01 · 스플래시 */
export default function Splash() {
  const { loggedIn, ready } = useStore();
  const { width, height } = useLayout();
  const fade = useState(() => new Animated.Value(0))[0];
  const done = useRef(false);
  /** the splash has shown long enough (or was tapped) */
  const [shown, setShown] = useState(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t = setTimeout(() => setShown(true), 1800);
    return () => clearTimeout(t);
  }, [fade]);

  // leave once both the splash has shown and the saved login has been checked
  useEffect(() => {
    if (!shown || !ready || done.current) return;
    done.current = true;
    router.replace(loggedIn ? '/home' : '/start');
  }, [shown, ready, loggedIn]);
  const go = () => setShown(true);

  const star = Math.min(460, Math.min(width, height) * 0.55);

  return (
    <Pressable accessibilityLabel="seyo 시작하기" onPress={go} style={{ flex: 1, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Star size={star} fill={C.star} style={{ position: 'absolute', left: width / 2 - star / 2, top: height / 2 - star / 2 + star * 0.054 }} />
      <Animated.View style={{ alignItems: 'center', gap: 14, opacity: fade }}>
        <Wordmark height={76} />
        <T w={500} s={17} c={C.sub}>Say it, seyo..</T>
      </Animated.View>
      <View />
    </Pressable>
  );
}
