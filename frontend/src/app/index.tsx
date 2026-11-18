import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Star, T, useLayout } from '@/components/ui';
import { useStore } from '@/store';
import { C } from '@/theme';

/** 01 · 스플래시 */
export default function Splash() {
  const { loggedIn } = useStore();
  const { width, height } = useLayout();
  const fade = useState(() => new Animated.Value(0))[0];
  const done = useRef(false);

  const go = () => {
    if (done.current) return;
    done.current = true;
    router.replace(loggedIn ? '/home' : '/purpose');
  };

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t = setTimeout(go, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const star = Math.min(460, Math.min(width, height) * 0.55);

  return (
    <Pressable accessibilityLabel="seyo 시작하기" onPress={go} style={{ flex: 1, backgroundColor: C.butter, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Star size={star} fill={C.star} style={{ position: 'absolute', left: width / 2 - star / 2, top: height / 2 - star / 2 + star * 0.054 }} />
      <Animated.View style={{ alignItems: 'center', gap: 14, opacity: fade }}>
        <T s={84} ls={-0.05} style={{ lineHeight: 92 }}>
          seyo..
        </T>
        <T s={17}>software that shapes around you.</T>
      </Animated.View>
      <View />
    </Pressable>
  );
}
