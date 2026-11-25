import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Spinner } from '@/components/Making';
import { PrimaryButton, Screen, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { kakaoRedirectUri, takeKakaoPending } from '@/lib/kakao';
import { useStore } from '@/store';
import { C } from '@/theme';

/** Web: Kakao sent the user back here with ?code=. Finish the login and bring back what they made. */
export default function KakaoReturn() {
  const { code, state, error } = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const { login, setPendingInvite } = useStore();
  const [failed, setFailed] = useState<string | null>(null);
  const once = useRef(false);
  // cancelled on Kakao's page (or opened without a code)
  const cancelled = error || !code ? (error === 'access_denied' ? '로그인을 취소했어요' : '카카오 로그인을 하지 못했어요') : null;
  const problem = cancelled ?? failed;

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const pending = takeKakaoPending(state);
    if (error || !code) return;
    api
      .loginKakaoCode(code, kakaoRedirectUri())
      .then(() => {
        if (pending?.invite) setPendingInvite(pending.invite);
        login('kakao', { real: true, draft: pending?.draft ?? null });
        router.replace('/home');
      })
      .catch((e) => setFailed(e instanceof ApiError ? e.message : '카카오 로그인을 하지 못했어요. 잠시 뒤 다시 해 주세요'));
  }, [code, state, error, login, setPendingInvite]);

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
              카카오로 로그인하는 중이에요
            </T>
          </>
        )}
      </View>
    </Screen>
  );
}
