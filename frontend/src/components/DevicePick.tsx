import { View } from 'react-native';
import { Btn, T } from '@/components/ui';
import { Device } from '@/lib/page';
import { C } from '@/theme';

const OPTIONS: { id: Device; label: string }[] = [
  { id: 'tablet', label: '아이패드용' },
  { id: 'phone', label: '휴대폰용' },
];

/** Which screen the new page is for. The AI lays the page out for it. */
export function DevicePick({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="어디서 쓸 페이지인지" style={{ flexDirection: 'row', padding: 3, borderRadius: 18, backgroundColor: C.fill }}>
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
