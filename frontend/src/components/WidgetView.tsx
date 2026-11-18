import { View } from 'react-native';
import { WEEK_KO } from '@/lib/date';
import { Page, Widget, WidgetTpl } from '@/lib/page';
import { bigNumber, dots, fallback, nextItem, shortList } from '@/lib/widget';
import { C, THEMES } from '@/theme';
import { Star, T } from './ui';

/** Renders one home widget from fixed templates, reading the page's data live. */
export function WidgetView({ page, widget = page.widget, scale = 1 }: { page: Page; widget?: Widget; scale?: number }) {
  const th = THEMES[page.theme];
  const large = widget.size === 'large';
  const pad = (large ? 26 : 22) * scale;
  const tpls = widget.templates;
  return (
    <View style={{ flex: 1, borderRadius: (large ? 28 : 28) * scale, backgroundColor: th.card, padding: pad, overflow: 'hidden', justifyContent: large ? 'flex-start' : 'space-between', gap: 20 * scale }}>
      {large && <Star size={110 * scale} fill={th.star} style={{ position: 'absolute', right: -16 * scale, bottom: -20 * scale }} />}
      {large && tpls.length === 2 && tpls[0] === 'bigNumber' ? (
        <>
          <BigRow page={page} scale={scale} />
          <Tpl t={tpls[1]} page={page} scale={scale} large />
        </>
      ) : (
        tpls.map((t) => <Tpl key={t} t={t} page={page} scale={scale} large={large} />)
      )}
    </View>
  );
}

/** large: label left, number right (design's big tile header) */
function BigRow({ page, scale }: { page: Page; scale: number }) {
  const b = bigNumber(page);
  if (!b) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <T s={13 * scale} c={C.sub}>
        {b.label}
      </T>
      <T w={200} s={64 * scale} ls={-0.04} style={{ lineHeight: 64 * scale }}>
        {b.value}
      </T>
    </View>
  );
}

function Tpl({ t, page, scale, large }: { t: WidgetTpl; page: Page; scale: number; large: boolean }) {
  const s = (n: number) => n * scale;
  if (t === 'bigNumber') {
    const b = bigNumber(page);
    if (!b) return <Tpl t="fallback" page={page} scale={scale} large={large} />;
    return (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <T s={s(13)} c={C.sub} numberOfLines={1}>
          {b.label}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(6) }}>
          <T w={b.value.startsWith('D') ? 200 : 300} s={s(52)} ls={-0.04} style={{ lineHeight: s(56) }}>
            {b.value}
          </T>
          {!!b.suffix && (
            <T s={s(14)} c={C.sub}>
              {b.suffix}
            </T>
          )}
        </View>
      </View>
    );
  }
  if (t === 'shortList') {
    const l = shortList(page);
    if (!l) return <Tpl t="fallback" page={page} scale={scale} large={large} />;
    const items = large ? l.items : l.items.slice(0, 2);
    return (
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: s(8), borderBottomWidth: 1, borderBottomColor: C.ink }}>
          <T s={s(13)} c={C.sub} numberOfLines={1}>
            {l.title}
          </T>
          {!!l.count && (
            <T s={s(13)} c={C.sub}>
              {l.count}
            </T>
          )}
        </View>
        {items.length === 0 && (
          <T s={s(14)} c={C.faint} style={{ paddingTop: s(12) }}>
            비어 있어요
          </T>
        )}
        {items.map((it, i) => (
          <View key={i} style={{ height: s(large ? 42 : 34), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: C.rowLine }}>
            <T s={s(large ? 15 : 13)} c={it.done ? C.faint : C.ink} numberOfLines={1} style={{ flex: 1, textDecorationLine: it.done ? 'line-through' : 'none' }}>
              {it.text}
            </T>
            <View style={{ width: s(16), height: s(16), borderRadius: s(8), backgroundColor: it.done ? C.ink : 'transparent', borderWidth: it.done ? 0 : 1.5, borderColor: C.ring }} />
          </View>
        ))}
      </View>
    );
  }
  if (t === 'dots') {
    const d = dots(page);
    if (!d) return <Tpl t="fallback" page={page} scale={scale} large={large} />;
    return (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <T s={s(13)} c={C.sub} numberOfLines={1}>
          {d.label}
        </T>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {WEEK_KO.map((l, i) => (
            <View key={l} style={{ alignItems: 'center', gap: s(6) }}>
              <View style={{ width: s(18), height: s(18), borderRadius: s(9), backgroundColor: d.days[i] ? C.done : C.rowLine }} />
              <T s={s(11)} c={i === d.today ? C.ink : C.sub} w={i === d.today ? 600 : 400}>
                {l}
              </T>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (t === 'nextItem') {
    const n = nextItem(page);
    if (!n) return <Tpl t="fallback" page={page} scale={scale} large={large} />;
    return (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <T s={s(13)} c={C.sub}>
          {n.label}
        </T>
        <View style={{ gap: s(2) }}>
          <T w={600} s={s(26)} ls={-0.03} numberOfLines={2}>
            {n.title}
          </T>
          {!!n.sub && (
            <T s={s(14)} c={C.sub}>
              {n.sub}
            </T>
          )}
        </View>
      </View>
    );
  }
  const f = fallback(page);
  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <T s={s(13)} c={C.sub}>
        {f.sub}
      </T>
      <T w={600} s={s(24)} ls={-0.03} numberOfLines={2}>
        {f.name}
      </T>
    </View>
  );
}
