import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewInstance, TextInput, View } from 'react-native';
import { PageCanvas } from '@/components/PageCanvas';
import { PaywallSheet } from '@/components/Sheets';
import { Btn, Icon, IconButton, Screen, T, useLayout } from '@/components/ui';
import { WidgetView } from '@/components/WidgetView';
import { confirmAction } from '@/lib/confirm';
import { followUp, planFromPrompt, PROMPT_EXAMPLES, TEMPLATES } from '@/lib/generate';
import { Page } from '@/lib/page';
import { describeWidget, widgetOptions } from '@/lib/widget';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** Free plan page limit. Placeholder until pricing is set (design: "[무료 한도]"). */
const FREE_PAGES = 5;

type Msg = { id: number; role: 'me' | 'seyo'; text: string };
type Step = { key: string; text: string };

/** 10 · 말로 새 페이지 만들기 */
export default function Generate() {
  const { savePage, pages, plus, setPlus } = useStore();
  const { width, height } = useLayout();
  // Split View / narrow windows stack the chat above the preview instead of squeezing two columns
  const stacked = width < 700;
  const panel = stacked ? width : Math.max(320, Math.min(400, width * 0.34));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [optIdx, setOptIdx] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const seq = useRef(0);
  const scroller = useRef<ScrollViewInstance>(null);

  const building = steps.length > 0 && progress < steps.length;
  const done = steps.length > 0 && !building;

  useEffect(() => {
    if (!building) return;
    const t = setTimeout(() => setProgress((p) => p + 1), 800);
    return () => clearTimeout(t);
  }, [building, progress]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [msgs.length, progress]);

  const say = (role: Msg['role'], t: string) => setMsgs((m) => [...m, { id: seq.current++, role, text: t }]);

  const send = (raw = text) => {
    const t = raw.trim();
    if (!t || building) return;
    setText('');
    say('me', t);
    if (!page) {
      const plan = planFromPrompt(t);
      setPage(plan.page);
      setSteps(plan.steps);
      setProgress(0);
      setFollowUps(plan.followUps);
      setOptIdx(0);
      return;
    }
    const r = followUp(page, t);
    if (!r.page) {
      say('seyo', r.message);
      return;
    }
    setPage(r.page);
    setSteps((s) => [...s, { key: `f${seq.current}`, text: r.step }]);
    setFollowUps((f) => f.filter((x) => x !== t));
  };

  const options = useMemo(() => (page ? widgetOptions(page) : []), [page]);
  const widget = options[optIdx % Math.max(1, options.length)] ?? page?.widget;

  const reached = new Set(steps.slice(0, progress).map((s) => s.key));
  const doing = building ? steps[progress]?.key : undefined;
  // wrong-note sections appear one by one; follow-up sections (units, retry, stats) appear when asked
  const reveal = new Set<string>([...reached, ...(doing ? [doing] : []), 'units', 'retry', 'stats']);
  const pending = new Set<string>(doing ? [doing] : []);
  const bodyVisible = page && (page.main.kind === 'wrong' || reached.has('body') || reached.has('top') || doing === 'body');
  const widgetVisible = reached.has('widget') || doing === 'widget';

  const ownPages = pages.filter((p) => p.owner === null).length;
  const save = () => {
    if (!page || !widget) return;
    if (!plus && ownPages >= FREE_PAGES) {
      setPayOpen(true);
      return;
    }
    const final = { ...page, widget };
    savePage(final);
    router.replace({ pathname: '/page/[id]', params: { id: final.id } });
  };

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const leave = () => (page ? confirmAction('만들던 페이지를 버릴까요?', '저장하지 않으면 지금까지 만든 게 사라져요.', '버리기', exit) : exit());

  const stepText = (s: Step, i: number) => (s.key === 'widget' ? (i < progress && page && widget ? `홈 위젯: ${describeWidget(page, widget)}` : '홈 위젯 고르는 중') : s.text);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, flexDirection: stacked ? 'column' : 'row' }}>
          {/* 대화 */}
          <View accessibilityLabel="대화" style={stacked ? { height: Math.max(320, height * 0.46), paddingTop: 16, paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.hair, gap: 16 } : { width: panel, paddingTop: 24, paddingHorizontal: 32, paddingBottom: 24, borderRightWidth: 1, borderRightColor: C.hair, gap: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -10 }}>
              <IconButton name="back" label="뒤로" onPress={leave} />
              <T w={500} s={20} ls={-0.02} accessibilityRole="header">
                새 페이지
              </T>
            </View>

            <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {msgs.length === 0 && (
                <View style={{ gap: 14 }}>
                  <T s={15} lh={1.6}>
                    어떤 페이지가 필요해요?{'\n'}말하는 대로 만들어 드릴게요.
                  </T>
                  <T s={13.5} lh={1.6} c={C.muted}>
                    예: {PROMPT_EXAMPLES[0]}
                  </T>
                </View>
              )}

              {msgs.map((m, i) =>
                m.role === 'me' ? (
                  <View key={m.id} style={{ gap: 14 }}>
                    <View style={{ alignSelf: 'flex-end', maxWidth: panel - 100, backgroundColor: C.fill, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 6, paddingVertical: 14, paddingHorizontal: 16 }}>
                      <T s={15} lh={1.6}>
                        {m.text}
                      </T>
                    </View>
                    {i === 0 && (
                      <View style={{ gap: 14 }}>
                        <T s={15} lh={1.6}>
                          {done ? '다 만들었어요.' : '이렇게 만들고 있어요.'}
                        </T>
                        {steps.map((s, k) => {
                          if (k > progress) return null;
                          const ok = k < progress;
                          return (
                            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                {ok ? <Icon name="check" size={16} stroke={2} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />}
                              </View>
                              <T s={14} c={ok ? C.ink : C.muted} style={{ flex: 1 }}>
                                {stepText(s, k)}
                              </T>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <T key={m.id} s={14} lh={1.6} c={C.sub}>
                    {m.text}
                  </T>
                ),
              )}
            </ScrollView>

            {done && followUps.length > 0 && (
              <View style={{ gap: 10 }}>
                <T s={12} c={C.muted}>
                  이어서 말해 보기
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {followUps.map((f) => (
                    <Btn key={f} onPress={() => send(f)} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}>
                      <T s={13.5}>{f}</T>
                    </Btn>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 56, borderRadius: 28, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 6 }}>
              <TextInput
                accessibilityLabel={page ? '더 말하기' : '만들 페이지 말하기'}
                value={text}
                onChangeText={setText}
                placeholder={page ? '더 바꿀 게 있나요?' : '어떤 페이지를 만들까요?'}
                placeholderTextColor={C.faint}
                returnKeyType="send"
                onSubmitEditing={() => send()}
                editable={!building}
                style={{ flex: 1, minWidth: 0, height: 44, fontFamily: F[400], fontSize: 15, color: C.ink }}
              />
              <IconButton name="send" label="보내기" onPress={() => send()} bg={C.ink} color={C.white} iconSize={18} />
            </View>
          </View>

          {/* 미리보기 */}
          <ScrollView accessibilityLabel="미리보기" style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 24, paddingHorizontal: stacked ? 24 : 48, paddingBottom: 40, gap: 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {!page ? (
              <TemplatePicker onPick={(prompt) => send(prompt)} stacked={stacked} />

            ) : (
              <>
                <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: done ? C.done : C.accent }} />
                    <T s={13} c={C.muted}>
                      {done ? '다 만들었어요' : '만드는 중'}
                    </T>
                  </View>
                  <Btn disabled={!done} onPress={save} style={{ height: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center' }}>
                    <T s={14.5} c={C.white}>
                      페이지 저장
                    </T>
                  </Btn>
                </View>

                <View style={{ gap: 4 }}>
                  <TextInput
                    accessibilityLabel="페이지 이름"
                    value={page.name}
                    onChangeText={(name) => setPage({ ...page, name })}
                    style={{ marginLeft: -10, height: 52, paddingHorizontal: 10, borderRadius: 12, fontFamily: F[600], fontSize: 34, letterSpacing: -1, color: C.ink }}
                  />
                  <T s={13} c={C.muted}>
                    말한 내용으로 이름을 지었어요. 눌러서 바꿀 수 있어요.
                  </T>
                </View>

                {bodyVisible && <PageCanvas page={page} onChange={setPage} reveal={page.main.kind === 'wrong' ? reveal : undefined} pending={pending} bare={page.main.kind === 'wrong'} scroll={false} />}

                {widgetVisible && widget && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, padding: 16, borderRadius: 20, backgroundColor: C.fill, opacity: doing === 'widget' ? 0.5 : 1 }}>
                    <View style={{ width: 150, height: 150 }}>
                      <WidgetView page={page} widget={widget} scale={widget.size === 'large' ? 0.5 : 0.75} />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <T w={500} s={15}>
                        홈에서는 이렇게 보여요
                      </T>
                      <T w={300} s={13} lh={1.5} c={C.sub}>
                        {describeWidget(page, widget)}, {widget.size === 'large' ? '큰' : '작은'} 위젯으로 꺼내 뒀어요. 페이지에서 바꾸면 위젯도 바로 바뀌어요.
                      </T>
                    </View>
                    {options.length > 1 && (
                      <Btn disabled={!done} onPress={() => setOptIdx((i) => (i + 1) % options.length)} accessibilityHint="다른 위젯 틀로 바꿔요" style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, justifyContent: 'center' }}>
                        <T s={13.5}>
                          바꾸기 {(optIdx % options.length) + 1}/{options.length}
                        </T>
                      </Btn>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <PaywallSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSubscribe={() => {
          setPlus(true);
          setPayOpen(false);
          if (page && widget) {
            const final = { ...page, widget };
            savePage(final);
            router.replace({ pathname: '/page/[id]', params: { id: final.id } });
          }
        }}
      />
    </Screen>
  );
}

/** Empty preview side: start from a template. Each card's widget is built from the same plan the template produces. */
function TemplatePicker({ onPick, stacked }: { onPick: (prompt: string) => void; stacked: boolean }) {
  const plans = useMemo(() => TEMPLATES.map((t) => ({ ...t, page: planFromPrompt(t.prompt).page })), []);
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <T w={600} s={22} ls={-0.02} accessibilityRole="header">
          템플릿에서 시작하기
        </T>
        <T s={14} c={C.muted}>
          고르면 바로 만들어요. 만든 뒤에도 말로 바꿀 수 있어요.
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {plans.map((t) => (
          <Btn key={t.id} accessibilityLabel={`${t.title} 템플릿, ${t.desc}`} onPress={() => onPick(t.prompt)} style={{ width: stacked ? '47%' : 168, gap: 10 }}>
            <View style={{ height: 150 }}>
              <WidgetView page={t.page} widget={{ size: 'small', templates: t.page.widget.size === 'large' ? ['shortList'] : t.page.widget.templates }} scale={0.75} />
            </View>
            <View style={{ gap: 2, paddingHorizontal: 4 }}>
              <T w={500} s={15}>
                {t.title}
              </T>
              <T s={12.5} c={C.muted}>
                {t.desc}
              </T>
            </View>
          </Btn>
        ))}
      </View>
    </View>
  );
}
