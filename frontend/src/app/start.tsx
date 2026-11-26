import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, TextInputInstance, View } from 'react-native';
import { AppFrame } from '@/components/AppFrame';
import { AttachButton, AttachTray, RefStatus, refPlaceholder } from '@/components/Attach';
import { DevicePick } from '@/components/DevicePick';
import { Device, deviceOf } from '@/lib/page';
import { MAX_ATTACH, usePastePhotos, useReferences } from '@/lib/attach';
import { PageSkeleton } from '@/components/Making';
import { Btn, IconButton, noOutline, Screen, Star, T, useLayout } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { planFromPrompt } from '@/lib/generate';
import { appPage, Live, liveLabel, runApp } from '@/lib/vibecode';
import { LoginSheet } from '@/components/Sheets';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** Example asks: the same voice as the landing's speech bubbles. */
const EXAMPLES = ['시험기간 공부 플래너 만들어 주세요', '독서기록장, 문장 수집도 되게 해주세요', '최애 생일 캘린더 만들어 주세요', '매일 물 마시기랑 스트레칭 체크표'];

/**
 * 02 · 온보딩: 한 줄 말하면 첫 페이지가 생겨요.
 * No survey: the user says what they need, the AI builds it while they watch (skeleton until the
 * first part arrives, then the page draws in live), then the trial screen lets them change it by
 * talking. If the AI can't (offline, out of tries, error), the local builder makes a page at once
 * so onboarding never dead-ends.
 */
