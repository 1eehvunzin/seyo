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

/**
 * 필기 (Goodnotes-style ink) + 자유 이미지: a layer over the whole document, in document coordinates,
 * so strokes and photos scroll with the page. Kept in seyo.state.__ink = { s: strokes, i: images }.
 * The app (parent) drives it with { seyoInk: InkCmd } messages (web) / window.__seyoInk(cmd) (iPad).
 * Once an Apple Pencil is seen, fingers scroll instead of drawing. Same one-line rules as PHOTO.
 */
const INK = `
var ink=(st&&st.__ink)||{s:[],i:[]};ink.s=ink.s||[];ink.i=ink.i||[];
var tool='off',color='#1d1d1f',penSeen=false,hist=[],saveT=0,lastSeq=-1,pend=null,layer=null,svg=null,imgs=null,cur=null,curEl=null,tY=null;
var NS='http://www.w3.org/2000/svg';
function queue(){clearTimeout(saveT);saveT=setTimeout(function(){seyo.save(Object.assign({},seyo.state,{__ink:ink}));},400);}
function snap(){hist.push(JSON.stringify(ink));if(hist.length>40)hist.shift();}
function dpath(p){if(p.length<4)return 'M'+p[0]+' '+p[1]+'l0.1 0';var s='M'+p[0]+' '+p[1];for(var k=2;k<p.length-2;k+=2){s+='Q'+p[k]+' '+p[k+1]+' '+((p[k]+p[k+2])/2)+' '+((p[k+1]+p[k+3])/2);}return s+'L'+p[p.length-2]+' '+p[p.length-1];}
function pathEl(o){var e=document.createElementNS(NS,'path');e.setAttribute('d',dpath(o.p));e.setAttribute('fill','none');e.setAttribute('stroke',o.c);e.setAttribute('stroke-width',o.w);e.setAttribute('stroke-linecap','round');e.setAttribute('stroke-linejoin','round');e.setAttribute('opacity',o.o);return e;}
function size(){if(!layer)return;var de=document.documentElement;layer.style.width='0';layer.style.height='0';svg.setAttribute('width',0);svg.setAttribute('height',0);var w=Math.max(de.scrollWidth,de.clientWidth),h=Math.max(de.scrollHeight,de.clientHeight);layer.style.width=w+'px';layer.style.height=h+'px';svg.setAttribute('width',w);svg.setAttribute('height',h);}
function drag(b,m,h){var mode=null,sx=0,sy=0,ox=0,oy=0,ow=0;
b.addEventListener('pointerdown',function(e){if(e.target.tagName==='BUTTON')return;e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);mode=e.target===h?'size':'move';sx=e.clientX;sy=e.clientY;ox=m.x;oy=m.y;ow=m.w;snap();});
b.addEventListener('pointermove',function(e){if(!mode)return;var dx=e.clientX-sx,dy=e.clientY-sy;if(mode==='move'){m.x=Math.round(ox+dx);m.y=Math.round(oy+dy);b.style.left=m.x+'px';b.style.top=m.y+'px';}else{m.w=Math.max(60,Math.round(ow+dx));b.style.width=m.w+'px';}});
function up(){if(mode){mode=null;queue();}}b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);}
function renderImgs(){imgs.innerHTML='';var mv=tool==='move';ink.i.forEach(function(m){var b=document.createElement('div');
b.style.cssText='position:absolute;left:'+m.x+'px;top:'+m.y+'px;width:'+m.w+'px;'+(mv?'pointer-events:auto;outline:1.5px dashed #7fb0e8;outline-offset:3px;cursor:move;touch-action:none;':'pointer-events:none;');
var im=document.createElement('img');im.src=m.src;im.draggable=false;im.style.cssText='display:block;width:100%;height:auto;border-radius:6px;user-select:none;-webkit-user-select:none;';b.appendChild(im);
if(mv){var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','사진 빼기');x.textContent='×';x.style.cssText='position:absolute;top:-13px;right:-13px;width:28px;height:28px;border-radius:14px;border:0;background:#1d1d1f;color:#fff;font-size:17px;line-height:28px;padding:0;cursor:pointer;';
x.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();snap();ink.i=ink.i.filter(function(o){return o!==m;});renderImgs();queue();});b.appendChild(x);
var h=document.createElement('span');h.style.cssText='position:absolute;right:-10px;bottom:-10px;width:20px;height:20px;border-radius:10px;background:#fff;border:2px solid #7fb0e8;cursor:nwse-resize;';b.appendChild(h);drag(b,m,h);}
imgs.appendChild(b);});}
function render(){if(!layer)return;svg.innerHTML='';ink.s.forEach(function(o){svg.appendChild(pathEl(o));});renderImgs();size();}
function pt(e){var r=layer.getBoundingClientRect();return [Math.round((e.clientX-r.left)*10)/10,Math.round((e.clientY-r.top)*10)/10];}
function seg(q,ax,ay,bx,by){var vx=bx-ax,vy=by-ay,l=vx*vx+vy*vy,t=l?Math.max(0,Math.min(1,((q[0]-ax)*vx+(q[1]-ay)*vy)/l)):0,dx=ax+t*vx-q[0],dy=ay+t*vy-q[1];return dx*dx+dy*dy;}
function erase(q){var n=ink.s.length;ink.s=ink.s.filter(function(o){var r=144+o.w*o.w/4,p=o.p;if(p.length<4)return seg(q,p[0],p[1],p[0],p[1])>=r;for(var k=0;k<p.length-2;k+=2){if(seg(q,p[k],p[k+1],p[k+2],p[k+3])<r)return false;}return true;});if(ink.s.length!==n){svg.innerHTML='';ink.s.forEach(function(o){svg.appendChild(pathEl(o));});}}
function drawing(){return tool==='pen'||tool==='marker'||tool==='eraser';}
function setTool(t,c){tool=t;if(c)color=c;if(!layer)return;layer.style.pointerEvents=drawing()?'auto':'none';layer.style.cursor=tool==='eraser'?'cell':'crosshair';renderImgs();}
function mk(){layer=document.createElement('div');layer.id='seyo-ink';layer.style.cssText='position:absolute;left:0;top:0;z-index:2147483000;pointer-events:none;touch-action:none;';
imgs=document.createElement('div');imgs.style.cssText='position:absolute;left:0;top:0;width:0;height:0;';layer.appendChild(imgs);
svg=document.createElementNS(NS,'svg');svg.style.cssText='position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';layer.appendChild(svg);document.body.appendChild(layer);
layer.addEventListener('pointerdown',function(e){if(!drawing())return;if(e.pointerType==='pen')penSeen=true;if(penSeen&&e.pointerType==='touch'){tY=e.clientY;return;}e.preventDefault();layer.setPointerCapture(e.pointerId);var q=pt(e);snap();
if(tool==='eraser'){cur={erase:true};erase(q);return;}var mk2=tool==='marker';cur={c:color,w:mk2?16:2.4,o:mk2?0.38:1,p:q.slice()};curEl=pathEl(cur);svg.appendChild(curEl);});
layer.addEventListener('pointermove',function(e){if(tY!==null&&e.pointerType==='touch'){window.scrollBy(0,tY-e.clientY);tY=e.clientY;return;}if(!cur)return;var q=pt(e);if(cur.erase){erase(q);return;}var p=cur.p;var dx=q[0]-p[p.length-2],dy=q[1]-p[p.length-1];if(dx*dx+dy*dy<3)return;p.push(q[0],q[1]);curEl.setAttribute('d',dpath(p));});
function end(){tY=null;if(!cur)return;if(!cur.erase)ink.s.push(cur);cur=null;curEl=null;queue();}
layer.addEventListener('pointerup',end);layer.addEventListener('pointercancel',end);
render();setTool(tool);if(pend){var m0=pend;pend=null;cmd(m0);}setInterval(size,1000);window.addEventListener('resize',size);}
function addImage(src){var im=new Image();im.onload=function(){var w=Math.round(Math.min(280,innerWidth*0.6));var h=Math.round(w*im.height/Math.max(1,im.width));snap();ink.i.push({src:src,x:Math.round(scrollX+(innerWidth-w)/2),y:Math.round(scrollY+Math.max(24,(innerHeight-h)/3)),w:w});renderImgs();queue();};im.src=src;}
function cmd(m){if(!m)return;if(!layer){pend=m;return;}if(m.tool)setTool(m.tool,m.color);if(m.seq!==lastSeq){if(m.image)addImage(m.image);if(m.undo&&hist.length){ink=JSON.parse(hist.pop());render();queue();}}lastSeq=m.seq;}
window.__seyoInk=cmd;
window.addEventListener('message',function(e){var m=e.data;if(typeof m==='string'){try{m=JSON.parse(m);}catch(x){return;}}if(m&&m.seyoInk)cmd(m.seyoInk);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mk);else mk();
`;

