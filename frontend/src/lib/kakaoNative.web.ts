/** Web uses the redirect flow (lib/kakao.ts); the native SDK isn't part of the web bundle. */
export async function kakaoNativeToken(): Promise<string> {
  throw new Error('native only');
}

export const isKakaoCancel = (_e: unknown) => false;
