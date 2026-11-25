/**
 * Photos attached to a request (the ask bar, the first-page input, the new-page chat).
 * They're shrunk on the device to a JPEG data URL (long side ≤ 1024px, ~100–200 KB) before
 * going to the server, which hands them to the model: a design reference by default, or used the
 * way the request says (see backend/app/skills/core.md, "첨부 사진").
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { api, ApiError } from './api';

export const MAX_ATTACH = 3;
const MAX_SIDE = 1024;

async function shrink(uri: string): Promise<string | null> {
  try {
    let ref = await ImageManipulator.manipulate(uri).renderAsync();
    const long = Math.max(ref.width, ref.height);
    if (long > MAX_SIDE) {
      ref = await ImageManipulator.manipulate(uri)
        .resize(ref.width >= ref.height ? { width: MAX_SIDE } : { height: MAX_SIDE })
        .renderAsync();
    }
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}

/** Opens the photo library (up to `room` photos). Resolves [] when cancelled. */
export async function pickPhotos(room = MAX_ATTACH): Promise<string[]> {
  if (room <= 0) return [];
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: room > 1, selectionLimit: room, quality: 1 });
  if (r.canceled) return [];
  const out = await Promise.all(r.assets.slice(0, room).map((a) => shrink(a.uri)));
  return out.filter((x): x is string => !!x);
}

/**
 * Web: images pasted (⌘V) into the given input become attachments. The text paste still goes
 * through when the clipboard has no image. (On iPad, attaching is the photo button.)
 */
export function usePastePhotos(ref: RefObject<unknown>, onPhotos: (urls: string[]) => void, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const el = ref.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const on = (e: Event) => {
      const items = (e as ClipboardEvent).clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;
      e.preventDefault();
      Promise.all(files.slice(0, MAX_ATTACH).map((f) => shrink(URL.createObjectURL(f)))).then((urls) => {
        const ok = urls.filter((x): x is string => !!x);
        if (ok.length) onPhotos(ok);
      });
    };
    el.addEventListener('paste', on);
    return () => el.removeEventListener('paste', on);
  }, [ref, onPhotos, enabled]);
}

/* ───────── Pinterest flow (no search in the app: out to Pinterest, back with a pin link) ───────── */

/** A whole pin link: a /pin/ path ending in its id (6+ digits), or a pin.it short link. */
const PIN_LINK = /https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?(?:pinterest\.[a-z.]{2,6}\/pin\/(?:[\w-]*-)?\d{6,}|pin\.it\/[\w]{6,})\/?/i;

/** Opens Pinterest (the app on iPad when installed) searching for what the user is making. */
export function openPinterest(query: string) {
  const q = query.trim() ? `${query.trim()} 디자인` : '플래너 디자인';
  Linking.openURL(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`).catch(() => {});
}

export type RefStatus = { busy: boolean; error: string | null };

/**
 * Everything that brings a reference photo into a request: the photo library, a pin link pasted
 * into the input, and the round trip to Pinterest: out with a search; back (the app comes to the
 * front again) → the input is focused and its placeholder asks for the copied pin link, so a
 * normal paste finishes it (no extra button, no clipboard permission prompt).
 */
export function useReferences(onPhotos: (urls: string[]) => void, room: number, input?: RefObject<{ focus?: () => void } | null>) {
  const [status, setStatus] = useState<RefStatus>({ busy: false, error: null });
  /** back from Pinterest: offer to paste the copied pin link */
  const [back, setBack] = useState(false);
  const away = useRef(false);
  const last = useRef('');

  const fetchPin = useCallback(
    (link: string) => {
      setStatus({ busy: true, error: null });
      api
        .pinImage(link)
        .then((r) => {
          onPhotos([r.image]);
          setStatus({ busy: false, error: null });
        })
        .catch((e) => setStatus({ busy: false, error: e instanceof ApiError ? e.message : '핀을 가져오지 못했어요. 이미지를 복사해서 붙여넣어 주세요' }));
    },
    [onPhotos],
  );

  /** Wraps the input's onChangeText: a pasted pin link leaves the text and becomes a photo. */
  const take = useCallback(
    (text: string): string => {
      // only a paste (a chunk arriving at once): a link typed by hand is half a link most of the time
      const pasted = text.length - last.current.length >= 15;
      last.current = text;
      const m = pasted ? text.match(PIN_LINK) : null;
      if (!m) return text;
      fetchPin(m[0]);
      setBack(false);
      const rest = text.replace(m[0], '').replace(/\s{2,}/g, ' ').trim();
      last.current = rest;
      return rest;
    },
    [fetchPin],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && away.current) {
        away.current = false;
        setBack(true);
        setTimeout(() => input?.current?.focus?.(), 300);
      }
    });
    return () => sub.remove();
  }, [input]);
  useEffect(() => {
    if (!back) return;
    const t = setTimeout(() => setBack(false), 60000);
    return () => clearTimeout(t);
  }, [back]);

  const goPinterest = useCallback((query: string) => {
    away.current = true;
    setBack(false);
    setStatus({ busy: false, error: null });
    openPinterest(query);
  }, []);

  const pickLibrary = useCallback(() => {
    pickPhotos(room).then((p) => p.length && onPhotos(p));
  }, [room, onPhotos]);

  return { take, status, back, goPinterest, pickLibrary, room };
}

export type References = ReturnType<typeof useReferences>;
