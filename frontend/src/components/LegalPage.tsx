import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { LegalDoc } from '@/lib/legal';
import { C } from '@/theme';
import { IconButton, Screen, T, useLayout } from './ui';

/** /terms, /privacy: a plain reading page (also reachable without logging in). */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { appGutter } = useLayout();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: appGutter, paddingTop: 16, paddingBottom: 64 }}>
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -10 }}>
            <IconButton name="back" label="뒤로" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>
          <View style={{ gap: 8 }}>
            <T w={600} s={30} ls={-0.03} accessibilityRole="header">
              {doc.title}
            </T>
            <T s={13} c={C.muted}>
              시행일 {doc.updated}
            </T>
            <T s={15} c={C.sub} lh={1.65} style={{ marginTop: 8 }}>
              {doc.intro}
            </T>
          </View>
          {doc.sections.map((s) => (
            <View key={s.h} style={{ gap: 10 }}>
              <T w={600} s={17}>
                {s.h}
              </T>
              {s.p?.map((p) => (
                <T key={p} s={15} c={C.ink2} lh={1.7}>
                  {p}
                </T>
              ))}
              {s.li?.map((li) => (
                <View key={li} style={{ flexDirection: 'row', gap: 10, paddingLeft: 4 }}>
                  <T s={15} c={C.muted} lh={1.7}>
                    •
                  </T>
                  <T s={15} c={C.ink2} lh={1.7} style={{ flex: 1 }}>
                    {li}
                  </T>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
