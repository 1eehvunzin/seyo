import * as Linking from 'expo-linking';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { AskBar, Toast, usePageEditor } from '@/components/AskBar';
import { FaceStack } from '@/components/Faces';
import { PageCanvas } from '@/components/PageCanvas';
import { ShareSheet } from '@/components/Sheets';
import { Btn, Icon, Screen, T, useLayout } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { ME, newToken } from '@/lib/page';
import { useStore } from '@/store';
import { C, F } from '@/theme';

/** 09 · 페이지 열기 — 방장: 수정(말로 바꾸기) · 이름 바꾸기 · 초대 / 멤버: 쓰기 · 나가기 */
export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPage, savePage, patchPage, removePage, loggedIn } = useStore();
  const stored = getPage(id);
  const { appGutter, compact } = useLayout();
  const ed = usePageEditor(stored ?? null, ({ members: _m, inviteToken: _t, owner: _o, ...rest }) => patchPage(rest.id, rest));
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [text, setText] = useState('');

  if (!loggedIn) return <Redirect href="/" />;
  if (!stored) return <Redirect href="/home" />;
  // the editor holds the working copy; the store copy is the source when nothing was edited here yet
  const page = ed.page && ed.page.id === stored.id ? { ...stored, ...ed.page, members: stored.members, inviteToken: stored.inviteToken } : stored;
  const isOwner = page.owner === null;
  const inviteUrl = Linking.createURL(`/join/${page.inviteToken}`);

  const send = () => {
    if (ed.say(text)) setText('');
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

          <PageCanvas page={page} onChange={ed.update} highlight={ed.change} />
          {/* floats over the page so the header never reflows */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: 68, right: appGutter + 16 }}>
            <Toast toast={ed.toast} onUndo={ed.undo} />
          </View>

          {editing && isOwner && <AskBar value={text} onChangeText={setText} onSend={send} placeholder="이 페이지를 어떻게 바꿀까요? 예: 메모 칸 넣어줘" autoFocus />}
        </View>
      </KeyboardAvoidingView>

      {isOwner && (
        <ShareSheet
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          me={{ ...ME, name: `${ME.name} (나)` }}
          members={page.members}
          inviteUrl={inviteUrl}
          onKick={(mid) => savePage({ ...page, members: page.members.filter((m) => m.id !== mid) })}
          onResetLink={() => savePage({ ...page, inviteToken: newToken() })}
        />
      )}
    </Screen>
  );
}
