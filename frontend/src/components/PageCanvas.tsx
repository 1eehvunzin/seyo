import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, TextInput, View, ViewStyle } from 'react-native';
import { addDays, dday, parseLooseDate, shortEn, WEEK_KO, weekdayIndex } from '@/lib/date';
import { Change, isSheet, LogField, Main, Page, Todo, uid } from '@/lib/page';
import { nextClass, TIMETABLE_DAYS, TIMETABLE_PERIODS } from '@/lib/timetable';
import { C, F, THEMES, TIMETABLE } from '@/theme';
import { InkCmd } from '@/lib/appdoc';
import { AppFrame } from './AppFrame';
import { SheetStack } from './SheetStack';
import { Btn, Chip, Icon, IconButton, Star, T } from './ui';

type Props = {
  page: Page;
  onChange?: (p: Page) => void;
  highlight?: Change | null;
  accent?: string;
  /** wrong-note sections to show (Generate reveals them one by one); undefined = all */
  reveal?: Set<string>;
  /** sections still being made, drawn faint */
  pending?: Set<string>;
  scroll?: boolean;
  /** no themed card around it (Generate preview sits on white) */
  bare?: boolean;
  /** a code app threw at runtime */
  onAppError?: (error: string) => void;
  /** 필기 mode for code apps (the ink layer inside the page) */
  ink?: InkCmd;
};

const HAIR = C.rowLine;

/** Accent ring around whatever just changed. Overlay only, so layout never shifts. */
function Hl({ on, children, style, inset = 6, radius = 14, accent }: { on: boolean; children: ReactNode; style?: ViewStyle; inset?: number; radius?: number; accent: string }) {
  return (
    <View style={style}>
      {children}
      {on && <View pointerEvents="none" style={{ position: 'absolute', top: -inset, left: -inset, right: -inset, bottom: -inset, borderWidth: 2, borderColor: accent, borderRadius: radius }} />}
    </View>
  );
}

