import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '@/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

const noop = () => () => {};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Pretendard-ExtraLight': require('../../assets/fonts/Pretendard-ExtraLight.otf'),
    'Pretendard-Light': require('../../assets/fonts/Pretendard-Light.otf'),
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  });

  // 웹(output: server)에서는 SSR 시 창 크기가 0이라 useLayout 기반 레이아웃(스플래시 별 등)이
  // 0 크기로 렌더되고, hydration 때 보정되지 않는다. 브라우저에 마운트된 뒤에만 렌더한다.
  // server snapshot false → hydration renders nothing, then React re-renders with the client value
  const mounted = useSyncExternalStore(noop, () => true, () => Platform.OS !== 'web');

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if ((!loaded && !error) || !mounted) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' }, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="start" options={{ gestureEnabled: false }} />
          <Stack.Screen name="making" options={{ gestureEnabled: false }} />
          <Stack.Screen name="demo" options={{ gestureEnabled: false }} />
          <Stack.Screen name="home" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="page/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="generate" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
