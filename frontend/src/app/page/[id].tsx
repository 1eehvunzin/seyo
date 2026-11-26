import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { AskBar, Toast, usePageEditor } from '@/components/AskBar';
import { FaceStack } from '@/components/Faces';
import { MakingOverlay } from '@/components/Making';
import { PageCanvas } from '@/components/PageCanvas';
import { DeviceSheet, LoginSheet, PaywallSheet, ShareSheet } from '@/components/Sheets';
import { Btn, Icon, Screen, T, useLayout } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { api } from '@/lib/api';
import { InkCmd } from '@/lib/appdoc';
import { pickPhotos } from '@/lib/attach';
import { deviceOf, isSheet, Person } from '@/lib/page';
import { DEFAULT_INK, InkBar } from '@/components/InkBar';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** 09 · 페이지 열기 — 방장: 수정(말로 바꾸기) · 이름 바꾸기 · 초대 / 멤버: 쓰기 · 나가기 */
export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPage, patchPage, removePage, loggedIn, guest, login, ready, me, refreshPage, plus, subscribe } = useStore();
  const stored = getPage(id);
  const { appGutter, compact, width } = useLayout();
  /** this page was made for the other kind of screen and the user hasn't said to keep it */
  const [deviceOk, setDeviceOk] = useState(false);
  /** 입력 (typing, the page's own controls) or 필기 (pen, highlighter, photos on top of the page) */
  const [ink, setInk] = useState<InkCmd>({ tool: 'off', color: DEFAULT_INK.pen, seq: 0 });
  /** each colored tool keeps its own color */
  const [inkColors, setInkColors] = useState(DEFAULT_INK);
  const drawing = ink.tool !== 'off';
  const toolColor = (tool: InkCmd['tool'], c = inkColors) => (tool === 'marker' ? c.marker : c.pen);
  const inkTool = (tool: InkCmd['tool']) => setInk((k) => ({ tool, color: toolColor(tool), seq: k.seq }));
  const inkColor = (color: string) => {
    if (ink.tool !== 'pen' && ink.tool !== 'marker') return;
    const tool = ink.tool;
    setInkColors((c) => ({ ...c, [tool]: color }));
    setInk((k) => ({ ...k, color }));
  };
  const inkPhoto = async () => {
    const [url] = await pickPhotos(1);
    // a new photo comes in selected under the lasso, ready to move and resize
    if (url) setInk((k) => ({ tool: 'lasso', color: k.color, seq: k.seq + 1, image: url }));
  };
  const inkUndo = () => setInk((k) => ({ tool: k.tool, color: k.color, seq: k.seq + 1, undo: true }));
  const ed = usePageEditor(stored ?? null, ({ members: _m, inviteToken: _t, owner: _o, ...rest }) => patchPage(rest.id, rest));
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** out of this month's AI uses (free plan): the paywall opens once, then the bar says when it refills */
  const [payClosed, setPayClosed] = useState(false);
  const [text, setText] = useState('');
  /** photos attached to the next request */
  const [photos, setPhotos] = useState<string[]>([]);
  // a shared page: pick up what the others changed (every 10s while it's open)
  const sharedId = stored && (stored.owner || stored.members.length) ? stored.id : null;
  useEffect(() => {
    if (!sharedId) return;
    const t = setInterval(() => refreshPage(sharedId), 10000);
    return () => clearInterval(t);
  }, [sharedId, refreshPage]);

  if (!ready) return null;
  if (!loggedIn && !guest) return <Redirect href="/" />;
  if (!stored) return <Redirect href="/home" />;
  const ME: Person = me ? { id: me.id, name: me.name, initial: me.initial, bg: me.bg } : { id: 'me', name: '나', initial: '나', bg: C.pink };
  // the editor holds the working copy; the store copy is the source when nothing was edited here yet
  const page = ed.page && ed.page.id === stored.id ? { ...stored, ...ed.page, members: stored.members, inviteToken: stored.inviteToken } : stored;
  const isOwner = page.owner === null;
  const inviteUrl = api.inviteUrl(page.inviteToken);

  const send = async () => {
    if (await ed.say(text, photos)) {
      setText('');
      setPhotos([]);
    }
  };

  const leave = () =>
    confirmAction('이 페이지에서 나갈까요?', `${page.owner?.name}님이 다시 초대하면 들어올 수 있어요.`, '나가기', () => {
      removePage(page.id);
      router.replace('/home');
    });

  const remove = () =>
    confirmAction('이 페이지를 지울까요?', page.members.length ? '함께 쓰던 사람들도 더는 볼 수 없어요. 되돌릴 수 없어요.' : '지우면 되돌릴 수 없어요.', '지우기', () => {
      removePage(page.id);
      router.replace('/home');
    });

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: appGutter, paddingTop: 12, paddingBottom: 20, gap: 16 }}>
          <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Btn accessibilityLabel="내 페이지로" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingRight: 8 }}>
              <Icon name="back" />
              {!compact && <T s={15}>내 페이지</T>}
            </Btn>

            <TextInput
              accessibilityLabel={isOwner ? '페이지 이름, 눌러서 바꾸기' : '페이지 이름'}
              value={page.name}
              editable={isOwner}
              onChangeText={(name) => ed.update({ ...page, name })}
              style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 10, textAlign: 'center', fontFamily: F[600], fontSize: 16, color: C.ink }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {page.main.kind === 'app' && (
                <View accessibilityRole="radiogroup" accessibilityLabel="입력 방식" style={{ flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: C.fill }}>
                  {(['입력', '필기'] as const).map((m) => {
                    const on = (m === '필기') === drawing;
                    return (
                      <Btn
                        key={m}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          if (m === '필기') {
                            setEditing(false);
                            inkTool(drawing ? ink.tool : 'pen');
                          } else inkTool('off');
                        }}
                        style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }}
                      >
                        <T s={13} w={on ? 600 : 400} c={on ? C.ink : C.sub}>
                          {m}
                        </T>
                      </Btn>
                    );
                  })}
                </View>
              )}
              {isOwner ? (
                <>
                  {/* without an account a page stays on this device: no sharing */}
                  {loggedIn && (
                    <Btn accessibilityLabel={`함께 쓰는 사람 ${page.members.length + 1}명, 초대하기`} onPress={() => setShareOpen(true)} style={{ height: 36, paddingLeft: 6, paddingRight: 12, borderRadius: 18, backgroundColor: C.fill, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <FaceStack people={[ME, ...page.members]} size={26} ring={C.fill} />
                      <T s={13.5}>초대</T>
                    </Btn>
                  )}
                  <Btn
                    accessibilityState={{ selected: editing }}
                    onPress={() => {
                      inkTool('off');
                      setEditing((e) => !e);
                    }}
                    style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: editing ? C.ink : C.fill, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="pencil" size={14} color={editing ? C.white : C.ink} stroke={1.8} />
                    <T s={13.5} c={editing ? C.white : C.ink}>
                      {editing ? '완료' : '수정'}
                    </T>
                  </Btn>
                  <Btn onPress={remove} accessibilityLabel="이 페이지 지우기" style={{ height: 36, paddingHorizontal: 10, borderRadius: 18, justifyContent: 'center' }}>
                    <T s={13} c={C.sub}>
                      지우기
                    </T>
                  </Btn>
                </>
              ) : (
                <>
                  <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.fill, justifyContent: 'center' }}>
                    <T s={13} c={C.sub}>
                      {page.owner?.name}님의 페이지 · 함께 쓰는 중
                    </T>
                  </View>
                  <Btn onPress={leave} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' }}>
                    <T s={13} c={C.sub}>
                      나가기
                    </T>
                  </Btn>
                </>
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <PageCanvas page={page} onChange={ed.update} highlight={ed.change} onAppError={isOwner ? ed.repair : undefined} ink={ink} />
            <MakingOverlay on={ed.busy} live={ed.live} />
          </View>
          {/* floats over the page so the header never reflows */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: 68, right: appGutter + 16 }}>
            <Toast toast={ed.toast} onUndo={ed.undo} />
          </View>

          {drawing && <InkBar tool={ink.tool} colors={inkColors} onTool={inkTool} onColor={inkColor} onPhoto={inkPhoto} onUndo={inkUndo} />}

          {editing && isOwner && !drawing && (
            <View style={{ gap: 8 }}>
              <AskBar
                photos={photos}
                onPhotos={setPhotos}
                value={text}
                onChangeText={setText}
                onSend={send}
                busy={ed.busy}
                disabled={ed.limited}
                placeholder={ed.limited ? '이번 달 바꿀 수 있는 만큼 다 썼어요' : page.main.kind === 'app' ? '무엇이든 말해 보세요. 예: 버튼을 더 크게, 기록 지우기 버튼 넣어줘' : '무엇이든 말해 보세요. 예: 국어 비문학 3지문 할 일에 넣어줘'}
                autoFocus
              />
              {ed.left !== null && ed.left <= 5 && (
                <T s={12.5} c={C.sub} style={{ textAlign: 'center' }}>
                  {ed.limited ? '다음 달 1일에 다시 채워져요' : `이번 달 ${ed.left}번 더 바꿀 수 있어요`}
                </T>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* older pages were made for a phone or an iPad; A4 sheets fit any screen */}
      {page.main.kind === 'app' && !isSheet(page.device) && (
        <DeviceSheet
          visible={!deviceOk && !ed.busy && (page.device ?? 'tablet') !== deviceOf(width)}
          made={page.device ?? 'tablet'}
          onKeep={() => setDeviceOk(true)}
        />
      )}
      <LoginSheet
        visible={guest && ed.limited && !payClosed}
        onDismiss={() => setPayClosed(true)}
        title="로그인하면 무료로 계속 바꿀 수 있어요"
        sub="이 기기에서 만든 페이지는 계정으로 그대로 옮겨져요."
        onLogin={(p) => {
          login(p);
          setPayClosed(true);
        }}
      />
      <PaywallSheet
        visible={loggedIn && ed.limited && !plus && !payClosed}
        onClose={() => setPayClosed(true)}
        onSubscribe={async () => {
          setPayClosed(true);
          if (await subscribe()) ed.recheck();
        }}
      />

      {isOwner && (
        <ShareSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          me={{ ...ME, name: `${ME.name} (나)` }}
          members={page.members}
          inviteUrl={inviteUrl}
          onKick={(mid) => {
            patchPage(page.id, { members: page.members.filter((m) => m.id !== mid) });
            api.kick(page.id, mid).catch(() => {});
          }}
          onResetLink={() => {
            api
              .resetInvite(page.id)
              .then((r) => patchPage(page.id, { inviteToken: r.inviteToken }))
              .catch(() => {});
          }}
        />
      )}
    </Screen>
  );
}