export function PageCanvas({ page, onChange, highlight = null, accent = C.accent, reveal, pending, scroll = true, bare, onAppError, ink }: Props) {
  const theme = THEMES[page.theme];
  const [w, setW] = useState(0);
  const narrow = w > 0 && w < 720;
  const today = new Date();
  const set = (patch: Partial<Page>) => onChange?.({ ...page, ...patch });
  const setMain = (main: Main) => set({ main });

  // 바이브 코딩 app: the AI-written code fills the card; it keeps its own data in main.state
  if (page.main.kind === 'app') {
    const app = page.main;
    if (isSheet(page.device)) {
      const more = app.more ?? [];
      return (
        <Hl on={highlight === 'main' || highlight === 'theme'} accent={accent} inset={4} radius={31} style={{ flex: 1 }}>
          <View style={{ flex: 1, minHeight: 360, borderRadius: 28, backgroundColor: bare ? C.fill : theme.card, overflow: 'hidden' }}>
            <SheetStack
              key={page.id}
              kind={page.device}
              html={app.html}
              states={[app.state, ...more]}
              onSave={onChange ? (i, state) => set({ main: i === 0 ? { ...app, state } : { ...app, more: more.map((m, j) => (j === i - 1 ? state : m)) } }) : undefined}
              onAdd={onChange && !bare ? () => set({ main: { ...app, more: [...more, {}] } }) : undefined}
              onRemove={onChange ? (i) => set({ main: { ...app, more: more.filter((_, j) => j !== i - 1) } }) : undefined}
              onError={onAppError}
              ink={ink}
            />
          </View>
        </Hl>
      );
    }
    return (
      <Hl on={highlight === 'main' || highlight === 'theme'} accent={accent} inset={4} radius={31} style={{ flex: 1 }}>
        <View style={{ flex: 1, minHeight: 480, borderRadius: 28, backgroundColor: bare ? C.white : theme.card, overflow: 'hidden' }}>
          <AppFrame key={page.id} html={app.html} state={app.state} onSave={onChange ? (state) => set({ main: { ...app, state } }) : undefined} onError={onAppError} ink={ink} />
        </View>
      </Hl>
    );
  }

  const body = (
    <View style={{ gap: 22 }}>
      {page.main.kind !== 'wrong' && page.main.kind !== 'timetable' && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 4 }}>
            <T s={13} c={C.sub}>
              today
            </T>
            <T w={600} s={28} ls={-0.03}>
              {shortEn(today)}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 40, alignItems: 'flex-end' }}>
            {page.main.kind === 'focus' && (
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <T s={13} c={C.sub}>
                  집중한 시간
                </T>
                <T w={300} s={32} ls={-0.03}>
                  {fmtMinutes(page.main.blocksDone * 25)}
                </T>
              </View>
            )}
            <TopWidget page={page} big={page.big} accent={accent} highlight={highlight === 'big'} onDate={onChange ? (date) => page.top?.kind === 'dday' && set({ top: { ...page.top, date } }) : undefined} />
          </View>
        </View>
      )}

      {!!page.reason && (
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.glass }}>
          <Star size={14} fill={accent} />
          <T s={13.5}>{page.reason}</T>
        </View>
      )}

      <View style={{ flexDirection: narrow ? 'column' : 'row', gap: 40 }}>
        <Hl on={highlight === 'dim' || highlight === 'main'} accent={accent} style={{ flex: narrow ? undefined : 1, minWidth: 0 }}>
          <MainBlock page={page} setMain={setMain} accent={accent} reveal={reveal} pending={pending} editable={!!onChange} />
          {page.memo !== null && (
            <Hl on={highlight === 'memo'} accent={accent} radius={12} style={{ marginTop: 24, gap: 8 }}>
              <T s={13} c={C.sub}>
                memo
              </T>
              <TextInput
                accessibilityLabel="메모"
                value={page.memo}
                editable={!!onChange}
                onChangeText={(memo) => set({ memo })}
                placeholder="여기에 적어요"
                placeholderTextColor={C.faint}
                multiline
                style={{ minHeight: 40, fontFamily: F[300], fontSize: 15, lineHeight: 24, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.fieldLine, paddingVertical: 8 }}
              />
            </Hl>
          )}
        </Hl>
        {page.side && (
          <Hl on={highlight === 'side'} accent={accent} style={{ width: narrow ? undefined : 270 }}>
            {page.side === 'timetable' ? <StudyLog /> : <WeekColumn page={page} />}
          </Hl>
        )}
      </View>
    </View>
  );

  if (bare) return <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>{body}</View>;

  return (
    <Hl on={highlight === 'theme'} accent={accent} inset={4} radius={31} style={{ flex: 1 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1, borderRadius: 28, backgroundColor: theme.card, overflow: 'hidden' }}>
        <Star size={120} fill={theme.star} style={{ position: 'absolute', right: -20, bottom: -24 }} />
        {scroll ? (
          <ScrollView contentContainerStyle={{ paddingVertical: 30, paddingHorizontal: 34 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={{ paddingVertical: 30, paddingHorizontal: 34 }}>{body}</View>
        )}
      </View>
    </Hl>
  );
}

const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

/* ───────── top-right widget ───────── */

function TopWidget({ page, big, accent, highlight, onDate }: { page: Page; big: boolean; accent: string; highlight: boolean; onDate?: (d: string) => void }) {
  const [dateOpen, setDateOpen] = useState(false);
  if (!page.top) return null;
  let label = page.top.label;
  let value: string;
  if (page.top.kind === 'dday') {
    value = dday(parseLooseDate(page.top.date));
  } else if (page.main.kind === 'habits') {
    const upto = weekdayIndex() + 1;
    const total = page.main.habits.length * upto;
    const done = page.main.habits.reduce((n, h) => n + h.week.slice(0, upto).filter(Boolean).length, 0);
    value = `${done}/${total}`;
  } else if (page.main.kind === 'log') {
    const filled = Object.values(page.main.values).some((v) => !!v);
    value = `${filled ? 1 : 0}일`;
    label = filled ? '연속 기록' : '오늘 아직';
  } else value = '';
  return (
    <Hl on={highlight} accent={accent} inset={4} style={{ alignItems: 'flex-end', gap: 2, paddingVertical: 6, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
        <T s={13} c={C.sub}>
          {label}
        </T>
      </View>
      <Btn disabled={!onDate || page.top.kind !== 'dday'} readOnly accessibilityLabel={`${label} ${value}${onDate ? ', 눌러서 날짜 바꾸기' : ''}`} onPress={() => setDateOpen((o) => !o)}>
        <T w={200} s={big ? 88 : 56} ls={-0.04} style={{ lineHeight: big ? 92 : 60 }}>
          {value}
        </T>
      </Btn>
      {dateOpen && page.top.kind === 'dday' && (
        <TextInput
          accessibilityLabel="날짜"
          autoFocus
          defaultValue={page.top.date}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          onSubmitEditing={(e) => {
            if (parseLooseDate(e.nativeEvent.text)) onDate?.(e.nativeEvent.text);
            setDateOpen(false);
          }}
          onBlur={() => setDateOpen(false)}
          style={{ width: 160, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, paddingHorizontal: 12, textAlign: 'right', fontFamily: F[400], fontSize: 15, color: C.ink }}
        />
      )}
    </Hl>
  );
}

/* ───────── main blocks ───────── */

function SectionHead({ left, right }: { left: string; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink }}>
      <T s={13} c={C.sub} accessibilityRole="header">
        {left}
      </T>
      {!!right && (
        <T s={13} c={C.sub}>
          {right}
        </T>
      )}
    </View>
  );
}

function TodoRow({ t, i, dim, onToggle, onText, right }: { t: Todo; i: number; dim: boolean; onToggle?: () => void; onText?: (text: string) => void; right?: ReactNode }) {
  const faded = t.done && dim;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 50, borderBottomWidth: 1, borderBottomColor: HAIR, opacity: faded ? 0.35 : 1 }}>
      <T s={12} c={C.sub} style={{ width: t.subject ? Math.max(30, t.subject.length * 12) : 14 }}>
        {t.subject ?? String(i + 1)}
      </T>
      {onText ? (
        <TextInput
          accessibilityLabel={`할 일 ${i + 1}`}
          value={t.text}
          onChangeText={onText}
          placeholder="할 일 적기"
          placeholderTextColor={C.faint}
          style={{ flex: 1, height: 44, fontFamily: F[400], fontSize: 15, color: t.done ? C.faint : C.ink, textDecorationLine: t.done ? 'line-through' : 'none' }}
        />
      ) : (
        <T s={15} c={t.done ? C.faint : C.ink} style={{ flex: 1, textDecorationLine: t.done ? 'line-through' : 'none' }}>
          {t.text}
        </T>
      )}
      {right}
      <Btn
        accessibilityRole="checkbox"
        accessibilityState={{ checked: t.done }}
        accessibilityLabel={t.text}
        disabled={!onToggle}
        onPress={onToggle}
        hitSlop={12}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 }} readOnly
      >
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: t.done ? C.ink : C.ring, backgroundColor: t.done ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {t.done && <Icon name="check" size={12} color={C.white} stroke={2.4} />}
        </View>
      </Btn>
    </View>
  );
}

