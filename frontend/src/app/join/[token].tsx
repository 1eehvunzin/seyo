import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LoginSheet } from '@/components/Sheets';
import { BrandBg, PrimaryButton, Screen, Star, T } from '@/components/ui';
import { useStore } from '@/store';
import { C } from '@/theme';

/**
 * Invite link: seyo://join/<token>
 * Not logged in → log in first, then come back here. Logged in → open the page the token points to.
 * The current token of each page is the only one that works ("링크 새로 만들기" retires the old one).
 */
export default function Join() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { loggedIn, login, pages, setPendingInvite } = useStore();
  const [loginOpen, setLoginOpen] = useState(!loggedIn);

  useEffect(() => {
    if (!loggedIn) setPendingInvite(token ?? null);
    else setPendingInvite(null);
  }, [loggedIn, token, setPendingInvite]);

  if (loggedIn) {
    const page = pages.find((p) => p.inviteToken === token);
    if (page) return <Redirect href={{ pathname: '/page/[id]', params: { id: page.id } }} />;
  }

  return (
    <Screen bg={C.white}>
      <BrandBg />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
        <Star size={72} fill={C.star} outline={0.4} />
        {loggedIn ? (
          <>
            <T w={600} s={28} ls={-0.03} center>
              이 링크로는 들어갈 수 없어요
            </T>
            <T w={300} s={15} lh={1.6} c={C.sub} center>
              링크가 새로 만들어졌을 수 있어요.{'\n'}보낸 친구에게 새 링크를 부탁해 보세요.
            </T>
            <PrimaryButton label="내 페이지로" onPress={() => router.replace('/home')} />
          </>
        ) : (
          <>
            <T w={600} s={28} ls={-0.03} center>
              함께 쓰자는 초대가 왔어요
            </T>
            <T w={300} s={15} lh={1.6} c={C.sub} center>
              로그인하면 바로 같이 쓸 수 있어요.
            </T>
            <PrimaryButton label="로그인하고 들어가기" onPress={() => setLoginOpen(true)} />
          </>
        )}
      </View>
      <LoginSheet
        visible={loginOpen && !loggedIn}
        onDismiss={() => setLoginOpen(false)}
        onLogin={(p) => {
          login(p);
          setLoginOpen(false);
        }}
      />
    </Screen>
  );
}
