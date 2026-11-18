import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AskBar, Toast, usePageEditor } from '@/components/AskBar';
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
  const [loginOpen, setLoginOpen] = useState(false);

  if (!draft) return <Redirect href="/purpose" />;
  const page = ed.page ?? draft;

  const send = () => {
    if (ed.say(text)) setText('');
  };

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

          <PageCanvas page={page} onChange={ed.update} highlight={ed.change} />

          <View style={{ gap: 10 }}>
            {!ed.changed ? (
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
                  이렇게 말하면 언제든 바뀌어요. 마음에 들면 저장해요.
                </T>
                <Btn onPress={() => setLoginOpen(true)} style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center' }}>
                  <T s={14.5} c={C.white}>
                    저장하고 시작하기
                  </T>
                </Btn>
              </View>
            )}
            <AskBar value={text} onChangeText={setText} onSend={send} />
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
