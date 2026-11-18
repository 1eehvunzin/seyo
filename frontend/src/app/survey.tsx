import { router } from 'expo-router';
import { useRef } from 'react';
import { TextInputInstance, View } from 'react-native';
import { Field } from '@/components/Field';
import { OnboardingFrame } from '@/components/OnboardingFrame';
import { Chip, T } from '@/components/ui';
import { daysUntil, dday, longKo, parseLooseDate } from '@/lib/date';
import { isTeam, LOG_FIELDS, resolveBranch, SURVEY_COPY } from '@/lib/page';
import { useStore } from '@/store';
import { C } from '@/theme';

/** 03 · Q2 — Q1 답에 따라 분기 (시험 / 마감 / 기록 / 습관) */
export default function Survey() {
  const { answers, setAnswers } = useStore();
  const branch = resolveBranch(answers.purposes);
  const copy = SURVEY_COPY[branch];
  const team = isTeam(answers.purposes);
  const second = useRef<TextInputInstance>(null);
  const third = useRef<TextInputInstance>(null);

  let valid = true;
  let preview: string | null = null;
  let dateError = false;
  let past = false;

  if (branch === '시험' || branch === '마감') {
    const isExam = branch === '시험';
    const v = isExam ? answers.exam : answers.due;
    const name = isExam ? answers.exam.name : answers.due.task;
    const d = parseLooseDate(v.date);
    past = !!d && daysUntil(d) < 0;
    dateError = (v.date.trim().length > 0 && !d) || past;
    valid = name.trim().length > 0 && !!d && !past;
    if (d) preview = `${name.trim() || (isExam ? '시험' : '목표')} ${dday(d)}, ${longKo(d)}`;
  } else if (branch === '기록') {
    valid = answers.logs.length > 0;
  } else {
    valid = answers.habits.some((h) => h.trim());
  }

  return (
    <OnboardingFrame step={2} question={copy.question} helper={copy.helper} onNext={() => router.push('/unit')} nextDisabled={!valid}>
      {branch === '시험' && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Field
              label="시험 이름"
              placeholder="예: 중간고사"
              width={280}
              value={answers.exam.name}
              onChangeText={(name) => setAnswers({ exam: { ...answers.exam, name } })}
              returnKeyType="next"
              onSubmitEditing={() => second.current?.focus()}
            />
            <Field
              ref={second}
              label="날짜"
              width={220}
              value={answers.exam.date}
              placeholder="2026. 11. 30"
              keyboardType="numbers-and-punctuation"
              error={dateError}
              onChangeText={(date) => setAnswers({ exam: { ...answers.exam, date } })}
            />
          </View>
          <Hint error={dateError} past={past} preview={preview} />
        </View>
      )}

      {branch === '마감' && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Field
              label="목표"
              placeholder={team ? "예: 중간 발표" : "예: 레포트 제출"}
              width={320}
              value={answers.due.task}
              onChangeText={(task) => setAnswers({ due: { ...answers.due, task } })}
              returnKeyType="next"
              onSubmitEditing={() => second.current?.focus()}
            />
            <Field
              ref={second}
              label="날짜"
              width={200}
              value={answers.due.date}
              placeholder="11. 21 (금)"
              keyboardType="numbers-and-punctuation"
              error={dateError}
              onChangeText={(date) => setAnswers({ due: { ...answers.due, date } })}
            />
          </View>
          <Hint error={dateError} past={past} preview={preview} />
        </View>
      )}

      {branch === '기록' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {LOG_FIELDS.map((f) => {
            const on = answers.logs.includes(f);
            return <Chip key={f} label={f} on={on} onPress={() => setAnswers({ logs: on ? answers.logs.filter((x) => x !== f) : [...answers.logs, f] })} />;
          })}
        </View>
      )}

      {branch === '습관' && (
        <View style={{ gap: 10, width: 420, maxWidth: '100%' }}>
          {[0, 1, 2].map((i) => (
            <Field
              key={i}
              ref={i === 1 ? second : i === 2 ? third : undefined}
              accessibilityLabel={`습관 ${i + 1}`}
              value={answers.habits[i] ?? ''}
              placeholder={i === 2 ? '하나 더 (선택)' : i === 0 ? '예: 영단어 30개' : '예: 물 2L 마시기'}
              dashed={i === 2}
              returnKeyType={i < 2 ? 'next' : 'done'}
              onSubmitEditing={() => (i === 0 ? second.current?.focus() : i === 1 ? third.current?.focus() : undefined)}
              onChangeText={(v) => {
                const habits = [...answers.habits];
                habits[i] = v;
                setAnswers({ habits });
              }}
            />
          ))}
        </View>
      )}
    </OnboardingFrame>
  );
}

function Hint({ error, past, preview }: { error: boolean; past: boolean; preview: string | null }) {
  if (past)
    return (
      <T s={13} c={C.error}>
        이미 지난 날짜예요. 앞으로 남은 날짜를 적어 주세요.
      </T>
    );
  if (error)
    return (
      <T s={13} c={C.error}>
        날짜를 알아보지 못했어요. 2026. 11. 30 처럼 적어 주세요.
      </T>
    );
  if (!preview) return null;
  return (
    <T s={13} c={C.muted}>
      맨 위에 이렇게 들어가요: {preview}
    </T>
  );
}
