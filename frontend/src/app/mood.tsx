import { router } from 'expo-router';
import { View } from 'react-native';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Btn, Star, T, useLayout } from '@/components/ui';
import { buildFirstPage } from '@/lib/page';
import { useStore } from '@/store';
import { C, MOODS, THEMES } from '@/theme';

/** 05 · Q4 분위기 → 첫 페이지의 색 */
export default function Mood() {
  const { answers, setAnswers, setDraft } = useStore();
  const { compact, width, gutter } = useLayout();
  const cols = compact ? 2 : 4;
  const gap = 16;
  const inner = Math.min(width - gutter * 2, 1100);
  const cardW = (inner - gap * (cols - 1)) / cols;

  const make = () => {
    const { page, steps } = buildFirstPage(answers);
    setDraft(page);
    router.push({ pathname: '/making', params: { steps: JSON.stringify(steps) } });
  };

  return (
    <OnboardingFrame step={4} question="어떤 분위기가 좋아요?" helper="첫 페이지의 색이 돼요." nextLabel="첫 페이지 만들기" onNext={make} nextDisabled={!answers.mood} maxWidth={1100}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {MOODS.map((id) => {
          const m = THEMES[id];
          const on = answers.mood === id;
          return (
            <Btn
              key={id}
              accessibilityLabel={`${m.label} 분위기`}
              accessibilityState={{ selected: on }}
              onPress={() => setAnswers({ mood: id })}
              style={{
                width: cardW,
                height: compact ? 220 : 260,
                borderRadius: 22,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? C.accent : C.line,
                backgroundColor: C.white,
                padding: 12,
                gap: 12,
              }}
            >
              <View style={{ flex: 1, borderRadius: 14, backgroundColor: m.swatch, padding: 18, gap: 10, overflow: 'hidden' }}>
                <View style={{ width: '45%', height: 6, borderRadius: 3, backgroundColor: C.ink }} />
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ width: '80%', height: 1, backgroundColor: 'rgba(29, 29, 31, 0.15)' }} />
                ))}
                <Star size={56} fill={m.star} style={{ position: 'absolute', right: 12, bottom: 10 }} />
              </View>
              <T s={15} style={{ paddingLeft: 4 }}>
                {m.label}
              </T>
            </Btn>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}
