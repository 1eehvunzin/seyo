import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ColorSheet } from '@/components/ColorSheet';
import { Btn, Icon } from '@/components/ui';
import { InkCmd } from '@/lib/appdoc';
import { C } from '@/theme';

type Tool = InkCmd['tool'];
type Colored = 'pen' | 'marker';

const PRESETS: Record<Colored, string[]> = {
  pen: ['#1d1d1f', '#3d7fd9', '#e0577d'],
  marker: ['#f5d66b', '#f4a6c1', '#9cc8f2', '#a8dcae'],
};
export const DEFAULT_INK = { pen: PRESETS.pen[0], marker: PRESETS.marker[0] };

/** colors picked from the free picker this session (newest first), per tool */
const recent: Record<Colored, string[]> = { pen: [], marker: [] };

const TOOLS: { id: Tool; icon: 'pen' | 'highlighter' | 'eraser' | 'lasso'; label: string }[] = [
  { id: 'pen', icon: 'pen', label: '펜' },
  { id: 'marker', icon: 'highlighter', label: '형광펜' },
  { id: 'eraser', icon: 'eraser', label: '지우개' },
  { id: 'lasso', icon: 'lasso', label: '올가미: 둘러서 고르고 옮기기' },
];

/**
 * 필기 mode toolbar (Goodnotes-style, icons only): pen, highlighter, eraser, lasso · the colors of
 * the pen/highlighter with a picker for any color · add a photo, undo.
 * One row that scrolls sideways on narrow screens.
 */
export function InkBar({ tool, colors, onTool, onColor, onPhoto, onUndo }: { tool: Tool; colors: Record<Colored, string>; onTool: (t: Tool) => void; onColor: (c: string) => void; onPhoto: () => void; onUndo: () => void }) {
  const [picking, setPicking] = useState(false);
  const pill = (on: boolean) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: on ? C.ink : C.fill });
  const colored: Colored | null = tool === 'pen' || tool === 'marker' ? tool : null;
  const swatches = colored ? [...recent[colored], ...PRESETS[colored]].filter((c, i, a) => a.indexOf(c) === i).slice(0, 6) : [];
  if (colored && !swatches.includes(colors[colored])) swatches.unshift(colors[colored]);
  const divider = <View style={{ width: 1, height: 24, backgroundColor: C.line, marginHorizontal: 2 }} />;

  return (
    // fixed height: a horizontal ScrollView otherwise grows in the column and covers the page
    <View style={{ height: 52 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 2, flexGrow: 1, justifyContent: 'center' }}>
        {TOOLS.map((t) => {
          const on = tool === t.id;
          return (
            <Btn key={t.id} accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onTool(t.id)} style={pill(on)}>
              <Icon name={t.icon} size={22} color={on ? C.white : C.ink} stroke={1.7} />
            </Btn>
          );
        })}

        {colored && (
          <>
            {divider}
            {swatches.map((c) => {
              const on = colors[colored] === c;
              return (
                <Btn key={c} accessibilityLabel={`색 ${c}`} accessibilityState={{ selected: on }} onPress={() => onColor(c)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2 : 0, borderColor: C.ink }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, borderWidth: c.toLowerCase() === '#ffffff' ? 1 : 0, borderColor: C.line }} />
                </Btn>
              );
            })}
            <Btn accessibilityLabel="다른 색 고르기" onPress={() => setPicking(true)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={26} height={26} viewBox="0 0 26 26">
                <Defs>
                  <LinearGradient id="ink-any" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#f4a6c1" />
                    <Stop offset="0.5" stopColor="#f5d66b" />
                    <Stop offset="1" stopColor="#79a8e6" />
                  </LinearGradient>
                </Defs>
                <Circle cx={13} cy={13} r={11} fill="url(#ink-any)" />
                <Circle cx={13} cy={13} r={5} fill={C.white} />
              </Svg>
            </Btn>
          </>
        )}

        {divider}
        <Btn accessibilityLabel="사진 넣기" onPress={onPhoto} style={pill(false)}>
          <Icon name="image" size={22} stroke={1.7} />
        </Btn>
        <Btn accessibilityLabel="되돌리기" onPress={onUndo} style={pill(false)}>
          <Icon name="undo" size={22} stroke={1.7} />
        </Btn>
      </ScrollView>

      {colored && picking && (
        <ColorSheet
          visible
          value={colors[colored]}
          title={colored === 'pen' ? '펜 색' : '형광펜 색'}
          onClose={() => setPicking(false)}
          onPick={(c) => {
            recent[colored] = [c, ...recent[colored].filter((x) => x !== c)].slice(0, 3);
            onColor(c);
          }}
        />
      )}
    </View>
  );
}