function MainBlock({ page, setMain, accent, reveal, pending, editable }: { page: Page; setMain: (m: Main) => void; accent: string; reveal?: Set<string>; pending?: Set<string>; editable: boolean }) {
  const m = page.main;
  const toggleTodo = (todos: Todo[], id: string) => todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));

  if (m.kind === 'today3' || m.kind === 'portion' || m.kind === 'review' || m.kind === 'roles' || m.kind === 'milestones') {
    const done = m.todos.filter((t) => t.done).length;
    const head =
      m.kind === 'today3'
        ? { left: `오늘 꼭 할 ${m.todos.length}개`, right: `${done} / ${m.todos.length}` }
        : m.kind === 'portion'
          ? { left: '오늘 분량', right: `남은 ${m.daysLeft}일` }
          : m.kind === 'roles'
            ? { left: '누가 뭘 하나요', right: `${done} / ${m.todos.length}` }
            : m.kind === 'milestones'
              ? { left: `${m.goal}까지 중간 마감`, right: `${done} / ${m.todos.length}` }
              : { left: '오늘 공부한 것', right: '복습  1일  3일  7일' };
    return (
      <View>
        <SectionHead {...head} />
        {m.todos.map((t, i) => (
          <TodoRow
            key={t.id}
            t={t}
            i={i}
            dim={page.dimDone}
            onToggle={editable ? () => setMain({ ...m, todos: toggleTodo(m.todos, t.id) } as Main) : undefined}
            onText={editable ? (text) => setMain({ ...m, todos: m.todos.map((x) => (x.id === t.id ? { ...x, text } : x)) } as Main) : undefined}
            right={
              m.kind === 'review' ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 3, 7].map((d, k) => {
                    const on = !!t.reviews?.[k];
                    return (
                      <Btn
                        key={d}
                        disabled={!editable}
                        accessibilityLabel={`${t.text} ${d}일 복습`}
                        accessibilityState={{ checked: on }}
                        onPress={() =>
                          setMain({
                            ...m,
                            todos: m.todos.map((x) => (x.id === t.id ? { ...x, reviews: [0, 1, 2].map((j) => (j === k ? !on : !!x.reviews?.[j])) } : x)),
                          })
                        }
                        style={{ height: 30, minWidth: 40, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }} readOnly
                      >
                        <T s={12} c={on ? C.white : C.sub}>
                          {addDays(new Date(), d).getMonth() + 1}.{addDays(new Date(), d).getDate()}
                        </T>
                      </Btn>
                    );
                  })}
                </View>
              ) : m.kind === 'milestones' && t.due ? (
                <T s={13} c={t.due <= addDays(new Date(), 0).getTime() && !t.done ? C.ink : C.sub} w={t.due <= addDays(new Date(), 0).getTime() && !t.done ? 600 : 400}>
                  {t.due <= addDays(new Date(), 0).getTime() ? '오늘까지' : shortEn(new Date(t.due))}
                </T>
              ) : m.kind === 'portion' ? (
                <T s={12} c={C.sub}>
                  오늘 몫
                </T>
              ) : undefined
            }
          />
        ))}
        {editable && (
          <Btn onPress={() => setMain({ ...m, todos: [...m.todos, { id: uid('t'), text: '', done: false, reviews: m.kind === 'review' ? [false, false, false] : undefined }] } as Main)} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="plus" size={16} color={C.sub} />
            <T s={14} c={C.sub}>
              할 일 추가
            </T>
          </Btn>
        )}
        <T s={13} c={C.sub} style={{ paddingTop: 12 }}>
          {m.kind === 'today3'
            ? m.laterCount > 0
              ? `나머지 ${m.laterCount}개는 내일로 미뤄 뒀어요`
              : '오늘 할 일은 이게 전부예요'
            : m.kind === 'portion'
              ? `남은 ${m.daysLeft}일로 나눈 오늘 몫이에요`
              : m.kind === 'roles'
                ? '팀원을 초대하면 각자 맡은 일을 체크할 수 있어요'
                : m.kind === 'milestones'
                  ? '중간 마감을 지키면 마지막 날이 편해져요'
                  : '날짜를 누르면 그날 복습한 걸로 남아요'}
        </T>
      </View>
    );
  }

  if (m.kind === 'focus') return <FocusBlock m={m} page={page} setMain={setMain} accent={accent} editable={editable} toggleTodo={toggleTodo} />;
  if (m.kind === 'log') return <LogBlock m={m} setMain={setMain} accent={accent} editable={editable} />;
  if (m.kind === 'habits') return <HabitBlock m={m} setMain={setMain} editable={editable} />;
  if (m.kind === 'wrong') return <WrongBlock m={m} setMain={setMain} accent={accent} editable={editable} reveal={reveal} pending={pending} />;
  return <TimetableBlock />;
}

