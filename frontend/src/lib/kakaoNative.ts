/**
 * iPad: Kakao login through the native SDK (KakaoTalk app if installed, else Kakao account in a
 * browser sheet). Returns the access token the server verifies (POST /auth/kakao checks it was
 * issued for this app, KAKAO_APP_ID). Needs a development/production build (not Expo Go).
 */
import { login } from '@react-native-seoul/kakao-login';

export async function kakaoNativeToken(): Promise<string> {
  const t = await login();
  return t.accessToken;
}

/** The user closed the Kakao screen (not an error to show). */
export const isKakaoCancel = (e: unknown) => /cancel/i.test(String((e as { message?: string })?.message ?? e));
