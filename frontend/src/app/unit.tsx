import { router } from 'expo-router';
import { View } from 'react-native';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip } from '@/components/ui';
import { chosenPain, PAINS, unitCopy } from '@/lib/page';
import { useStore } from '@/store';

/**
 * 04 · Q3 고민 → 첫 페이지 구조를 바꿈.
 * 기록 · 습관은 "왜 자꾸 끊겨요?", 팀플 · 동아리는 팀 관점으로 묻는다.
 */
export default function Unit() {
  const { answers, setAnswers } = useStore();
  const copy = unitCopy(answers);
  const selected = chosenPain(answers)?.label ?? null;

  return (
    <OnboardingFrame step={3} question={copy.question} helper={copy.helper} onNext={() => router.push('/mood')} nextDisabled={!selected}>
      <View style={{ gap: 10, width: 460, maxWidth: '100%' }}>
        {PAINS[copy.set].map((p) => (
          <Chip key={p.label} label={p.label} on={selected === p.label} onPress={() => setAnswers({ pain: p.label })} h={60} radius={18} s={16} full />
        ))}
      </View>
    </OnboardingFrame>
  );
}