/* focus: 25분 블록 + 타이머 */
function FocusBlock({ m, page, setMain, accent, editable, toggleTodo }: { m: Extract<Main, { kind: 'focus' }>; page: Page; setMain: (m: Main) => void; accent: string; editable: boolean; toggleTodo: (t: Todo[], id: string) => Todo[] }) {
  const LEN = 25 * 60;
  const [left, setLeft] = useState(LEN);
  const [running, setRunning] = useState(false);
  const mRef = useRef(m);
  useEffect(() => {
    mRef.current = m;
  }, [m]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        setRunning(false);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setMain({ ...mRef.current, blocksDone: mRef.current.blocksDone + 1 });
        return LEN;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, setMain, LEN]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, padding: 18, borderRadius: 18, backgroundColor: C.glass }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T s={13} c={C.sub}>
            25분 집중 블록
          </T>
          <T w={200} s={52} ls={-0.04} style={{ lineHeight: 58, fontVariant: ['tabular-nums'] }} accessibilityLabel={`남은 시간 ${mm}분 ${ss}초`}>
            {mm}:{ss}
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`오늘 ${m.blocksDone}블록`}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: i < m.blocksDone ? accent : 'rgba(29, 29, 31, 0.1)' }} />
            ))}
          </View>
        </View>
        <IconButton name="reset" label="처음부터" onPress={() => { setRunning(false); setLeft(LEN); }} bg={C.white} />
        <IconButton name={running ? 'pause' : 'play'} label={running ? '잠깐 멈추기' : '집중 시작'} onPress={() => editable && setRunning((r) => !r)} bg={C.ink} color={C.white} size={56} iconSize={22} />
      </View>
      <View>
        <SectionHead left="블록마다 하나씩" right={`${m.todos.filter((t) => t.done).length} / ${m.todos.length}`} />
        {m.todos.map((t, i) => (
          <TodoRow key={t.id} t={t} i={i} dim={page.dimDone} onToggle={editable ? () => setMain({ ...m, todos: toggleTodo(m.todos, t.id) }) : undefined} />
        ))}
      </View>
    </View>
  );
}

