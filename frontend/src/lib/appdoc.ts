/**
 * 바이브 코딩 apps: wraps the AI-written HTML so it runs safely inside a page.
 * - CSP: no network at all (no outside scripts, fonts, images or fetch), inline code only.
 * - window.seyo: { state, save(state), widget(label, value) } — the app's data lives in the page.
 * - alert/confirm/prompt are no-ops; localStorage is backed by seyo.state (sandboxed frames have none).
 */

import { APP_KIT } from './appkit';

export type AppMsg = { seyo: 'save'; state: Record<string, unknown> } | { seyo: 'error'; message: string; line?: number };

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";

/**
 * Photos, all on the device (nothing leaves the page): an image is shrunk on a canvas to a JPEG
 * data URL (long side ≤ 1280px by default) that the app keeps in seyo.state and shows in <img>.
 * - seyo.photo({max}) → Promise<dataURL>: opens the photo picker (call it inside a tap handler).
 *   Never settles if the picker is cancelled.
 * - seyo.onPhotoPaste(fn): fn(dataURL) for every image pasted (⌘V) or dropped onto the page.
 * - seyo.photoFromFile(file, {max}) → Promise<dataURL>: the shrinking step on its own.
 * Joined onto one line with the rest of the bridge, so: no // comments, every statement ends in ;
 */
const PHOTO = `
function shrink(file,o){return new Promise(function(res,rej){
if(!file||!/^image\\//.test(file.type||'image/'))return rej(new Error('사진 파일이 아니에요'));
var max=(o&&o.max)||1280;var r=new FileReader();
r.onerror=function(){rej(new Error('사진을 읽지 못했어요'));};
r.onload=function(){var img=new Image();
img.onerror=function(){rej(new Error('사진을 열 수 없어요'));};
img.onload=function(){var k=Math.min(1,max/Math.max(img.width,img.height));var c=document.createElement('canvas');
c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
res(c.toDataURL('image/jpeg',0.82));};img.src=r.result;};r.readAsDataURL(file);});}
seyo.photoFromFile=shrink;
seyo.photo=function(o){return new Promise(function(res,rej){var i=document.createElement('input');i.type='file';i.accept='image/*';
i.style.cssText='position:fixed;left:-9999px;opacity:0';document.body.appendChild(i);
i.onchange=function(){var f=i.files&&i.files[0];i.remove();if(f)shrink(f,o).then(res,rej);};i.click();});};
var pasteFns=[];seyo.onPhotoPaste=function(fn){if(typeof fn==='function')pasteFns.push(fn);};
function imageIn(list){for(var j=0;list&&j<list.length;j++){var it=list[j];var f=it.getAsFile?(it.kind==='file'?it.getAsFile():null):it;if(f&&/^image\\//.test(f.type))return f;}return null;}
function take(f){shrink(f).then(function(u){pasteFns.forEach(function(fn){try{fn(u);}catch(e){setTimeout(function(){throw e;});}});});}
document.addEventListener('paste',function(e){if(!pasteFns.length)return;var f=imageIn(e.clipboardData&&(e.clipboardData.items||e.clipboardData.files));if(!f)return;e.preventDefault();take(f);});
document.addEventListener('dragover',function(e){if(pasteFns.length&&e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types||[],'Files')>=0)e.preventDefault();});
document.addEventListener('drop',function(e){if(!pasteFns.length)return;var f=imageIn(e.dataTransfer&&e.dataTransfer.files);if(!f)return;e.preventDefault();take(f);});
`;

const bridge = (state: Record<string, unknown>) => `<script>(function(){
var st=${JSON.stringify(state).replace(/</g, '\\u003c')};
function post(m){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(m));else parent.postMessage(m,'*');}catch(e){}}
var seyo={state:st,save:function(s){if(!s||typeof s!=='object')return;seyo.state=s;post({seyo:'save',state:s});},
widget:function(label,value){var s=Object.assign({},seyo.state,{__widget:{label:String(label),value:String(value)}});seyo.save(s);}};
window.seyo=seyo;
window.alert=window.confirm=window.prompt=function(){};
var ls={getItem:function(k){var m=seyo.state.__ls||{};return k in m?m[k]:null;},setItem:function(k,v){var m=Object.assign({},seyo.state.__ls||{});m[k]=String(v);seyo.save(Object.assign({},seyo.state,{__ls:m}));},removeItem:function(k){var m=Object.assign({},seyo.state.__ls||{});delete m[k];seyo.save(Object.assign({},seyo.state,{__ls:m}));},clear:function(){seyo.save(Object.assign({},seyo.state,{__ls:{}}));}};
try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){}
window.addEventListener('error',function(e){post({seyo:'error',message:String(e.message||'error'),line:e.lineno||0});});
window.addEventListener('unhandledrejection',function(e){post({seyo:'error',message:String(e.reason&&e.reason.message||e.reason||'error')});});
${PHOTO}
})();</script>`.replace(/\n/g, '');

/** The part of a streaming model answer that is HTML so far ('' until the doctype arrives). */
export function htmlSoFar(text: string): string {
  const i = text.search(/<!doctype|<html/i);
  return i < 0 ? '' : text.slice(i);
}

export function buildDoc(html: string, state: Record<string, unknown>): string {
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style id="seyo-kit">${APP_KIT}</style>${bridge(state)}`;
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index !== undefined) return html.slice(0, m.index + m[0].length) + head + html.slice(m.index + m[0].length);
  const h = html.match(/<html[^>]*>/i);
  if (h && h.index !== undefined) return html.slice(0, h.index + h[0].length) + `<head>${head}</head>` + html.slice(h.index + h[0].length);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

export function parseMsg(data: unknown): AppMsg | null {
  try {
    const m = (typeof data === 'string' ? JSON.parse(data) : data) as AppMsg;
    return m && typeof m === 'object' && (m.seyo === 'save' || m.seyo === 'error') ? m : null;
  } catch {
    return null;
  }
}

export type AppFrameProps = {
  html: string;
  state: Record<string, unknown>;
  /** the app called seyo.save (ignored while `live`) */
  onSave?: (state: Record<string, unknown>) => void;
  /** still being written by the AI: shown as-is, nothing saved */
  live?: boolean;
  /** the app threw (ignored while `live`): "message (line n)" */
  onError?: (error: string) => void;
};
