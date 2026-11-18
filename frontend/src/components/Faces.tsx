import { View } from 'react-native';
import { Person } from '@/lib/page';
import { C } from '@/theme';
import { T } from './ui';

export function Face({ p, size = 22, ring = C.white }: { p: Person; size?: number; ring?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.bg, borderWidth: 2, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}>
      <T s={size * 0.45} allowFontScaling={false}>
        {p.initial}
      </T>
    </View>
  );
}

/** Overlapping faces, max 3. */
export function FaceStack({ people, size = 22, ring = C.white }: { people: Person[]; size?: number; ring?: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingLeft: 6 }} accessibilityLabel={`함께 쓰는 사람 ${people.length}명`}>
      {people.slice(0, 3).map((p) => (
        <View key={p.id} style={{ marginLeft: -6 }}>
          <Face p={p} size={size} ring={ring} />
        </View>
      ))}
    </View>
  );
}
