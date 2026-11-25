import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { AskBar, Toast, usePageEditor } from '@/components/AskBar';
import { FaceStack } from '@/components/Faces';
import { MakingOverlay } from '@/components/Making';
import { PageCanvas } from '@/components/PageCanvas';
import { ShareSheet } from '@/components/Sheets';
import { Btn, Icon, Screen, T, useLayout } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { api } from '@/lib/api';
import { Person } from '@/lib/page';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** 09 · 페이지 열기 — 방장: 수정(말로 바꾸기) · 이름 바꾸기 · 초대 / 멤버: 쓰기 · 나가기 */
export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPage, patchPage, removePage, loggedIn, ready, me, refreshPage } = useStore();
  const stored = getPage(id);
  const { appGutter, compact } = useLayout();
  const ed = usePageEditor(stored ?? null, ({ members: _m, inviteToken: _t, owner: _o, ...rest }) => patchPage(rest.id, rest));
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
  if (!loggedIn) return <Redirect href="/" />;
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
              {isOwner ? (
                <>
                  <Btn accessibilityLabel={`함께 쓰는 사람 ${page.members.length + 1}명, 초대하기`} onPress={() => setShareOpen(true)} style={{ height: 36, paddingLeft: 6, paddingRight: 12, borderRadius: 18, backgroundColor: C.fill, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <FaceStack people={[ME, ...page.members]} size={26} ring={C.fill} />
                    <T s={13.5}>초대</T>
                  </Btn>
                  <Btn
                    accessibilityState={{ selected: editing }}
                    onPress={() => setEditing((e) => !e)}
                    style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: editing ? C.ink : C.fill, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="pencil" size={14} color={editing ? C.white : C.ink} stroke={1.8} />
                    <T s={13.5} c={editing ? C.white : C.ink}>
                      {editing ? '완료' : '수정'}
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
            <PageCanvas page={page} onChange={ed.update} highlight={ed.change} onAppError={isOwner ? ed.repair : undefined} />
            <MakingOverlay on={ed.busy} live={ed.live} />
          </View>
          {/* floats over the page so the header never reflows */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: 68, right: appGutter + 16 }}>
            <Toast toast={ed.toast} onUndo={ed.undo} />
          </View>

          {editing && isOwner && (
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
