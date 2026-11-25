import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Spinner } from '@/components/Making';
import { PrimaryButton, Screen, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { takeAppleReturn } from '@/lib/apple';
import { useStore } from '@/store';
import { C } from '@/theme';

/** Web: Apple sent the user back here with #id_token=…. Finish the login and bring back what they made. */
export default function AppleReturn() {
  const { login, setPendingInvite } = useStore();
  const [problem, setProblem] = useState<string | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const { idToken, error, pending } = takeAppleReturn();
    const done = (p: string) => queueMicrotask(() => setProblem(p));
    if (error || !idToken) return done(error === 'user_cancelled_authorize' ? '로그인을 취소했어요' : 'Apple 로그인을 하지 못했어요');
    if (!pending) return done('로그인 정보가 맞지 않아요. 처음부터 다시 해 주세요');
    api
      .loginApple(idToken, undefined, pending.nonce)
      .then(() => {
        if (pending.invite) setPendingInvite(pending.invite);
        login('apple', { real: true, draft: pending.draft });
        router.replace('/home');
      })
      .catch((e) => setProblem(e instanceof ApiError ? e.message : 'Apple 로그인을 하지 못했어요. 잠시 뒤 다시 해 주세요'));
  }, [login, setPendingInvite]);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
        {problem ? (
          <>
            <T w={600} s={22} center>
              {problem}
            </T>
            <PrimaryButton label="처음으로" onPress={() => router.replace('/start')} />
          </>
        ) : (
          <>
            <Spinner size={28} />
            <T s={15} c={C.sub}>
              Apple로 로그인하는 중이에요
            </T>
          </>
        )}
      </View>
    </Screen>
  );
}
