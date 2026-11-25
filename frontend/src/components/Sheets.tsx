import { ReactNode, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, Share, View } from 'react-native';
import { confirmAction, notice } from '@/lib/confirm';
import { Person } from '@/lib/page';
import { C } from '@/theme';
import Svg, { Path } from 'react-native-svg';
import { Face } from './Faces';
import { Btn, Icon, IconButton, Star, T, Wordmark } from './ui';

const ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'] as const;

/** Centered card over a dim scrim (iPad form-sheet feel). */
function Sheet({ visible, onDismiss, width, label, children }: { visible: boolean; onDismiss?: () => void; width: number; label: string; children: ReactNode }) {
  const y = useState(() => new Animated.Value(24))[0];
  useEffect(() => {
    if (visible) {
      y.setValue(24);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
    }
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={[...ORIENTATIONS]} onRequestClose={onDismiss} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable accessibilityLabel="닫기" onPress={onDismiss} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim }} />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={{
            width,
            maxWidth: '92%',
            backgroundColor: C.white,
            borderRadius: 28,
            overflow: 'hidden',
            transform: [{ translateY: y }],
            shadowColor: C.ink,
            shadowOpacity: 0.18,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 24 },
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Brand marks for the sign-in buttons (Apple logo, Kakao speech bubble). */
function BrandIcon({ brand }: { brand: 'apple' | 'kakao' }) {
  return (
    // decorative (the button says the brand): hidden from screen readers on the View, since <Svg>
    // passes props straight to the DOM on web
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {brand === 'apple' ? (
        <Path fill="#FFFFFF" d="M16.37 1.43c0 1.14-.49 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8C4.97 18.38 3.93 15.57 3.93 12.92c0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45z" />
      ) : (
        <Path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.6 6.72l-.94 3.44c-.08.3.26.54.52.37l4.12-2.73c.56.07 1.13.11 1.7.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
      )}
    </Svg>
    </View>
  );
}

const showTerms = (title: string) => notice(title, `[${title} 본문]`);

/* ───────── 07 · 로그인 모달 ───────── */

export function LoginSheet({ visible, onDismiss, onLogin }: { visible: boolean; onDismiss: () => void; onLogin: (p: 'apple' | 'kakao') => void }) {
  return (
    <Sheet visible={visible} onDismiss={onDismiss} width={460} label="로그인">
      <View style={{ paddingTop: 44, paddingHorizontal: 40, paddingBottom: 32, gap: 32 }}>
        <View style={{ gap: 12, alignItems: 'center' }}>
          <T w={600} s={26} lh={1.4} ls={-0.03} center accessibilityRole="header">
            이 페이지를 저장해 둘게요
          </T>
          <T w={300} s={15} lh={1.6} c={C.sub} center>
            로그인하면 방금 만든 페이지가 그대로 남아요.
          </T>
        </View>
        <View style={{ gap: 10 }}>
          <Btn onPress={() => onLogin('apple')} style={{ height: 54, borderRadius: 14, backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <BrandIcon brand="apple" />
            <T w={500} s={16} c={C.white}>
              Apple로 계속하기
            </T>
          </Btn>
          <Btn onPress={() => onLogin('kakao')} style={{ height: 54, borderRadius: 14, backgroundColor: C.kakao, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <BrandIcon brand="kakao" />
            <T w={500} s={16} c="#191919">
              카카오로 계속하기
            </T>
          </Btn>
        </View>
        <T w={300} s={12} c={C.muted} center>
          계속하면{' '}
          <T w={300} s={12} c={C.ink} style={{ textDecorationLine: 'underline' }} onPress={() => showTerms('이용약관')} accessibilityRole="link">
            이용약관
          </T>
          과{' '}
          <T w={300} s={12} c={C.ink} style={{ textDecorationLine: 'underline' }} onPress={() => showTerms('개인정보 처리방침')} accessibilityRole="link">
            개인정보 처리방침
          </T>
          에 동의하게 돼요.
        </T>
      </View>
    </Sheet>
  );
}

/* ───────── 08 · 구독 모달 (seyo plus) ───────── */

/**
 * Prices (2026-11): below Notion Plus (~$10/mo) and around Goodnotes Pro (₩50,500/yr) per year,
 * at the ₩4,900 student price point. AI cost per make/change ≈ ₩15–25 (gpt-5.4-mini), so the
 * 300/month fair-use cap (PLUS_AI_EDITS_PER_MONTH) keeps a heavy month near the net price.
 */
const PLANS = [
  { id: 'year', name: '1년', sub: '월 3,250원꼴 · 34% 아껴요', price: '₩39,000 / 년' },
  { id: 'month', name: '1개월', sub: '매달 결제', price: '₩4,900 / 월' },
] as const;

const PERKS = ['페이지를 개수 제한 없이 만들기', '말로 만들고 고치기 월 30회 → 300회', '위젯, 모든 분위기 테마'];

export function PaywallSheet({ visible, onClose, onSubscribe, accent = C.accent }: { visible: boolean; onClose: () => void; onSubscribe: (plan: 'year' | 'month') => void; accent?: string }) {
  const [plan, setPlan] = useState<'year' | 'month'>('year');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const close = () => {
    setRestoreMsg(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onDismiss={close} width={480} label="seyo plus">
      <Star size={200} fill={C.pinkSoft} style={{ position: 'absolute', right: -50, top: -60 }} />
      <View style={{ position: 'absolute', top: 18, right: 18, zIndex: 2 }}>
        <IconButton name="close" label="닫기" onPress={close} bg={C.fill} iconSize={14} />
      </View>
      <View style={{ paddingTop: 40, paddingHorizontal: 40, paddingBottom: 26, gap: 26 }}>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Wordmark height={18} />
            <T w={500} s={18} ls={-0.02}>
              plus
            </T>
          </View>
          <T w={600} s={28} lh={1.35} ls={-0.03} center accessibilityRole="header">
            {'말하는 대로,\n끝없이 바꿔요'}
          </T>
        </View>
        <View style={{ gap: 12, paddingHorizontal: 8 }}>
          {PERKS.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="check" size={18} color={accent} stroke={2.4} />
              <T s={15}>{p}</T>
            </View>
          ))}
        </View>
        <View style={{ gap: 10 }} accessibilityRole="radiogroup">
          {PLANS.map((pl) => {
            const on = plan === pl.id;
            return (
              <Btn
                key={pl.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setPlan(pl.id)}
                style={{ height: 66, paddingHorizontal: 20, borderRadius: 18, borderWidth: on ? 1.5 : 1, borderColor: on ? accent : C.line, backgroundColor: on ? C.accentSoft : C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ gap: 2 }}>
                  <T w={600} s={16}>
                    {pl.name}
                  </T>
                  <T s={13} c={C.muted}>
                    {pl.sub}
                  </T>
                </View>
                <T w={500} s={15}>
                  {pl.price}
                </T>
              </Btn>
            );
          })}
        </View>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Btn onPress={() => onSubscribe(plan)} style={{ alignSelf: 'stretch', height: 54, borderRadius: 27, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            <T w={500} s={16} c={C.white}>
              구독 시작하기
            </T>
          </Btn>
          <Btn onPress={close} style={{ padding: 10 }}>
            <T s={14} c={C.sub}>
              무료로 계속하기
            </T>
          </Btn>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
          <T s={12} c={C.muted} accessibilityRole="link" onPress={() => setRestoreMsg('복원할 구매 내역이 없어요')}>
            구매 복원
          </T>
          <T s={12} c={C.muted} accessibilityRole="link" onPress={() => showTerms('이용약관')}>
            이용약관
          </T>
          <T s={12} c={C.muted}>
            {restoreMsg ?? '언제든 해지할 수 있어요'}
          </T>
        </View>
      </View>
    </Sheet>
  );
}

/* ───────── 09 · 함께 쓰기 (초대) ───────── */

export function ShareSheet({
  visible,
  onClose,
  me,
  members,
  inviteUrl,
  onKick,
  onResetLink,
}: {
  visible: boolean;
  onClose: () => void;
  me: Person;
  members: Person[];
  inviteUrl: string;
  onKick: (id: string) => void;
  onResetLink: () => void;
}) {
  const [reset, setReset] = useState(false);
  const close = () => {
    setReset(false);
    onClose();
  };

  const send = () => Share.share({ message: `seyo에서 같이 써요\n${inviteUrl}`, url: inviteUrl }).catch(() => {});

  return (
    <Sheet visible={visible} onDismiss={close} width={460} label="함께 쓰는 사람">
      <View style={{ paddingTop: 28, paddingHorizontal: 28, paddingBottom: 22, gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <T w={600} s={22} ls={-0.02} accessibilityRole="header">
              함께 쓰기
            </T>
            <T w={300} s={14} lh={1.55} c={C.sub}>
              링크를 받은 친구도 이 페이지를 같이 쓸 수 있어요. 페이지 모양을 바꾸는 건 나만 할 수 있어요.
            </T>
          </View>
          <IconButton name="close" label="닫기" onPress={close} bg={C.fill} iconSize={14} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn onPress={send} style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="share" size={18} color={C.white} stroke={1.8} />
            <T w={500} s={15} c={C.white}>
              초대 링크 보내기
            </T>
          </Btn>
        </View>

        <View>
          <T s={13} c={C.muted} style={{ paddingBottom: 8 }}>
            함께 쓰는 사람 {members.length + 1}명
          </T>
          <PersonRow p={me} label={`${me.name}`} right={<T s={13} c={C.muted}>방장</T>} />
          {members.map((m) => (
            <PersonRow
              key={m.id}
              p={m}
              label={m.name}
              right={
                <Btn onPress={() => confirmAction(`${m.name}님을 내보낼까요?`, '지금 링크로는 다시 들어올 수 있어요. 막으려면 링크를 새로 만들어 주세요.', '내보내기', () => onKick(m.id))} accessibilityLabel={`${m.name} 내보내기`} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.fill, justifyContent: 'center' }}>
                  <T s={13} c={C.ink2}>
                    내보내기
                  </T>
                </Btn>
              }
            />
          ))}
        </View>

        <Btn
          onPress={() => {
            onResetLink();
            setReset(true);
                  }}
          style={{ alignSelf: 'center', padding: 10 }}
        >
          <T s={13} c={C.muted} center>
            {reset ? '새 링크를 만들었어요. 이전 링크로는 못 들어와요' : '링크 새로 만들기'}
          </T>
        </Btn>
      </View>
    </Sheet>
  );
}

function PersonRow({ p, label, right }: { p: Person; label: string; right: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, borderTopWidth: 1, borderTopColor: C.hair }}>
      <Face p={p} size={34} ring="transparent" />
      <T s={15} style={{ flex: 1 }}>
        {label}
      </T>
      {right}
    </View>
  );
}

/* ───────── account menu (avatar on Home) ───────── */

export function AccountSheet({ visible, onClose, plus, onPlus, onLogout }: { visible: boolean; onClose: () => void; plus: boolean; onPlus: () => void; onLogout: () => void }) {
  return (
    <Sheet visible={visible} onDismiss={onClose} width={380} label="내 계정">
      <View style={{ padding: 28, gap: 8 }}>
        <T w={600} s={20} style={{ marginBottom: 8 }}>
          내 계정
        </T>
        <T s={14} c={C.muted} style={{ marginBottom: 12 }}>
          {plus ? 'seyo plus 이용 중' : '무료로 쓰는 중'}
        </T>
        {!plus && (
          <Btn onPress={onPlus} style={{ height: 52, borderRadius: 16, backgroundColor: C.fill, paddingHorizontal: 18, justifyContent: 'center' }}>
            <T s={15}>seyo plus 알아보기</T>
          </Btn>
        )}
        <Btn onPress={() => confirmAction('로그아웃할까요?', '이 기기에 있는 페이지는 지워져요.', '로그아웃', onLogout)} style={{ height: 52, borderRadius: 16, backgroundColor: C.fill, paddingHorizontal: 18, justifyContent: 'center' }}>
          <T s={15}>로그아웃</T>
        </Btn>
      </View>
    </Sheet>
  );
}