export default function Start() {
  const { setDraft } = useStore();
  const { gutter, width, height } = useLayout();
  const [text, setText] = useState('');
  /** the screen the first page is for: this device's kind unless the user picks the other */
  const [device, setDevice] = useState<Device>(() => deviceOf(width));
  const [asked, setAsked] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** why the last try didn't make a page: out of tries → log in; AI down → retry or a plain page */
  const [stuck, setStuck] = useState<'limit' | 'offline' | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const { login, enterGuest } = useStore();
  /** photos attached to the ask: a design reference unless the words say otherwise */
  const [photos, setPhotos] = useState<string[]>([]);
  const input = useRef<TextInputInstance>(null);
  const addPhotos = useCallback((more: string[]) => setPhotos((p) => [...p, ...more].slice(0, MAX_ATTACH)), [setPhotos]);
  usePastePhotos(input, addPhotos, !asked);
  const refs = useReferences(addPhotos, MAX_ATTACH - photos.length, input);
  const narrow = width < 700;

  const make = async (raw = text) => {
    const t = raw.trim();
    if (!t || asked) return;
    setAsked(t);
    setError(null);
    setLive(null);
    try {
      const r = await runApp(t, null, setLive, undefined, undefined, undefined, photos, device);
      if (r.html) {
        setDraft(appPage(r.html, t, device));
        router.replace('/demo');
        return;
      }
      setError(r.summary || '조금 다르게 말해 볼래요?');
      setAsked(null);
    } catch (e) {
      // Never swap in something else quietly: say what happened and let them choose.
      setAsked(null);
      if (e instanceof ApiError && e.status === 402) {
        setStuck('limit');
        setError(e.message || '저장하고 시작하면 무료로 계속 만들 수 있어요');
      } else if (!(e instanceof ApiError) || e.status >= 500) {
        setStuck('offline');
        setError('지금은 AI가 답하지 않아요. 다시 해 보거나, 기본 틀로 먼저 시작할 수 있어요.');
      } else setError(e.message || '잠시 문제가 생겼어요. 다시 말해 볼래요?');
    }
  };
  const startPlain = () => {
    setDraft(planFromPrompt(text).page);
    router.replace('/demo');
  };

  if (asked) {
    // building: what they asked on top, the page drawing itself below
    return (
      <Screen>
        <View style={{ flex: 1, paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 28, gap: 18 }}>
          <View style={{ alignSelf: 'flex-end', maxWidth: 560, backgroundColor: C.ink, borderRadius: 22, borderBottomRightRadius: 6, paddingVertical: 14, paddingHorizontal: 20 }}>
            <T s={16} c={C.white} lh={1.5}>
              {asked}
            </T>
          </View>
          <View style={{ flex: 1, borderRadius: 28, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
            {live?.html ? <AppFrame html={live.html} state={{}} live /> : <PageSkeleton label={liveLabel(live, false)} />}
          </View>
          {!!live?.html && (
            <T s={13.5} c={C.sub} center accessibilityLiveRegion="polite">
              {liveLabel(live, false)} · 다 되면 바로 써 볼 수 있어요
            </T>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* already have an account (or just want to sign up first): skip the try-out */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: gutter, paddingTop: 14 }}>
        <Btn onPress={() => setLoginOpen(true)} accessibilityLabel="로그인" style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}>
          <T s={14} w={500}>
            로그인
          </T>
        </Btn>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: gutter, paddingVertical: 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: height < 700 ? 24 : 36 }}>
            <View style={{ gap: 14 }}>
              <Star size={56} fill={C.star} />
              <T w={600} s={narrow ? 30 : 40} lh={1.25} ls={-0.035} accessibilityRole="header">
                {'딱 맞는 페이지가 없다면,\n그냥 말하세요'}
              </T>
              <T s={16} c={C.sub} lh={1.5}>
                한 줄이면 충분해요. 만든 뒤에도 말로 계속 바꿀 수 있어요.
              </T>
            </View>

            <View style={{ gap: 14 }}>
              <DevicePick value={device} onChange={setDevice} />
              <AttachTray photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, k) => k !== i))} />
              <RefStatus refs={refs} />
              <View style={{ minHeight: 64, borderRadius: 32, borderWidth: 1.5, borderColor: text ? C.ink : C.line, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 8, gap: 6, shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
                <TextInput
                  ref={input}
                  accessibilityLabel="만들 페이지 말하기"
                  value={text}
                  onChangeText={(v) => {
                    setText(refs.take(v));
                    setError(null);
                    setStuck(null);
                  }}
                  placeholder={refPlaceholder(refs, photos.length, '어떤 페이지가 필요해요?')}
                  placeholderTextColor={C.faint}
                  returnKeyType="send"
                  onSubmitEditing={() => make()}
                  autoFocus={Platform.OS === 'web'}
                  style={{ flex: 1, minWidth: 0, height: 52, fontFamily: F[400], fontSize: 17, color: C.ink, ...noOutline }}
                />
                <AttachButton refs={refs} query={text} />
                <IconButton name="send" label="만들기" onPress={() => make()} bg={text.trim() ? C.ink : C.line} color={C.white} size={48} iconSize={18} />
              </View>
              {!!error && (
                <View style={{ gap: 10, paddingLeft: 24 }}>
                  <T s={13.5} c={stuck ? C.sub : C.error} accessibilityLiveRegion="polite">
                    {error}
                  </T>
                  {stuck && (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {stuck === 'limit' ? (
                        <Btn onPress={() => setLoginOpen(true)} style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center' }}>
                          <T s={14} c={C.white}>
                            저장하고 시작하기
                          </T>
                        </Btn>
                      ) : (
                        <>
                          <Btn onPress={() => make()} style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center' }}>
                            <T s={14} c={C.white}>
                              다시 하기
                            </T>
                          </Btn>
                          <Btn onPress={startPlain} style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.fill, justifyContent: 'center' }}>
                            <T s={14}>기본 틀로 시작하기</T>
                          </Btn>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {EXAMPLES.map((e) => (
                  <Btn key={e} onPress={() => make(e)} accessibilityHint="이 문장으로 바로 만들어요" style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.fill, justifyContent: 'center' }}>
                    <T s={14} c={C.ink2}>
                      {e}
                    </T>
                  </Btn>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <LoginSheet
        visible={loginOpen}
        onDismiss={() => setLoginOpen(false)}
        onLogin={(p) => {
          login(p);
          setLoginOpen(false);
          router.replace('/home');
        }}
        onSkip={() => {
          enterGuest(null);
          setLoginOpen(false);
          router.replace('/home');
        }}
      />
    </Screen>
  );
}
