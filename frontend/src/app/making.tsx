import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { Icon, PrimaryButton, Screen, Star, T } from '@/components/ui';
import { C } from '@/theme';

/** 06 · 첫 페이지 만드는 중 — answers turn into steps one by one */
export default function Making() {
  const params = useLocalSearchParams<{ steps?: string }>();
  const steps: string[] = (() => {
    try {
      return JSON.parse(params.steps ?? '[]');
    } catch {
      return [];
    }
  })();
  const [step, setStep] = useState(0);
  const spin = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    });
    const t = setInterval(() => setStep((s) => (s >= steps.length ? s : s + 1)), 900);
    return () => {
      clearInterval(t);
      loop?.stop();
    };
  }, [spin, steps.length]);

  const ready = step >= steps.length;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 44 }}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Star size={72} fill={C.star} />
        </Animated.View>
        <View style={{ alignItems: 'center', gap: 28 }}>
          <T w={600} s={30} ls={-0.03} accessibilityLiveRegion="polite">
            {ready ? '첫 페이지가 나왔어요' : '첫 페이지를 만들고 있어요'}
          </T>
          <View accessibilityRole="summary" style={{ gap: 14, width: 360 }}>
            {steps.map((text, i) => {
              const done = i < step;
              return (
                <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <Icon name="check" size={16} stroke={2.2} /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.dot }} />}
                  </View>
                  <T s={15} c={done ? C.ink : C.faint} numberOfLines={1} style={{ flex: 1 }}>
                    {text}
                  </T>
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ height: 56 }}>{ready && <PrimaryButton label="열어 보기" onPress={() => router.replace('/demo')} style={{ paddingHorizontal: 40 }} />}</View>
      </View>
    </Screen>
  );
}