/* log: 하루 한 장 */
const MOOD_DOTS = ['#C7DBF2', C.doneSoft, '#EFE7B4', '#F3D3B5', '#EBC6E2'];
const WEATHER = ['맑음', '흐림', '비', '눈'];
const ONE_LINERS = ['평범했어', '뿌듯해', '피곤해', '즐거웠어'];

function LogBlock({ m, setMain, accent, editable }: { m: Extract<Main, { kind: 'log' }>; setMain: (m: Main) => void; accent: string; editable: boolean }) {
  const setVal = (f: LogField, v: string) => setMain({ ...m, values: { ...m.values, [f]: m.values[f] === v ? '' : v } });
  const setText = (f: LogField, v: string) => setMain({ ...m, values: { ...m.values, [f]: v } });
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setText('사진 한 장', r.assets[0].uri);
  };
  const input = (f: LogField, ph: string) => (
    <TextInput
      accessibilityLabel={f}
      editable={editable}
      value={m.values[f] ?? ''}
      onChangeText={(v) => setText(f, v)}
      placeholder={ph}
      placeholderTextColor={C.faint}
      style={{ height: 44, fontFamily: F[300], fontSize: 15, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.fieldLine }}
    />
  );
  const chips = (f: LogField, opts: string[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {opts.map((o) => (
        <Chip key={o} label={o} on={m.values[f] === o} onPress={() => editable && setVal(f, o)} h={40} s={14} accent={accent} />
      ))}
    </View>
  );

  return (
    <View style={{ gap: 22 }}>
      <SectionHead left="하루 한 장" right={`${m.fields.filter((f) => m.values[f]).length} / ${m.fields.length}`} />
      {m.prompt && (
        <View style={{ gap: 8 }}>
          <T s={13} c={C.sub}>
            오늘의 질문
          </T>
          <T w={500} s={18}>
            {m.prompt}
          </T>
          <TextInput
            accessibilityLabel="오늘의 질문 답"
            editable={editable}
            value={m.values['한 줄 일기'] ?? ''}
            onChangeText={(v) => setText('한 줄 일기', v)}
            placeholder="한 줄이면 충분해요"
            placeholderTextColor={C.faint}
            style={{ height: 44, fontFamily: F[300], fontSize: 15, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.fieldLine }}
          />
        </View>
      )}
      {m.fields.map((f) => (
        <View key={f} style={{ gap: 10 }}>
          <T s={13} c={C.sub}>
            {f}
          </T>
          {f === '오늘 기분' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {MOOD_DOTS.map((c, i) => {
                const on = m.values[f] === String(i + 1);
                return (
                  <Btn key={c} accessibilityLabel={`기분 ${i + 1}점`} accessibilityState={{ selected: on }} disabled={!editable} onPress={() => setVal(f, String(i + 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} readOnly>
                    <View style={{ width: on ? 34 : 26, height: on ? 34 : 26, borderRadius: 17, backgroundColor: c, borderWidth: on ? 2 : 0, borderColor: C.ink }} />
                  </Btn>
                );
              })}
            </View>
          )}
          {f === '날씨' && chips(f, WEATHER)}
          {f === '한 줄 일기' && (m.prompt ? <T s={13} c={C.faint}>위 질문에 답하면 여기에 남아요</T> : m.oneTap ? chips(f, ONE_LINERS) : input(f, '오늘을 한 줄로'))}
          {f === '읽은 책' && input(f, '책 제목, 몇 쪽까지')}
          {f === '감사한 일' && (m.oneTap ? chips(f, ['밥이 맛있었어', '친구가 도와줬어', '푹 잤어']) : input(f, '작은 것도 좋아요'))}
          {f === '사진 한 장' && (
            <Btn accessibilityLabel="사진 한 장 고르기" disabled={!editable} onPress={pick} style={{ width: 200, height: 140, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.dot, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} readOnly>
              {m.values[f] ? <Image source={{ uri: m.values[f] }} style={{ width: '100%', height: '100%' }} /> : <Icon name="camera" size={26} color={C.muted} stroke={1.4} />}
            </Btn>
          )}
        </View>
      ))}
      <RemindRow on={m.remind} editable={editable} onToggle={() => setMain({ ...m, remind: !m.remind })} />
    </View>
  );
}

function RemindRow({ on, editable, onToggle }: { on: boolean; editable: boolean; onToggle: () => void }) {
  return (
    <Btn accessibilityRole="switch" accessibilityState={{ checked: on }} disabled={!editable} onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }} readOnly>
      <Icon name="bell" size={18} color={on ? C.ink : C.muted} />
      <T s={14} c={on ? C.ink : C.muted} style={{ flex: 1 }}>
        {on ? '매일 밤 9시에 알려 드려요' : '밤 9시 알림 꺼짐'}
      </T>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? C.ink : C.track, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.white }} />
      </View>
    </Btn>
  );
}