/** what the app sends to the page's ink layer: the tool, and one-off actions keyed by `seq` */
export type InkCmd = { tool: 'off' | 'pen' | 'marker' | 'eraser' | 'move'; color: string; seq: number; image?: string; undo?: boolean };

const bridge = (state: Record<string, unknown>) => `<script>(function(){
var st=${JSON.stringify(state).replace(/</g, '\\u003c')};
function post(m){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(m));else parent.postMessage(m,'*');}catch(e){}}
var seyo={state:st,save:function(s){if(!s||typeof s!=='object')return;var keep={};['__ink','__ls'].forEach(function(k){if(seyo.state&&seyo.state[k]!==undefined&&!(k in s))keep[k]=seyo.state[k];});s=Object.assign({},s,keep);seyo.state=s;post({seyo:'save',state:s});},
widget:function(label,value){var s=Object.assign({},seyo.state,{__widget:{label:String(label),value:String(value)}});seyo.save(s);}};
window.seyo=seyo;
window.alert=window.confirm=window.prompt=function(){};
var ls={getItem:function(k){var m=seyo.state.__ls||{};return k in m?m[k]:null;},setItem:function(k,v){var m=Object.assign({},seyo.state.__ls||{});m[k]=String(v);seyo.save(Object.assign({},seyo.state,{__ls:m}));},removeItem:function(k){var m=Object.assign({},seyo.state.__ls||{});delete m[k];seyo.save(Object.assign({},seyo.state,{__ls:m}));},clear:function(){seyo.save(Object.assign({},seyo.state,{__ls:{}}));}};
try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){}
window.addEventListener('error',function(e){post({seyo:'error',message:String(e.message||'error'),line:e.lineno||0});});
window.addEventListener('unhandledrejection',function(e){post({seyo:'error',message:String(e.reason&&e.reason.message||e.reason||'error')});});
${PHOTO}
${INK}
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
  /** 필기 mode: the ink tool and one-off actions (photo, undo) for the page's ink layer */
  ink?: InkCmd;
};
