import { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, ScrollViewInstance, View } from 'react-native';
import { AppFrame } from '@/components/AppFrame';
import { Btn, Icon, T } from '@/components/ui';
import { InkCmd } from '@/lib/appdoc';
import { confirmAction } from '@/lib/confirm';
import { Device, isSheet, SHEET, SheetKind } from '@/lib/page';
import { C } from '@/theme';

const GAP = 20;
const PAD = 16;
/** don't blow a sheet up past this on very wide windows */
const MAX_SCALE = 1.4;
/** pinch zoom, Goodnotes-style: from fit-to-width up to this */
const MAX_ZOOM = 3;

type Props = {
  kind: SheetKind;
  html: string;
  /** one state per sheet: sheet 1 is the page's own state */
  states: Record<string, unknown>[];
  /** a sheet saved its data (absent: read-only, e.g. a preview) */
  onSave?: (index: number, state: Record<string, unknown>) => void;
  /** 시트 추가 / 빼기 (absent: no controls) */
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onError?: (error: string) => void;
  ink?: InkCmd;
  /** still being written by the AI */
  live?: boolean;
};

/**
 * A4 pages (Goodnotes-style): each sheet is the app laid out at A4 size (794×1123 세로 /
 * 1123×794 가로) and scaled to fit the width, so a page looks the same on any screen and the
 * AI designs for one fixed frame. More sheets of the same layout stack below, each with its own data.
 * Pinch (two fingers, or a trackpad) zooms the stack: out until a whole sheet fits on screen, in
 * up to 3× (then it pans sideways as well).
 */
export function SheetStack({ kind, html, states, onSave, onAdd, onRemove, onError, ink, live }: Props) {
  const size = SHEET[kind];
  const [box, setBox] = useState({ w: 0, h: 0 });
  /** fit-to-width scale (zoom 1×, where a page opens); pinch zooms up to MAX_ZOOM */
  const fit = box.w ? Math.min(MAX_SCALE, (box.w - PAD * 2) / size.w) : 0;
  /** zoomed all the way out, a whole sheet fits on screen (never more than fit-to-width) */
  const minZoom = fit && box.h > PAD * 2 ? Math.min(1, (box.h - PAD * 2) / size.h / fit) : 1;
  const [zoom, setZoom] = useState(1);
  /** during a pinch: how much more than `zoom` (drawn as a transform, laid out when the fingers lift) */
  const [pinch, setPinch] = useState({ s: 1, ox: 0, oy: 0 });
  const k = fit * zoom;
  const sw = size.w * k;
  const sh = size.h * k;
  const contentW = Math.max(box.w, sw + PAD * 2);
  const scroller = useRef<ScrollViewInstance>(null);
  const sideways = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  const x = useRef(0);
  /** the sheet most in view: one-off 필기 actions (photo, undo) go to it */
  const [active, setActive] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = e.nativeEvent.contentOffset.y;
    if (!sh) return;
    const i = Math.max(0, Math.min(states.length - 1, Math.floor((y.current + box.h / 2 - PAD) / (sh + GAP))));
    if (i !== active) setActive(i);
  };
  const scrollBy = (dy: number) => {
    y.current = Math.max(0, y.current + dy * k);
    scroller.current?.scrollTo({ y: y.current, animated: false });
  };

  /** lay out at a new zoom, keeping the middle of the screen where it was */
  const zoomTo = (z: number) => {
    const next = Math.max(minZoom, Math.min(MAX_ZOOM, z));
    const r = next / zoom;
    setPinch({ s: 1, ox: 0, oy: 0 });
    if (Math.abs(r - 1) < 0.01) return;
    setZoom(next);
    const nx = Math.max(0, (x.current + box.w / 2) * r - box.w / 2);
    const ny = Math.max(0, (y.current + box.h / 2) * r - box.h / 2);
    setTimeout(() => {
      sideways.current?.scrollTo({ x: next > 1 ? nx : 0, animated: false });
      scroller.current?.scrollTo({ y: ny, animated: false });
    }, 0);
  };
  const onPinch = (m: { scale?: number; step?: number; end?: boolean }) => {
    if (m.step) zoomTo(zoom * m.step);
    // the pinch grows from the middle of what's on screen
    else if (m.scale) setPinch({ s: Math.max(minZoom, Math.min(MAX_ZOOM, zoom * m.scale)) / zoom, ox: x.current + box.w / 2, oy: y.current + box.h / 2 });
    else if (m.end) zoomTo(zoom * pinch.s);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {fit > 0 && (
        // zoomed in past the width: the sheets pan sideways too
        <ScrollView ref={sideways} horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1} onScroll={(e) => (x.current = e.nativeEvent.contentOffset.x)} scrollEventThrottle={64} contentContainerStyle={{ width: contentW }}>
        <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={64} style={{ width: contentW, height: box.h }} contentContainerStyle={{ padding: PAD, gap: GAP, alignItems: 'center', transform: pinch.s !== 1 ? [{ scale: pinch.s }] : undefined, transformOrigin: [pinch.ox, pinch.oy, 0] }}>
          {states.map((st, i) => (
            <View key={i} style={{ gap: 8 }}>
              <View
                accessibilityLabel={`${i + 1}번째 시트`}
                style={{ width: sw, height: sh, backgroundColor: C.white, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.line, shadowColor: C.ink, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
              >
                <AppFrame
                  // a WebView fits the sheet when it loads: a new scale lays it out again (web just rescales)
                  key={Platform.OS === 'web' ? i : `${i}-${Math.round(k * 100)}`}
                  html={html}
                  state={st}
                  live={live}
                  sheet={{ ...size, k }}
                  onSave={onSave ? (s) => onSave(i, s) : undefined}
                  onError={i === 0 ? onError : undefined}
                  ink={ink && (i === active ? ink : { tool: ink.tool, color: ink.color, seq: ink.seq })}
                  onScrollBy={scrollBy}
                  onPinch={onPinch}
                />
              </View>
              {states.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <T s={12.5} c={C.muted}>
                    {i + 1} / {states.length}
                  </T>
                  {i > 0 && onRemove && (
                    <Btn accessibilityLabel={`${i + 1}번째 시트 빼기`} onPress={() => confirmAction('이 시트를 뺄까요?', '이 시트에 쓴 내용도 함께 사라져요.', '빼기', () => onRemove(i))} style={{ height: 28, paddingHorizontal: 8, justifyContent: 'center' }}>
                      <T s={12.5} c={C.sub}>
                        빼기
                      </T>
                    </Btn>
                  )}
                </View>
              )}
            </View>
          ))}
          {onAdd && !live && (
            <Btn
              accessibilityLabel="같은 양식으로 시트 한 장 더"
              onPress={() => {
                onAdd();
                setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
              }}
              style={{ width: sw, height: 52, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Icon name="plus" size={16} color={C.sub} />
              <T s={14} c={C.sub}>
                시트 추가
              </T>
            </Btn>
          )}
        </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

/** The app while the AI is still writing it: on its A4 sheet when the page is one. */
export function LiveApp({ html, device }: { html: string; device?: Device }) {
  return isSheet(device) ? <SheetStack kind={device} html={html} states={[{}]} live /> : <AppFrame html={html} state={{}} live />;
}
