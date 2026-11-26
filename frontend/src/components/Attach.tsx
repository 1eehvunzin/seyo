import { useRef, useState } from "react";
import { Image, Modal, Pressable, View, ViewInstance } from "react-native";
import { References } from "@/lib/attach";
import { C } from "@/theme";
import { Btn, Icon, IconButton, T, useLayout } from "./ui";

/**
 * Photos attached to the next request, shown above the input. Tap × to drop one.
 * Each wears a small "참고" tag (they're a design reference unless the words say otherwise);
 * the longer explanation lives in the input's placeholder (see refPlaceholder).
 */
export function AttachTray({
  photos,
  onRemove,
}: {
  photos: string[];
  onRemove: (i: number) => void;
}) {
  if (!photos.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {photos.map((p, i) => (
          <View key={i} style={{ width: 56, height: 56 }}>
            <Image
              source={{ uri: p }}
              accessibilityLabel={`첨부한 사진 ${i + 1}, 디자인 참고용`}
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: C.fill,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 4,
                bottom: 4,
                height: 18,
                paddingHorizontal: 6,
                borderRadius: 9,
                backgroundColor: "rgba(255,255,255,0.92)",
                justifyContent: "center",
              }}
            >
              <T s={10.5} w={600}>
                참고
              </T>
            </View>
            <Btn
              onPress={() => onRemove(i)}
              accessibilityLabel={`사진 ${i + 1} 빼기`}
              hitSlop={10}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: C.ink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={11} color={C.white} stroke={2.2} />
            </Btn>
          </View>
        ))}
      </View>
      <RefHint />
    </View>
  );
}

/** Which references work: digital ones (app screens, Goodnotes/PDF 속지 captures) read far better
 * than photos of paper notebooks. Shown before attaching, and under the attached photos. */
export function RefHint() {
  return (
    <T s={12.5} c={C.sub}>
      참고 사진은 손으로 쓴 노트 사진보다 앱 화면·굿노트 속지 캡처 같은 디지털 이미지가 더 잘 만들어져요
    </T>
  );
}

/**
 * The photo button inside an input. Opens a small menu: the photo library, or Pinterest
 * (searching for `query`; coming back offers a one-tap paste, see RefStatus).
 * While the input is empty — when people go looking for a look — Pinterest also sits right next
 * to it, one tap away; it folds back into the menu as soon as they start typing.
 */
export function AttachButton({
  refs,
  query,
  pin = true,
}: {
  refs: References;
  query: string;
  /** show the Pinterest chip inside the input while it's empty (off where the input is narrow) */ pin?: boolean;
}) {
  const btn = useRef<ViewInstance>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const { width } = useLayout();
  if (refs.room <= 0) return null;
  const open = () =>
    btn.current?.measureInWindow((x: number, y: number, w: number) =>
      setAt({ x: Math.min(x + w, width - 12), y }),
    );
  const item = (label: string, hint: string, onPress: () => void) => (
    <Btn
      onPress={() => (setAt(null), onPress())}
      accessibilityHint={hint}
      style={{
        minHeight: 48,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: "center",
      }}
    >
      <T s={15}>{label}</T>
    </Btn>
  );
  return (
    <View
      ref={btn}
      collapsable={false}
      style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
    >
      {pin && !query.trim() && <PinterestChip refs={refs} query={query} />}
      <IconButton
        name="image"
        label="참고할 사진 넣기"
        onPress={open}
        color={C.sub}
        iconSize={20}
      />
      <Modal
        visible={!!at}
        transparent
        animationType="fade"
        onRequestClose={() => setAt(null)}
      >
        <Pressable
          accessibilityLabel="닫기"
          onPress={() => setAt(null)}
          style={{ flex: 1 }}
        >
          {at && (
            <View
              accessibilityRole="menu"
              style={{
                position: "absolute",
                right: width - at.x,
                bottom: undefined,
                top: Math.max(12, at.y - 120),
                width: 220,
                padding: 6,
                borderRadius: 16,
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.line,
                shadowColor: C.ink,
                shadowOpacity: 0.12,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
              }}
            >
              {item(
                "사진 보관함",
                "사진을 골라 참고로 넣어요",
                refs.pickLibrary,
              )}
              {item(
                "핀터레스트에서 찾기 ↗",
                "핀터레스트가 열려요. 핀 링크를 복사해 오면 돼요",
                () => refs.goPinterest(query),
              )}
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

/** Above the input, only while fetching a pin or when a pin couldn't be used. */
export function RefStatus({ refs }: { refs: References }) {
  if (!refs.status.busy && !refs.status.error) return null;
  return (
    <T
      s={12.5}
      c={refs.status.error ? C.error : C.sub}
      accessibilityLiveRegion="polite"
      style={{ paddingHorizontal: 4 }}
    >
      {refs.status.busy ? "핀 이미지를 가져오는 중이에요" : refs.status.error}
    </T>
  );
}

/**
 * The input's placeholder, saying what to do right where the user types: back from Pinterest →
 * paste the pin link; photos attached → how they'll be used.
 */
export const refPlaceholder = (
  refs: References,
  photos: number,
  fallback: string,
) =>
  refs.back
    ? "복사한 핀 링크를 여기에 붙여넣어요"
    : photos
      ? "사진을 어떻게 쓸까요? 말 안 하면 디자인만 참고해요"
      : fallback;

/** "핀터레스트 ↗": out to Pinterest searching for `query` (back → paste the pin link). */
export function PinterestChip({
  refs,
  query,
}: {
  refs: References;
  query: string;
}) {
  return (
    <Btn
      onPress={() => refs.goPinterest(query)}
      accessibilityLabel="핀터레스트에서 참고할 사진 찾기"
      accessibilityHint="핀터레스트가 열려요. 핀 링크를 복사해 오면 돼요"
      style={{
        height: 34,
        paddingLeft: 12,
        paddingRight: 10,
        borderRadius: 17,
        backgroundColor: C.fill,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
      }}
    >
      <T s={13} c={C.sub}>
        핀터레스트
      </T>
      <Icon name="external" size={13} color={C.sub} stroke={1.8} />
    </Btn>
  );
}
