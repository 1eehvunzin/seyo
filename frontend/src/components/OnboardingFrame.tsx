import { router } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { C } from '@/theme';
import { IconButton, PrimaryButton, Progress, Screen, T, useLayout } from './ui';

/** Shared shell for the four survey questions: back · progress · question · body · next. */
export function OnboardingFrame({
  step,
  back = true,
  question,
  helper,
  children,
  nextLabel = '다음',
  onNext,
  nextDisabled,
  maxWidth = 760,
}: {
  step: number;
  back?: boolean;
  question: string;
  helper: string;
  children: ReactNode;
  nextLabel?: string;
  onNext: () => void;
  nextDisabled?: boolean;
  maxWidth?: number;
}) {
  const { gutter, height } = useLayout();
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: gutter, paddingTop: 24, paddingBottom: 32 }}>
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {back ? <IconButton name="back" label="이전" onPress={() => router.back()} /> : <View style={{ width: 44 }} />}
            <Progress step={step} />
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ maxWidth, gap: height < 700 ? 28 : 44 }}>
              <View style={{ gap: 12 }}>
                <T w={600} s={34} lh={1.4} ls={-0.03}>
                  {question}
                </T>
                <T w={300} s={15} c={C.muted}>
                  {helper}
                </T>
              </View>
              {children}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <PrimaryButton label={nextLabel} onPress={onNext} disabled={nextDisabled} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
