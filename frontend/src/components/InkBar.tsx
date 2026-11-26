import { ScrollView, View } from 'react-native';
import { Btn, T } from '@/components/ui';
import { InkCmd } from '@/lib/appdoc';
import { C } from '@/theme';

/** pen colors: ink, and two strong marker colors from the page kit */
const PENS = [
  { color: '#1d1d1f', label: '검정 펜' },
  { color: '#3d7fd9', label: '파랑 펜' },
  { color: '#e0577d', label: '빨강 펜' },
];
const HIGHLIGHT = '#f5d66b';

type Tool = InkCmd['tool'];

/**
 * 필기 mode toolbar (Goodnotes-style): pens, highlighter, eraser, move photos, add a photo, undo.
 * One row that scrolls sideways on narrow screens.
 */
export function InkBar({ tool, color, onTool, onPhoto, onUndo }: { tool: Tool; color: string; onTool: (t: Tool, color?: string) => void; onPhoto: () => void; onUndo: () => void }) {
  const pill = (on: boolean) => ({ height: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: on ? C.ink : C.fill });
  const word = (label: string, on: boolean) => (
    <T s={14} w={on ? 600 : 400} c={on ? C.white : C.ink}>
      {label}
    </T>
  );
  return (
    // fixed height: a horizontal ScrollView otherwise grows in the column and covers the page
    <View style={{ height: 52 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 2, flexGrow: 1, justifyContent: 'center' }}>
      {PENS.map((p) => {
        const on = tool === 'pen' && color === p.color;
        return (
          <Btn key={p.color} accessibilityRole="button" accessibilityLabel={p.label} accessibilityState={{ selected: on }} onPress={() => onTool('pen', p.color)} style={pill(on)}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.color, borderWidth: on ? 2 : 0, borderColor: C.white }} />
          </Btn>
        );
      })}
      <Btn accessibilityLabel="형광펜" accessibilityState={{ selected: tool === 'marker' }} onPress={() => onTool('marker', HIGHLIGHT)} style={pill(tool === 'marker')}>
        {word('형광펜', tool === 'marker')}
      </Btn>
      <Btn accessibilityLabel="지우개" accessibilityState={{ selected: tool === 'eraser' }} onPress={() => onTool('eraser')} style={pill(tool === 'eraser')}>
        {word('지우개', tool === 'eraser')}
      </Btn>
      <Btn accessibilityLabel="사진 옮기기" accessibilityState={{ selected: tool === 'move' }} onPress={() => onTool('move')} style={pill(tool === 'move')}>
        {word('옮기기', tool === 'move')}
      </Btn>
      <View style={{ width: 1, height: 24, backgroundColor: C.line, marginHorizontal: 2 }} />
      <Btn accessibilityLabel="사진 넣기" onPress={onPhoto} style={pill(false)}>
        {word('사진', false)}
      </Btn>
      <Btn accessibilityLabel="되돌리기" onPress={onUndo} style={pill(false)}>
        {word('되돌리기', false)}
      </Btn>
    </ScrollView>
    </View>
  );
}
