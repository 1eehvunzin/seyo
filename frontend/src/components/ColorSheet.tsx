import { useState } from 'react';
import { GestureResponderEvent, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Sheet } from '@/components/Sheets';
import { Btn, noOutline, T } from '@/components/ui';
import { C, F } from '@/theme';

/* ───────── hex ⇄ HSV ───────── */

type HSV = { h: number; s: number; v: number };

export function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: HSV): string {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const PAD_W = 280;
const PAD_H = 180;
const HUE_H = 28;

/** quick picks above the free picker */
const QUICK = ['#1d1d1f', '#6e6e73', '#3d7fd9', '#79a8e6', '#2f9e6e', '#a8dcae', '#f5d66b', '#f29b4b', '#e0577d', '#f4a6c1', '#9b6be0', '#8b5e3c'];

/** Any color (mount it when opening: it starts from `value`): a saturation/brightness pad, a hue bar, a hex field and quick picks. */
export function ColorSheet({ visible, value, title, onPick, onClose }: { visible: boolean; value: string; title: string; onPick: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hex, setHex] = useState(value);
  const set = (next: HSV) => {
    setHsv(next);
    setHex(hsvToHex(next));
  };
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : hsvToHex(hsv);

  const onPad = (e: GestureResponderEvent) => set({ h: hsv.h, s: clamp(e.nativeEvent.locationX / PAD_W), v: 1 - clamp(e.nativeEvent.locationY / PAD_H) });
  const onHue = (e: GestureResponderEvent) => set({ ...hsv, h: clamp(e.nativeEvent.locationX / PAD_W) * 359.9 });
  const drag = (fn: (e: GestureResponderEvent) => void) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: fn,
    onResponderMove: fn,
  });

  return (
    <Sheet visible={visible} onDismiss={onClose} width={PAD_W + 48} label={title}>
      <View style={{ padding: 24, gap: 16 }}>
        <T w={600} s={17}>
          {title}
        </T>

        <View accessibilityLabel="채도와 밝기" {...drag(onPad)} style={{ width: PAD_W, height: PAD_H, borderRadius: 14, overflow: 'hidden' }}>
          <Svg width={PAD_W} height={PAD_H} pointerEvents="none">
            <Defs>
              <LinearGradient id="cs-s" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#fff" stopOpacity={1} />
                <Stop offset="1" stopColor="#fff" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="cs-v" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width={PAD_W} height={PAD_H} fill={hsvToHex({ h: hsv.h, s: 1, v: 1 })} />
            <Rect width={PAD_W} height={PAD_H} fill="url(#cs-s)" />
            <Rect width={PAD_W} height={PAD_H} fill="url(#cs-v)" />
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', left: hsv.s * PAD_W - 11, top: (1 - hsv.v) * PAD_H - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: C.white, backgroundColor: color, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3 }} />
        </View>

        <View accessibilityLabel="색상" {...drag(onHue)} style={{ width: PAD_W, height: HUE_H, borderRadius: HUE_H / 2, overflow: 'hidden' }}>
          <Svg width={PAD_W} height={HUE_H} pointerEvents="none">
            <Defs>
              <LinearGradient id="cs-h" x1="0" y1="0" x2="1" y2="0">
                {[0, 60, 120, 180, 240, 300, 360].map((h) => (
                  <Stop key={h} offset={h / 360} stopColor={hsvToHex({ h: h % 360, s: 1, v: 1 })} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width={PAD_W} height={HUE_H} fill="url(#cs-h)" />
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', left: (hsv.h / 360) * PAD_W - 7, top: 2, width: 14, height: HUE_H - 4, borderRadius: 7, borderWidth: 3, borderColor: C.white, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3 }} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {QUICK.map((q) => (
            <Btn key={q} accessibilityLabel={`색 ${q}`} onPress={() => set(hexToHsv(q))} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: q, borderWidth: color === q ? 3 : 0, borderColor: C.line }}>
              <View />
            </Btn>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, borderWidth: 1, borderColor: C.line }} />
          <TextInput
            accessibilityLabel="색 코드"
            value={hex}
            onChangeText={(t) => {
              const v = t.startsWith('#') ? t : `#${t}`;
              setHex(v.slice(0, 7));
              if (/^#[0-9a-f]{6}$/i.test(v)) setHsv(hexToHsv(v));
            }}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, backgroundColor: C.fill, paddingHorizontal: 14, fontFamily: F[400], fontSize: 15, color: C.ink, ...noOutline }}
          />
        </View>
        <Btn
          onPress={() => {
            onPick(color);
            onClose();
          }}
          style={{ height: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}
        >
          <T s={15} w={500} c={C.white}>
            이 색 쓰기
          </T>
        </Btn>
      </View>
    </Sheet>
  );
}
