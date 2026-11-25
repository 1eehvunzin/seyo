import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Face, FaceStack } from '@/components/Faces';
import { AccountSheet, PaywallSheet } from '@/components/Sheets';
import { Btn, Icon, Screen, T, useLayout } from '@/components/ui';
import { WidgetView } from '@/components/WidgetView';
import { confirmAction, notice } from '@/lib/confirm';
import { longKo } from '@/lib/date';
import { Page, Person } from '@/lib/page';
import { useStore } from '@/store';
import { C } from '@/theme';

const ROW = 200;
const GAP = 20;

type Slot = { key: string; screen: number; x: number; y: number; w: number; h: number; page?: Page };

/**
 * iOS home-screen style: fill one screen of cols × rows first-fit (large widgets 2×2, small 1×1),
 * then start the next screen. A large widget is never split across screens. "새 페이지" is always last.
 */
function pack(pages: Page[], cols: number, rows: number, cell: number): { slots: Slot[]; screens: number } {
  const slots: Slot[] = [];
  let screen = 0;
  let used: boolean[][] = [];
  const tryPlace = (key: string, span: number, page?: Page) => {
    for (let r = 0; r + span <= rows; r++)
      for (let c = 0; c + span <= cols; c++) {
        let ok = true;
        for (let dr = 0; dr < span && ok; dr++) for (let dc = 0; dc < span && ok; dc++) ok = !used[r + dr]?.[c + dc];
        if (!ok) continue;
        for (let dr = 0; dr < span; dr++) for (let dc = 0; dc < span; dc++) (used[r + dr] ??= [])[c + dc] = true;
        slots.push({ key, page, screen, x: c * (cell + GAP), y: r * (ROW + GAP), w: span * cell + (span - 1) * GAP, h: span * ROW + (span - 1) * GAP });
        return true;
      }
    return false;
  };
  const place = (key: string, span: number, page?: Page) => {
    if (tryPlace(key, span, page)) return;
    screen++;
    used = [];
    tryPlace(key, span, page);
  };
  pages.forEach((p) => place(p.id, p.widget.size === 'large' ? Math.min(2, cols, rows) : 1, p));
  place('new', 1);
  return { slots, screens: screen + 1 };
}

/** 08 · 홈. 페이지가 넘치면 옆으로 넘긴다. (구독은 결제가 붙기 전까지 '곧 열려요') */
export default function Home() {
  const { pages, loggedIn, ready, plus, logout, me } = useStore();
  const ME: Person = me ? { id: me.id, name: me.name, initial: me.initial, bg: me.bg } : { id: 'me', name: '나', initial: '나', bg: '#F8D7E2' };
  const { appGutter } = useLayout();
  const pad = appGutter + 16;
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [current, setCurrent] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (!ready) return null;
  if (!loggedIn) return <Redirect href="/" />;

  const closePay = () => setPayOpen(false);

  const gridW = Math.max(0, area.w - pad * 2);
  const cols = gridW >= 900 ? 4 : gridW >= 560 ? 3 : 2;
  const cell = gridW ? (gridW - GAP * (cols - 1)) / cols : 0;
  // rows that fit the visible area; extra pages go to the next screen instead of scrolling down
  const rows = Math.max(1, Math.floor((area.h + GAP) / (ROW + GAP)));
  const { slots, screens } = gridW && area.h ? pack(pages, cols, rows, cell) : { slots: [], screens: 1 };
  const page = Math.min(current, screens - 1);

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: 28, paddingBottom: 20, gap: 28 }}>
        <View style={{ paddingHorizontal: pad, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 4 }}>
            <T s={14} c={C.muted}>
              {longKo(new Date())}
            </T>
            <T w={600} s={34} ls={-0.03} accessibilityRole="header">
              내 페이지
            </T>
          </View>
          <Btn accessibilityLabel="내 계정" onPress={() => setAccountOpen(true)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <T s={14}>{ME.initial}</T>
          </Btn>
        </View>

        <View style={{ flex: 1 }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {area.w > 0 && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={32}
              onScroll={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, area.w)))}
              accessibilityLabel={`${screens}쪽 중 ${page + 1}쪽`}
            >
              {Array.from({ length: screens }, (_, i) => (
                <View key={i} style={{ width: area.w, height: area.h }}>
                  {slots
                    .filter((s) => s.screen === i)
                    .map((s) => (
                      <View key={s.key} style={{ position: 'absolute', left: pad + s.x, top: s.y, width: s.w, height: s.h }}>
                        {s.page ? <PageTile page={s.page} /> : <NewTile />}
                      </View>
                    ))}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ height: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {screens > 1 && Array.from({ length: screens }, (_, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === page ? C.ink : C.line }} />)}
        </View>
      </View>

      <PaywallSheet
        visible={payOpen}
        onClose={closePay}
        onSubscribe={() => {
          closePay();
          notice('구독은 곧 열려요', '결제가 준비되는 대로 알려 드릴게요. 지금은 무료로 계속 쓸 수 있어요.');
        }}
      />
      <AccountSheet
        visible={accountOpen}
        plus={plus}
        onClose={() => setAccountOpen(false)}
        onPlus={() => {
          setAccountOpen(false);
          setTimeout(() => setPayOpen(true), 350);
        }}
        onLogout={() => {
          setAccountOpen(false);
          logout();
          router.replace('/');
        }}
      />
    </Screen>
  );
}

function NewTile() {
  return (
    <Btn accessibilityLabel="새 페이지" onPress={() => router.push('/generate')} style={{ flex: 1, gap: 10 }}>
      <View style={{ flex: 1, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={28} color={C.muted} />
      </View>
      <T s={14} c={C.sub} center style={{ height: 22 }}>
        새 페이지
      </T>
    </Btn>
  );
}

function PageTile({ page }: { page: Page }) {
  const { removePage, me } = useStore();
  const ME: Person = me ? { id: me.id, name: me.name, initial: me.initial, bg: me.bg } : { id: 'me', name: '나', initial: '나', bg: '#F8D7E2' };
  const remove = () =>
    page.owner
      ? confirmAction('이 페이지에서 나갈까요?', `${page.owner.name}님이 다시 초대하면 들어올 수 있어요.`, '나가기', () => removePage(page.id))
      : confirmAction('이 페이지를 지울까요?', page.members.length ? '함께 쓰던 사람들도 더는 볼 수 없어요.' : '지우면 되돌릴 수 없어요.', '지우기', () => removePage(page.id));
  const shared = page.owner === null && page.members.length > 0;
  return (
    <Btn
      accessibilityLabel={`${page.name}${page.owner ? `, ${page.owner.name}님의 페이지` : ''}`}
      onPress={() => router.push({ pathname: '/page/[id]', params: { id: page.id } })}
      onLongPress={remove}
      accessibilityHint={page.owner ? '길게 누르면 나가기' : '길게 누르면 지우기'}
      accessibilityActions={[{ name: 'remove', label: page.owner ? '나가기' : '지우기' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'remove' && remove()}
      style={{ flex: 1, gap: 10 }}
    >
      <WidgetView page={page} />
      <View style={{ height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <T s={14} numberOfLines={1} style={{ flexShrink: 1 }}>
          {page.name}
        </T>
        {shared && <FaceStack people={[ME, ...page.members]} />}
        {page.owner && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Face p={page.owner} size={18} ring="transparent" />
            <T s={12} c={C.muted}>
              {page.owner.name}
            </T>
          </View>
        )}
      </View>
    </Btn>
  );
}