/* habits: 체크표 */
function HabitBlock({ m, setMain, editable }: { m: Extract<Main, { kind: 'habits' }>; setMain: (m: Main) => void; editable: boolean }) {
  const todayIdx = weekdayIndex();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink }}>
        <T s={13} c={C.sub} style={{ flex: 1 }}>
          이번 주
        </T>
        {WEEK_KO.map((d, i) => (
          <T key={d} s={12} c={i === todayIdx ? C.ink : C.sub} w={i === todayIdx ? 600 : 400} center style={{ width: 40 }}>
            {d}
          </T>
        ))}
      </View>
      {m.habits.map((h) => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: 1, borderBottomColor: HAIR }}>
          {editable ? (
            <TextInput
              accessibilityLabel="습관 이름"
              value={h.name}
              placeholder="습관 이름"
              placeholderTextColor={C.faint}
              onChangeText={(name) => setMain({ ...m, habits: m.habits.map((x) => (x.id === h.id ? { ...x, name } : x)) })}
              style={{ flex: 1, height: 44, fontFamily: F[400], fontSize: 15, color: C.ink }}
            />
          ) : (
            <T s={15} style={{ flex: 1 }}>
              {h.name}
            </T>
          )}
          {h.week.map((on, i) => {
            const future = i > todayIdx;
            return (
              <Btn
                key={i}
                accessibilityRole="checkbox"
                accessibilityLabel={`${h.name} ${WEEK_KO[i]}요일`}
                accessibilityState={{ checked: on, disabled: future }}
                disabled={!editable || future}
                onPress={() => setMain({ ...m, habits: m.habits.map((x) => (x.id === h.id ? { ...x, week: x.week.map((v, j) => (j === i ? !v : v)) } : x)) })}
                style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }} readOnly
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? C.done : future ? 'rgba(29, 29, 31, 0.04)' : C.rowLine, borderWidth: i === todayIdx && !on ? 1.5 : 0, borderColor: C.ink }} />
              </Btn>
            );
          })}
        </View>
      ))}
      {editable && (
        <Btn onPress={() => setMain({ ...m, habits: [...m.habits, { id: uid('h'), name: '', week: Array(7).fill(false) }] })} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="plus" size={16} color={C.sub} />
          <T s={14} c={C.sub}>
            습관 추가
          </T>
        </Btn>
      )}
      <View style={{ marginTop: 12 }}>
        <RemindRow on={m.remind} editable={editable} onToggle={() => setMain({ ...m, remind: !m.remind })} />
      </View>
    </View>
  );
}

