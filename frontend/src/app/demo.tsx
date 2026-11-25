import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AskBar, Toast, usePageEditor } from '@/components/AskBar';
import { MakingOverlay } from '@/components/Making';
import { PageCanvas } from '@/components/PageCanvas';
import { LoginSheet } from '@/components/Sheets';
import { Btn, Screen, T, useLayout } from '@/components/ui';
import { tutorialExamples } from '@/lib/page';
import { useStore } from '@/store';
import { C } from '@/theme';

/** 07 · 튜토리얼 → 저장하고 시작하기 → 로그인 모달 */
export default function Demo() {
  const { draft, setDraft, login } = useStore();
  const { appGutter } = useLayout();
  const ed = usePageEditor(draft, setDraft);
  const [text, setText] = useState('');
  /** photos attached to the next request */
  const [photos, setPhotos] = useState<string[]>([]);
  const [loginOpen, setLoginOpen] = useState(false);

  if (!draft) return <Redirect href="/start" />;
  const page = ed.page ?? draft;

  const send = async () => {
    if (await ed.say(text, photos)) {
      setText('');
      setPhotos([]);
    }
  };
  // onboarding tries: shown once there's a count from the server (offline = rules, no count)
  const triesLine = ed.left === null || ed.limited ? null : `무료로 ${ed.left}번 더 바꿀 수 있어요`;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: appGutter, paddingTop: 12, paddingBottom: 20, gap: 16 }}>
          <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T w={600} s={16} accessibilityRole="header">
              {page.name}
            </T>
            <View style={{ position: 'absolute', right: 0 }}>
              <Toast toast={loginOpen ? null : ed.toast} onUndo={ed.undo} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <PageCanvas page={page} onChange={ed.update} highlight={ed.change} onAppError={ed.repair} />
            <MakingOverlay on={ed.busy} live={ed.live} />
          </View>

          <View style={{ gap: 10 }}>
            {/* out of tries: say so right away (the input below is locked) */}
            {!ed.changed && !ed.limited ? (
              <View style={{ gap: 10, alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.ink }}>
                    <T s={14} c={C.white}>
                      마음에 안 드는 곳을 여기에 말해 보세요
                    </T>
                  </View>
                  <View style={{ width: 10, height: 10, marginTop: -5, backgroundColor: C.ink, transform: [{ rotate: '45deg' }] }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {tutorialExamples(page).map((e) => (
                    <Btn key={e} onPress={() => setText(e)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, justifyContent: 'center' }}>
                      <T s={13.5} c={C.ink2}>
                        {e}
                      </T>
                    </Btn>
                  ))}
                  <Btn onPress={() => setLoginOpen(true)} style={{ height: 36, paddingHorizontal: 14, justifyContent: 'center' }}>
                    <T s={13.5} c={C.sub} style={{ textDecorationLine: 'underline' }}>
                      이대로 저장하기
                    </T>
                  </Btn>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingLeft: 20, paddingRight: 12, borderRadius: 18, backgroundColor: C.fill, gap: 12 }}>
                <T s={14.5} style={{ flex: 1 }}>
                  {ed.limited ? '저장하고 시작하면 무료로 계속 바꿀 수 있어요.' : '이렇게 말하면 언제든 바뀌어요. 마음에 들면 저장해요.'}
                </T>
                <Btn onPress={() => setLoginOpen(true)} style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center' }}>
                  <T s={14.5} c={C.white}>
                    저장하고 시작하기
                  </T>
                </Btn>
              </View>
            )}
            <AskBar photos={photos} onPhotos={setPhotos} value={text} onChangeText={setText} onSend={send} busy={ed.busy} disabled={ed.limited} placeholder={ed.limited ? '저장하고 시작하면 무료로 계속 바꿀 수 있어요' : undefined} />
            {triesLine && (
              <T s={12.5} c={C.sub} style={{ textAlign: 'center' }}>
                {triesLine}
              </T>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <LoginSheet
        visible={loginOpen}
        onDismiss={() => setLoginOpen(false)}
        onLogin={(p) => {
          login(p);
          setLoginOpen(false);
          router.replace('/home');
        }}
      />
    </Screen>
  );
}
