import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { BRAND_GRADIENT, C, F, STAR, Weight } from '@/theme';

/* ───────── layout ───────── */

/** iPad-first sizing. The design is drawn at 1194×834 (iPad Pro 11" landscape). */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const compact = width < 900; // portrait iPad or split view
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    width,
    height,
    landscape,
    compact,
    /** onboarding gutter: 96 at 1194 wide */
    gutter: clamp(width * 0.08, 32, 120),
    /** app screens gutter: 48 at 1194 wide */
    appGutter: clamp(width * 0.04, 24, 64),
  };
}

export function Screen({ children, bg = C.white, style }: { children: ReactNode; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[{ flex: 1, backgroundColor: bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

/* ───────── type ───────── */

type TProps = TextProps & { w?: Weight; s?: number; c?: string; ls?: number; lh?: number; center?: boolean; style?: StyleProp<TextStyle> };

/** Pretendard text. `ls` is letter-spacing in em (like the design's CSS). */
export function T({ w = 400, s = 15, c = C.ink, ls = 0, lh, center, style, ...rest }: TProps) {
  return (
    <Text
      // honor Dynamic Type, capped so fixed-height pills and tiles from the design don't clip
      maxFontSizeMultiplier={1.2}
      {...rest}
      style={[
        { fontFamily: F[w], fontSize: s, color: c, letterSpacing: ls * s, lineHeight: lh ? lh * s : undefined, textAlign: center ? 'center' : undefined },
        style,
      ]}
    />
  );
}

/* ───────── icons ───────── */

/** Brand star. `outline` draws the landing's ink stroke (as a fraction of the 24-unit box). */
export function Star({ size, fill, outline, style }: { size: number; fill: string; outline?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={style}>
      <Svg width={size} height={size} viewBox="-0.5 -0.5 25 25">
        <Path d={STAR} fill={fill} stroke={outline ? C.ink : undefined} strokeWidth={outline} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** The seyo.. wordmark (landing assets/img/wordmark.svg). */
const WORDMARK_VB = '70 840 4730 1530';
const WORDMARK = ['M742 1146H910C888 970 746 850 522 850C282 850 120 984 120 1170C120 1314 220 1418 410 1462L574 1500C698 1528 752 1580 752 1656C752 1758 654 1822 500 1822C364 1822 286 1772 266 1666H86C114 1864 260 1972 504 1972C776 1972 930 1834 930 1646C930 1494 834 1398 640 1352L478 1312C350 1282 292 1232 292 1160C292 1068 388 996 522 996C650 996 718 1056 742 1146ZM1507.6 1972C1731.6 1972 1891.6 1860 1943.6 1696H1759.6C1719.6 1764 1637.6 1820 1507.6 1820C1313.6 1820 1179.6 1694 1171.6 1464H1959.6V1392C1959.6 990 1719.6 850 1491.6 850C1195.6 850 999.6 1082 999.6 1416C999.6 1750 1193.6 1972 1507.6 1972ZM1173.6 1318C1183.6 1150 1303.6 1002 1491.6 1002C1669.6 1002 1785.6 1136 1785.6 1318ZM2191.2 2358C2345.2 2358 2451.2 2276 2515.2 2106L2975.2 864H2787.2L2491.2 1726H2479.2L2183.2 864H1995.2L2397.2 1958L2365.2 2040C2307.2 2198 2249.2 2204 2179.2 2204C2153.2 2204 2113.2 2202 2095.2 2200V2354C2117.2 2356 2153.2 2358 2191.2 2358ZM3506.8 1972C3800.8 1972 3998.8 1750 3998.8 1412C3998.8 1074 3800.8 850 3506.8 850C3210.8 850 3010.8 1074 3010.8 1412C3010.8 1750 3210.8 1972 3506.8 1972ZM3506.8 1820C3284.8 1820 3182.8 1628 3182.8 1412C3182.8 1196 3284.8 1002 3506.8 1002C3724.8 1002 3826.8 1196 3826.8 1412C3826.8 1628 3724.8 1820 3506.8 1820ZM4244.4 1962C4314.4 1962 4372.4 1904 4372.4 1832C4372.4 1762 4314.4 1704 4244.4 1704C4174.4 1704 4114.4 1762 4116.4 1832C4114.4 1904 4174.4 1962 4244.4 1962ZM4662 1962C4732 1962 4790 1904 4790 1832C4790 1762 4732 1704 4662 1704C4592 1704 4532 1762 4534 1832C4532 1904 4592 1962 4662 1962Z'];
const [, , WM_W, WM_H] = WORDMARK_VB.split(' ').map(Number);
export function Wordmark({ height, color = C.ink }: { height: number; color?: string }) {
  return (
    <Svg accessibilityLabel="seyo.." width={(height * WM_W) / WM_H} height={height} viewBox={WORDMARK_VB}>
      {WORDMARK.map((d, i) => (
        <Path key={i} d={d} fill={color} />
      ))}
    </Svg>
  );
}

/** Landing cover background: baby blue → baby pink, left to right. */
export function BrandBg({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="seyo-bg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={BRAND_GRADIENT[0]} />
            <Stop offset="1" stopColor={BRAND_GRADIENT[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#seyo-bg)" />
      </Svg>
    </View>
  );
}

type IconName = 'back' | 'check' | 'plus' | 'close' | 'pencil' | 'send' | 'camera' | 'play' | 'pause' | 'reset' | 'bell' | 'share' | 'image' | 'external';

export function Icon({ name, size = 22, color = C.ink, stroke = 1.6 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {name === 'check' && <Path d="M5 12l5 5 9-10" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'pencil' && <Path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" {...p} />}
      {name === 'send' && <Path d="M12 19V5M6 11l6-6 6 6" {...p} />}
      {name === 'camera' && (
        <>
          <Path d="M4 8h3l2-3h6l2 3h3v11H4z" {...p} />
          <Circle cx={12} cy={13} r={3.5} {...p} />
        </>
      )}
      {name === 'play' && <Path d="M8 5l11 7-11 7z" {...p} />}
      {name === 'pause' && <Path d="M9 5v14M15 5v14" {...p} />}
      {name === 'reset' && <Path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" {...p} />}
      {name === 'bell' && <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20h4" {...p} />}
      {name === 'external' && <Path d="M7 17L17 7M8.5 7H17v8.5" {...p} />}
      {name === 'image' && (
        <>
          <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" {...p} />
          <Path d="M4.5 16l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" {...p} />
          <Circle cx={15.5} cy={8.5} r={1.5} {...p} />
        </>
      )}
      {name === 'share' && (
        <>
          <Path d="M12 15V3M7 8l5-5 5 5" {...p} />
          <Path d="M5 12v7h14v-7" {...p} />
        </>
      )}
    </Svg>
  );
}

/* ───────── controls ───────── */

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

type BtnProps = Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode; /** read-only use: don't fade when disabled */ readOnly?: boolean };

/** Pressable with a quiet pressed state. */
export function Btn({ style, children, onPress, disabled, readOnly, hitSlop = 8, ...rest }: BtnProps) {
  return (
    <Pressable
      accessibilityRole="button"
      // design pills are 36–40pt tall; the slop keeps the touch area at the 44pt HIG floor
      hitSlop={hitSlop}
      disabled={disabled}
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [style, { opacity: disabled ? (readOnly ? 1 : 0.35) : pressed ? 0.6 : 1 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled, style, h = 56 }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; h?: number }) {
  return (
    <Btn
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[{ height: h, paddingHorizontal: 36, borderRadius: h / 2, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <T s={16} c={C.white}>
        {label}
      </T>
    </Btn>
  );
}

export function IconButton({ name, label, onPress, bg = 'transparent', color = C.ink, size = 44, iconSize = 22 }: { name: IconName; label: string; onPress?: () => void; bg?: string; color?: string; size?: number; iconSize?: number }) {
  return (
    <Btn onPress={onPress} accessibilityLabel={label} hitSlop={6} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color={color} size={iconSize} stroke={name === 'send' ? 1.8 : 1.6} />
    </Btn>
  );
}

/** Selectable pill (onboarding chips, reasons, log fields). */
export function Chip({ label, on, onPress, accent = C.accent, h = 52, radius, s = 15.5, full }: { label: string; on: boolean; onPress: () => void; accent?: string; h?: number; radius?: number; s?: number; full?: boolean }) {
  return (
    <Btn
      onPress={onPress}
      accessibilityState={{ selected: on }}
      style={{
        height: h,
        paddingHorizontal: 22,
        borderRadius: radius ?? h / 2,
        borderWidth: on ? 1.5 : 1,
        borderColor: on ? accent : C.line,
        backgroundColor: on ? C.accentSoft : C.white,
        justifyContent: 'center',
        alignSelf: full ? 'stretch' : 'flex-start',
      }}
    >
      <T s={s} w={on ? 500 : 400} c={on ? C.ink : C.ink2}>
        {label}
      </T>
    </Btn>
  );
}

export function Progress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View accessibilityLabel={`${total}단계 중 ${step}단계`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: i < step ? C.ink : C.track }} />
      ))}
    </View>
  );
}

/**
 * Web: no browser focus box on text fields that sit inside our own rounded field (the field's
 * border already shows focus). Spread into the TextInput style.
 */
export const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

export const hidden = StyleSheet.create({ sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } }).sr;