/* wrong note: 오답노트 (Generate 화면 미리보기와 같은 블록) */
function WrongBlock({ m, setMain, accent, editable, reveal, pending }: { m: Extract<Main, { kind: 'wrong' }>; setMain: (m: Main) => void; accent: string; editable: boolean; reveal?: Set<string>; pending?: Set<string> }) {
  const show = (k: string) => !reveal || reveal.has(k);
  const faint = (k: string) => !!pending?.has(k);
  const reviewDate = addDays(new Date(), m.reviewInDays);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setMain({ ...m, photo: r.assets[0].uri });
  };
  const notes = [...m.notes, ''];
  const statKeys = m.units ?? m.reasons.slice(0, 3);
  const statVal = (k: string) => m.entries.filter((e) => (m.units ? e.unit === k : e.reason === k)).length;
  const today0 = addDays(new Date(), 0).getTime();
  const canSave = editable && !reveal && (!!m.photo || !!m.reason || m.notes.some(Boolean));
  const saveEntry = () =>
    setMain({
      ...m,
      entries: [...m.entries, { id: uid('e'), reason: m.reason, unit: m.unit, reviewAt: addDays(new Date(), m.reviewInDays).getTime() }],
      photo: null,
      reason: null,
      notes: [],
      retryCount: m.retryCount === null ? null : 0,
    });

  return (
    <View style={{ gap: 32 }}>
      {show('units') && m.units && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', opacity: faint('units') ? 0.45 : 1 }}>
          {m.units.map((u) => (
            <Chip key={u} label={u} on={m.unit === u} onPress={() => editable && setMain({ ...m, unit: u })} h={40} s={14} accent={accent} />
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 40, flexWrap: 'wrap' }}>
        {show('photo') && (
          <Btn
            accessibilityLabel="문제 사진 붙이기"
            disabled={!editable}
            onPress={pick}
            style={{ width: 300, height: 220, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.dot, alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', opacity: faint('photo') ? 0.45 : 1 }}
          >
            {m.photo ? (
              <Image source={{ uri: m.photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <>
                <Icon name="camera" size={28} color={C.muted} stroke={1.4} />
                <T s={14} c={C.muted}>
                  문제 사진 붙이기
                </T>
              </>
            )}
          </Btn>
        )}
        <View style={{ flex: 1, minWidth: 260, gap: 28 }}>
          {show('reason') && (
            <View style={{ gap: 12, opacity: faint('reason') ? 0.45 : 1 }}>
              <T s={13} c={C.muted}>
                틀린 이유
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {m.reasons.map((r) => (
                  <Chip key={r} label={r} on={m.reason === r} onPress={() => editable && setMain({ ...m, reason: m.reason === r ? null : r })} h={38} s={14} accent={accent} />
                ))}
              </View>
            </View>
          )}
          {show('review') && (
            <View style={{ gap: 12, opacity: faint('review') ? 0.45 : 1 }}>
              <T s={13} c={C.muted}>
                다시 풀기
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <T w={300} s={28} ls={-0.03}>
                  {shortEn(reviewDate)}
                </T>
                <T s={13} c={C.muted}>
                  {m.reviewInDays}일 뒤 알림
                </T>
              </View>
            </View>
          )}
          {show('retry') && m.retryCount !== null && (
            <View style={{ gap: 12, opacity: faint('retry') ? 0.45 : 1 }}>
              <T s={13} c={C.muted}>
                다시 푼 횟수
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <T w={300} s={28}>
                  {m.retryCount}회
                </T>
                <IconButton name="plus" label="다시 푼 횟수 더하기" onPress={() => editable && setMain({ ...m, retryCount: (m.retryCount ?? 0) + 1 })} bg={C.white} iconSize={18} />
              </View>
            </View>
          )}
        </View>
      </View>

      {show('notes') && (
        <View style={{ gap: 10, opacity: faint('notes') ? 0.45 : 1 }}>
          <View style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink }}>
            <T s={13} c={C.muted}>
              풀이 · 메모
            </T>
          </View>
          {notes.map((n, i) => (
            <TextInput
              key={i}
              accessibilityLabel={`풀이 메모 ${i + 1}`}
              editable={editable}
              value={n}
              placeholder={i === notes.length - 1 ? '한 줄 더' : undefined}
              placeholderTextColor={C.dot}
              onChangeText={(v) => {
                const next = [...m.notes];
                if (i === m.notes.length) next.push(v);
                else next[i] = v;
                setMain({ ...m, notes: next.filter((x, j) => x || j < next.length - 1) });
              }}
              style={{ height: 44, borderBottomWidth: 1, borderBottomColor: C.hair, fontFamily: F[300], fontSize: 15, color: C.ink }}
            />
          ))}
        </View>
      )}

      {editable && !reveal && (
        <View style={{ gap: 14 }}>
          <Btn
            disabled={!canSave}
            onPress={saveEntry}
            accessibilityHint={`${m.reviewInDays}일 뒤 다시 풀 문제로 모아 둬요`}
            style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center' }}
          >
            <T s={14.5} c={C.white}>
              이 문제 모아 두기
            </T>
          </Btn>
          {m.entries.length > 0 && (
            <View>
              <View style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink, flexDirection: 'row', justifyContent: 'space-between' }}>
                <T s={13} c={C.muted}>
                  모아 둔 문제 {m.entries.length}개
                </T>
                <T s={13} c={C.muted}>
                  오늘 {m.entries.filter((e) => e.reviewAt <= today0).length}개
                </T>
              </View>
              {[...m.entries]
                .sort((a, b) => a.reviewAt - b.reviewAt)
                .map((e, i) => {
                  const due = e.reviewAt <= today0;
                  return (
                    <View key={e.id} style={{ height: 50, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: HAIR }}>
                      <T s={12} c={C.sub} style={{ width: 24 }}>
                        {i + 1}
                      </T>
                      <T s={15} style={{ flex: 1 }}>
                        {[e.unit, e.reason].filter(Boolean).join(', ') || '이유 안 고름'}
                      </T>
                      <T s={13} c={due ? C.ink : C.muted} w={due ? 600 : 400}>
                        {due ? '오늘 다시 풀기' : shortEn(new Date(e.reviewAt))}
                      </T>
                      <Btn onPress={() => setMain({ ...m, entries: m.entries.filter((x) => x.id !== e.id) })} accessibilityLabel={`${i + 1}번 다 풀었어요`} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.glass, justifyContent: 'center' }}>
                        <T s={12.5}>다 풀었어요</T>
                      </Btn>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      )}

      {show('stats') && m.stats && (
        <View style={{ gap: 12 }}>
          <T s={13} c={faint('stats') ? C.faint : C.muted}>
            {m.units ? '단원별 통계' : '틀린 이유별 통계'}
          </T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {statKeys.slice(0, 3).map((k) => (
              <View key={k} style={{ flex: 1, height: 56, borderRadius: 12, backgroundColor: C.fill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {!faint('stats') && (
                  <>
                    <T s={13} c={C.sub}>
                      {k}
                    </T>
                    <T w={500} s={17}>
                      {statVal(k)}
                    </T>
                  </>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/* timetable page */
function TimetableBlock() {
  const now = new Date();
  const todayIdx = weekdayIndex(now);
  const next = nextClass(now);
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 4 }}>
        <T s={13} c={C.sub}>
          다음 수업
        </T>
        <T w={600} s={28} ls={-0.03}>
          {next ? next.subject : '오늘 수업 끝'}
        </T>
        {next && (
          <T s={14} c={C.sub}>
            {next.period} {next.time}
          </T>
        )}
      </View>
      <View>
        <View style={{ flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.ink }}>
          <View style={{ width: 70 }} />
          {TIMETABLE_DAYS.map((d, i) => (
            <T key={d} s={13} c={i === todayIdx ? C.ink : C.sub} w={i === todayIdx ? 600 : 400} center style={{ flex: 1 }}>
              {d}
            </T>
          ))}
        </View>
        {TIMETABLE_PERIODS.map((p, r) => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46, borderBottomWidth: 1, borderBottomColor: HAIR }}>
            <View style={{ width: 70 }}>
              <T s={12} c={C.sub}>
                {p.label}
              </T>
              <T s={11} c={C.faint}>
                {p.time}
              </T>
            </View>
            {TIMETABLE_DAYS.map((d, i) => {
              const isNext = next && i === todayIdx && next.row === r;
              return (
                <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: isNext ? C.ink : i === todayIdx ? C.glass : 'transparent' }}>
                    <T s={14} c={isNext ? C.white : C.ink}>
                      {p.subjects[i]}
                    </T>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────── side columns ───────── */

const PAT = (() => {
  const { E, P, M, B, Y } = TIMETABLE;
  return [
    [P, P, P, P, P, P],
    [P, P, P, E, E, E],
    [E, M, M, M, M, M],
    [M, M, E, E, E, E],
    [E, E, E, E, E, E],
    [Y, Y, Y, Y, Y, E],
    [E, E, E, E, E, E],
    [B, B, B, B, E, E],
    [E, E, E, E, E, E],
    [P, P, P, E, E, E],
  ];
})();
const HOURS = ['7', '8', '9', '10', '18', '19', '20', '21', '22', '23'];

/** "time table" — 10-minute study blocks per hour, as in the design */
function StudyLog() {
  return (
    <View>
      <SectionHead left="time table" />
      <View style={{ gap: 3, paddingTop: 12 }} accessibilityLabel="오늘 공부한 시간표">
        {HOURS.map((h, i) => (
          <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T s={11} c={C.sub} style={{ width: 18, textAlign: 'right' }}>
              {h}
            </T>
            <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
              {PAT[i].map((c, j) => (
                <View key={j} style={{ flex: 1, height: 26, borderRadius: 3, backgroundColor: c }} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekColumn({ page }: { page: Page }) {
  const todayIdx = weekdayIndex();
  const m = page.main;
  const doneOn = (i: number) => {
    if (m.kind === 'habits') return m.habits.length > 0 && m.habits.every((h) => h.week[i]);
    if (m.kind === 'log') return i === todayIdx && Object.values(m.values).some(Boolean);
    return false;
  };
  return (
    <View>
      <SectionHead left="this week" />
      <View style={{ gap: 6, paddingTop: 12 }}>
        {WEEK_KO.map((d, i) => (
          <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 34 }}>
            <T s={13} c={i === todayIdx ? C.ink : C.sub} w={i === todayIdx ? 600 : 400} style={{ width: 18 }}>
              {d}
            </T>
            <View style={{ flex: 1, height: 22, borderRadius: 6, backgroundColor: doneOn(i) ? C.doneSoft : i > todayIdx ? 'rgba(29, 29, 31, 0.03)' : 'rgba(29, 29, 31, 0.06)' }} />
          </View>
        ))}
      </View>
    </View>
  );
}
