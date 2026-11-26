/**
 * 바이브 코딩 on the app side: stream a code app from the server and report progress.
 * Creating streams the whole HTML, so the preview can draw it while it's being written.
 * Editing streams only the changed parts; if the server falls back to a full rewrite
 * ("restart"), the preview draws that one live too.
 */
import { api } from './api';
import { htmlSoFar } from './appdoc';
import { Device, newToken, Page, uid } from './page';
import { pageToApp } from './page2app';

/**
 * Progress while the AI works. Creating: `html` is the page so far (drawn live). Editing: `plan`
 * is the to-do list the model writes before its changes, `blocks` how many changes have landed.
 * `fixing`: the quality check is repairing something.
 */
export type Live = { html: string; chars: number; fixing?: boolean; plan?: string[]; blocks?: number; editing?: boolean };
export type AppResult = { html: string | null; summary: string; left: number | null };

/** Throws ApiError (402 = out of tries) or Error (server unreachable / failed). */
/** `images`: photos attached to the request (data URLs) — a design reference unless the request says otherwise. */
export async function runApp(prompt: string, html: string | null, onLive: (l: Live) => void, name?: string, crash?: string, from?: Page, images?: string[], device?: Device): Promise<AppResult> {
  let text = '';
  let full = !html; // the stream is a whole HTML file (create, or a rewrite after restart)
  let last = 0;
  let result: AppResult | null = null;
  let error: string | null = null;
  await api.appStream({ prompt, html, name, error: crash, page: from, images: images?.length ? images : undefined, device }, (e) => {
    if (e.t === 'code') {
      text += e.d;
      const now = Date.now();
      if (now - last > 450) {
        last = now;
        onLive(progressOf(text, full, !!html));
      }
    } else if (e.t === 'fixing' || e.t === 'checking') {
      onLive({ ...progressOf(text, full, !!html), fixing: true });
    } else if (e.t === 'restart') {
      text = '';
      full = true;
    } else if (e.t === 'done') result = { html: e.html, summary: e.summary, left: e.left };
    else if (e.t === 'error') error = e.message;
  });
  if (error) throw new Error(error);
  if (!result) throw new Error('잠시 문제가 생겼어요. 다시 말해 볼래요?');
  return result;
}

function progressOf(text: string, full: boolean, editing: boolean): Live {
  if (full) return { html: htmlSoFar(text), chars: text.length, editing };
  const head = text.split('<<<<<<< SEARCH', 1)[0];
  const plan = head
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    // "user-facing words :: the model's own notes": only the words are shown
    .map((l) => l.trim().slice(2).split('::')[0].split(':')[0].trim())
    .filter(Boolean)
    .slice(0, 6);
  const blocks = (text.match(/^>{5,}/gm) ?? []).length;
  return { html: '', chars: text.length, plan, blocks, editing };
}

/** Page name from the app's <title>, else from what the user said. */
export function appName(html: string, prompt: string): string {
  const t = html.match(/<title>([^<]{1,40})<\/title>/i)?.[1]?.trim();
  return (t || prompt.trim()).slice(0, 24);
}

export function appPage(html: string, prompt: string, device?: Device): Page {
  const now = Date.now();
  return {
    device,
    id: uid('page'),
    name: appName(html, prompt),
    theme: 'clean',
    top: null,
    reason: null,
    main: { kind: 'app', html, state: {} },
    side: null,
    memo: null,
    big: false,
    dimDone: false,
    createdAt: now,
    updatedAt: now,
    owner: null,
    members: [],
    inviteToken: newToken(),
    widget: { size: 'small', templates: ['bigNumber'] },
  };
}

/**
 * The fixed blocks couldn't do it: the page becomes a code app that does what was asked.
 * The page is first drawn as the same page in HTML (lib/page2app.ts) and the AI *edits* that, so
 * the design the user already has stays and only the asked part changes (and an edit is much
 * faster than a whole new app). Pages page2app can't draw get the full rebuild.
 * Same page (id, sharing, name, theme); the body becomes the app.
 */
export async function convertToApp(page: Page, prompt: string, onLive: (l: Live) => void, images?: string[]): Promise<{ page: Page | null; summary: string; left: number | null }> {
  const base = pageToApp(page);
  const r = base ? await runApp(prompt, base, onLive, page.name, undefined, undefined, images, page.device) : await runApp(prompt, null, onLive, page.name, undefined, page, images, page.device);
  if (!r.html) return { page: null, summary: r.summary, left: r.left };
  return {
    page: { ...page, main: { kind: 'app', html: r.html, state: {} }, top: null, reason: null, side: null, memo: null, widget: { size: 'small', templates: ['bigNumber'] }, updatedAt: Date.now() },
    summary: r.summary,
    left: r.left,
  };
}

/**
 * Runtime repair: when a code app throws, ask the server to fix it once per version of the code
 * (free, see /ai/app `error`). Returns the fixed html, or null if it couldn't.
 */
export async function repairApp(html: string, error: string, onLive: (l: Live) => void, name?: string): Promise<string | null> {
  try {
    const r = await runApp('오류 고치기', html, onLive, name, error.slice(0, 300));
    return r.html;
  } catch {
    return null;
  }
}

/**
 * One calm line for where things are. Talks about the page, never about code.
 * Creating moves through stages by how much of the page has arrived.
 */
export const liveLabel = (l: Live | null, editing: boolean) => {
  if (l?.fixing) return '마지막으로 다듬고 있어요';
  if (editing) {
    if (!l || (!l.plan?.length && !l.html)) return '어디를 바꿀지 보고 있어요';
    if (l.html) return '페이지를 다시 그리고 있어요';
    const doing = l.plan?.[Math.min(l.blocks ?? 0, (l.plan?.length ?? 1) - 1)];
    return doing ? `${doing} 하는 중` : '바꾸는 중이에요';
  }
  if (!l || !l.html) return '요청을 읽고 있어요';
  if (l.chars < 2500) return '화면 뼈대를 잡고 있어요';
  if (l.chars < 7000) return '내용을 채우고 있어요';
  return '기능을 연결하고 있어요';
};
