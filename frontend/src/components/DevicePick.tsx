import { View } from 'react-native';
import { Btn, T } from '@/components/ui';
import { SheetKind } from '@/lib/page';
import { C } from '@/theme';

const OPTIONS: { id: SheetKind; label: string }[] = [
  { id: 'portrait', label: 'A4 세로' },
  { id: 'landscape', label: 'A4 가로' },
];

/** Which way the new page's A4 sheet turns. The AI lays the page out for that fixed frame. */
export function DevicePick({ value, onChange }: { value: SheetKind; onChange: (d: SheetKind) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="시트 방향" style={{ flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: C.fill }}>
        {OPTIONS.map((o) => {
          const on = value === o.id;
          return (
            <Btn
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.id)}
              style={{ height: 30, paddingHorizontal: 14, borderRadius: 15, justifyContent: 'center', backgroundColor: on ? C.white : 'transparent' }}
            >
              <T s={13} w={on ? 600 : 400} c={on ? C.ink : C.sub}>
                {o.label}
              </T>
            </Btn>
          );
        })}
      </View>
    </View>
  );
}
