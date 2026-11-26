import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, ScrollViewInstance, TextInput, TextInputInstance, View } from 'react-native';
import { PageCanvas } from '@/components/PageCanvas';
import { PaywallSheet } from '@/components/Sheets';
import { Btn, Icon, IconButton, noOutline, Screen, T, useLayout } from '@/components/ui';
import { WidgetView } from '@/components/WidgetView';
import { confirmAction, notice } from '@/lib/confirm';
import { ApiError } from '@/lib/api';
import { followUpWithAi, planFromPrompt, TEMPLATES } from '@/lib/generate';
import { appPage, Live, liveLabel, repairApp, runApp } from '@/lib/vibecode';
import { LiveApp } from '@/components/SheetStack';
import { AttachButton, AttachTray, PinterestChip, RefHint, RefStatus, refPlaceholder } from '@/components/Attach';
import { DevicePick } from '@/components/DevicePick';
import { MAX_ATTACH, usePastePhotos, useReferences } from '@/lib/attach';
import { MakingOverlay, PageSkeleton } from '@/components/Making';
import { Page, SheetKind } from '@/lib/page';
import { describeWidget, widgetOptions } from '@/lib/widget';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** Free plan page limit. Placeholder until pricing is set (design: "[무료 한도]"). */
const FREE_PAGES = 5;

type Msg = { id: number; role: 'me' | 'seyo'; text: string };
type Step = { key: string; text: string };

