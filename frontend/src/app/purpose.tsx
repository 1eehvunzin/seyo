import { router } from 'expo-router';
import { View } from 'react-native';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip } from '@/components/ui';
import { PURPOSES } from '@/lib/page';
import { useStore } from '@/store';

/** 02 · Q1 목적 (복수 선택) */
export default function Purpose() {
  const { answers, setAnswers } = useStore();
  const picked = answers.purposes;

  const toggle = (p: string) => setAnswers({ purposes: picked.includes(p) ? picked.filter((x) => x !== p) : [...picked, p] });

  return (
    <OnboardingFrame
      step={1}
      back={false}
      question="seyo를 어디에 쓸 계획이신가요?"
      helper={picked.length ? `여러 개 골라도 돼요. ${picked.length}개 골랐어요.` : '여러 개 골라도 돼요.'}
      onNext={() => router.push('/survey')}
      nextDisabled={!picked.length}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PURPOSES.map((p) => (
          <Chip key={p} label={p} on={picked.includes(p)} onPress={() => toggle(p)} />
        ))}
      </View>
    </OnboardingFrame>
  );
}
