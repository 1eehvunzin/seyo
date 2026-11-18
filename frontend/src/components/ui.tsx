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
import Svg, { Circle, Path } from 'react-native-svg';
import { C, F, STAR, Weight } from '@/theme';

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

export function Star({ size, fill, style }: { size: number; fill: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR} fill={fill} />
      </Svg>
    </View>
  );
}

type IconName = 'back' | 'check' | 'plus' | 'close' | 'pencil' | 'send' | 'camera' | 'play' | 'pause' | 'reset' | 'bell' | 'share';

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

export const hidden = StyleSheet.create({ sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } }).sr;