/** 10 · 말로 새 페이지 만들기 */
export default function Generate() {
  const { savePage, pages, plus, subscribe } = useStore();
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
  /** the new page's A4 sheet: 세로 unless the user turns it */
  const [device, setDevice] = useState<SheetKind>('portrait');
  const [optIdx, setOptIdx] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  /** waiting for the model (first page or a follow-up) */
  const [thinking, setThinking] = useState(false);
  /** 바이브 코딩 progress: the code so far while the AI writes it */
  const [live, setLive] = useState<Live | null>(null);
  const seq = useRef(0);
  /** code versions already sent for repair (one try each, so a bad fix can't loop) */
  const repaired = useRef(new Set<string>());
  /** automatic repairs in a row (a fix that breaks again gets one more try, then stop) */
  const repairChain = useRef(0);
  const scroller = useRef<ScrollViewInstance>(null);
  /** photos attached to the next message: a design reference unless the words say otherwise */
  const [photos, setPhotos] = useState<string[]>([]);
  const input = useRef<TextInputInstance>(null);
  const addPhotos = useCallback((more: string[]) => setPhotos((p) => [...p, ...more].slice(0, MAX_ATTACH)), [setPhotos]);
  usePastePhotos(input, addPhotos);
  const refs = useReferences(addPhotos, MAX_ATTACH - photos.length, input);

  const building = steps.length > 0 && progress < steps.length;
  const done = steps.length > 0 && !building;

  useEffect(() => {
    if (!building) return;
    const t = setTimeout(() => setProgress((p) => p + 1), 800);
    return () => clearTimeout(t);
  }, [building, progress]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [msgs.length, progress, thinking]);

  const say = (role: Msg['role'], t: string) => setMsgs((m) => [...m, { id: seq.current++, role, text: t }]);

  const outOfTries = (e: unknown) => {
    if (!(e instanceof ApiError && e.status === 402)) return false;
    say('seyo', e.message);
    if (!plus) setPayOpen(true);
    return true;
  };

  /** Templates are fixed shapes: built locally, no AI try used. */
  const pick = (prompt: string) => {
    if (page || thinking) return;
    say('me', prompt);
    const plan = planFromPrompt(prompt);
    setPage(plan.page);
    setSteps(plan.steps);
    setProgress(0);
    setFollowUps(plan.followUps);
    setOptIdx(0);
  };

  /** A code app is ready: show it as built (body + widget steps), ready to save. */
  const showApp = (next: Page, summary: string, isNew: boolean) => {
    setPage(next);
    setOptIdx(0);
    if (isNew) {
      const st = [
        { key: 'body', text: summary },
        { key: 'widget', text: '홈 위젯 고르기' },
      ];
      setSteps(st);
      setProgress(st.length);
      setFollowUps(['색을 더 밝게 바꿔줘', '귀여운 효과 넣어줘']);
    } else {
      setSteps((s) => [...s, { key: `f${seq.current}`, text: summary }]);
      setProgress((p) => p + 1);
    }
  };

  const send = async (raw = text) => {
    const t = raw.trim();
    if (!t || building || thinking) return;
    const imgs = photos;
    setText('');
    setPhotos([]);
    say('me', imgs.length ? `${t} (사진 ${imgs.length}장)` : t);
    setThinking(true);
    repairChain.current = 0;
    setLive(null);
    try {
      // 바이브 코딩: new pages and changes to a code app are written as real code
      if (!page || page.main.kind === 'app') {
        const html = page?.main.kind === 'app' ? page.main.html : null;
        const r = await runApp(t, html, setLive, page?.name, undefined, undefined, imgs, page?.device ?? device);
        if (!r.html) {
          say('seyo', r.summary);
          return;
        }
        if (!page) showApp(appPage(r.html, t, device), r.summary, true);
        else if (page.main.kind === 'app') showApp({ ...page, main: { ...page.main, html: r.html } }, r.summary, false);
        setFollowUps((f) => f.filter((x) => x !== t));
        return;
      }
      // template pages (fixed blocks) keep the block editor
      const r = await followUpWithAi(page, t, setLive, imgs);
      if (!r.page) {
        say('seyo', r.message);
        return;
      }
      setPage(r.page);
      setOptIdx(0);
      setSteps((s) => [...s, { key: `f${seq.current}`, text: r.step }]);
      setProgress((p) => p + 1);
      setFollowUps((f) => f.filter((x) => x !== t));
    } catch (e) {
      if (outOfTries(e)) return;
      if (!page) {
        // no server: the local builder still makes a page from the fixed blocks
        const plan = planFromPrompt(t);
        setPage(plan.page);
        setSteps(plan.steps);
        setProgress(0);
        setFollowUps(plan.followUps);
        setOptIdx(0);
        return;
      }
      say('seyo', e instanceof Error && e.message ? e.message : '잠시 문제가 생겼어요. 다시 말해 볼래요?');
    } finally {
      setThinking(false);
      setLive(null);
    }
  };

  const onAppError = async (error: string) => {
    if (!page || page.main.kind !== 'app' || thinking || repaired.current.has(page.main.html) || repairChain.current >= 2) return;
    repairChain.current += 1;
    const app = page.main;
    repaired.current.add(app.html);
    say('seyo', '앱에 오류가 있어서 고치고 있어요.');
    setThinking(true);
    const fixed = await repairApp(app.html, error, setLive, page.name);
    setThinking(false);
    setLive(null);
    if (fixed && fixed !== app.html) {
      setPage((p) => (p && p.main.kind === 'app' ? { ...p, main: { ...p.main, html: fixed } } : p));
      say('seyo', '오류를 고쳤어요.');
    } else say('seyo', '오류를 다 못 고쳤어요. 어떤 게 안 되는지 말해 주면 고쳐 볼게요.');
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
                  <RefHint size={13.5} />
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
              {thinking && (
                <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator size="small" color={C.accent} />
                  <T s={14} c={C.muted}>
                    {liveLabel(live, !!page)}
                  </T>
                </View>
              )}
            </ScrollView>

            {done && followUps.length > 0 && (
              <View style={{ gap: 10 }}>
                <T s={12} c={C.muted}>
                  이어서 말해 보기
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {followUps.map((f) => (
                    <Btn key={f} disabled={thinking} onPress={() => send(f)} style={{ minHeight: 34, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 17, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}>
                      <T s={13}>{f}</T>
                    </Btn>
                  ))}
                </View>
              </View>
            )}

            {/* screen choice and Pinterest side by side (wraps when the column is narrow) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {!page && <DevicePick value={device} onChange={setDevice} />}
              {!thinking && !building && !text.trim() && !photos.length && <PinterestChip refs={refs} query={page?.name || ''} />}
            </View>
            <AttachTray photos={photos} onRemove={(i) => setPhotos((p) => p.filter((_, k) => k !== i))} />
            <RefStatus refs={refs} />
            <View style={{ height: 56, borderRadius: 28, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 6 }}>
              <TextInput
                ref={input}
                accessibilityLabel={page ? '더 말하기' : '만들 페이지 말하기'}
                value={text}
                onChangeText={(v) => setText(refs.take(v))}
                placeholder={refPlaceholder(refs, photos.length, page ? '더 바꿀 게 있나요?' : '어떤 페이지를 만들까요?')}
                placeholderTextColor={C.faint}
                returnKeyType="send"
                onSubmitEditing={() => send()}
                editable={!building && !thinking}
                style={{ flex: 1, minWidth: 0, height: 44, fontFamily: F[400], fontSize: 15, color: C.ink, ...noOutline }}
              />
              {!thinking && !building && <AttachButton refs={refs} query={text || page?.name || ''} pin={false} />}
              {thinking ? (
                <View accessibilityLabel="만드는 중" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={C.white} size="small" />
                </View>
              ) : (
                <IconButton name="send" label="보내기" onPress={() => send()} bg={C.ink} color={C.white} iconSize={18} />
              )}
            </View>
          </View>

          {/* 미리보기 */}
          <ScrollView accessibilityLabel="미리보기" style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 24, paddingHorizontal: stacked ? 24 : 48, paddingBottom: 40, gap: 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {!page && thinking ? (
              <View style={{ gap: 16 }}>
                <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
                  <T s={13} c={C.muted}>
                    {liveLabel(live, false)}
                  </T>
                </View>
                <View style={{ height: Math.max(480, height - 140), borderRadius: 28, backgroundColor: C.white, borderWidth: 1, borderColor: C.hair, overflow: 'hidden' }}>
                  {live?.html ? <LiveApp html={live.html} device={device} /> : <PageSkeleton label={liveLabel(live, false)} />}
                </View>
              </View>
            ) : !page ? (
              <TemplatePicker onPick={pick} stacked={stacked} />

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

                {page.main.kind === 'app' ? (
                  <View style={{ height: Math.max(480, height - 220) }}>
                    {live?.html ? <LiveApp html={live.html} device={page.device} /> : <PageCanvas page={page} onChange={setPage} bare onAppError={onAppError} />}
                    <MakingOverlay on={thinking && !live?.html} live={live} />
                  </View>
                ) : (
                  bodyVisible && (
                    <View>
                      <PageCanvas page={page} onChange={setPage} reveal={page.main.kind === 'wrong' ? reveal : undefined} pending={pending} bare={page.main.kind === 'wrong'} scroll={false} />
                      <MakingOverlay on={thinking} live={live} />
                    </View>
                  )
                )}

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
        onSubscribe={async () => {
          setPayOpen(false);
          if (await subscribe()) notice('seyo plus를 시작했어요', '테스트 구독이에요. 결제 없이 plus 기능을 써 볼 수 있어요.');
          else notice('구독은 아직 열 수 없어요', '테스트 구독이 꺼져 있는 서버예요. 잠시 뒤 다시 해 주세요.');
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
