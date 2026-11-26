/**
 * 바이브 코딩 apps: wraps the AI-written HTML so it runs safely inside a page.
 * - CSP: no network at all (no outside scripts, fonts, images or fetch), inline code only.
 * - window.seyo: { state, save(state), widget(label, value) } — the app's data lives in the page.
 * - alert/confirm/prompt are no-ops; localStorage is backed by seyo.state (sandboxed frames have none).
 */

import { APP_KIT } from './appkit';

export type AppMsg =
  | { seyo: 'save'; state: Record<string, unknown> }
  | { seyo: 'error'; message: string; line?: number }
  /** a finger scrolled the 필기 layer (Pencil in use) but the sheet itself can't scroll: scroll the stack */
  | { seyo: 'scroll'; dy: number }
  /** pinch on a sheet: live `scale` since the pinch began, `end`, or one trackpad/ctrl+wheel `step` */
  | { seyo: 'pinch'; scale?: number; step?: number; end?: boolean };

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
 * Any tool on → the layer takes every touch, so the page's own inputs can't be typed into.
 * 올가미 (lasso): circle strokes and photos (or tap one) → drag to move, corner handle to resize, × to remove.
 * Once an Apple Pencil is seen, fingers scroll instead of drawing. Same one-line rules as PHOTO.
 */
const INK = `
var ink=(st&&st.__ink)||{s:[],i:[]};ink.s=ink.s||[];ink.i=ink.i||[];
var tool='off',color='#1d1d1f',penSeen=false,hist=[],saveT=0,lastSeq=-1,pend=null,layer=null,svg=null,imgs=null,selEl=null,sEls=[],iEls=[],cur=null,curEl=null,tY=null,sel=null,lz=null,lzEl=null,act=null;
var NS='http://www.w3.org/2000/svg',PAD=8,tp=0;
function queue(){clearTimeout(saveT);saveT=setTimeout(function(){seyo.save(Object.assign({},seyo.state,{__ink:ink}));},400);}
function snap(){hist.push(JSON.stringify(ink));if(hist.length>40)hist.shift();}
function r1(v){return Math.round(v*10)/10;}
function dpath(p){if(p.length<4)return 'M'+p[0]+' '+p[1]+'l0.1 0';var s='M'+p[0]+' '+p[1];for(var k=2;k<p.length-2;k+=2){s+='Q'+p[k]+' '+p[k+1]+' '+((p[k]+p[k+2])/2)+' '+((p[k+1]+p[k+3])/2);}return s+'L'+p[p.length-2]+' '+p[p.length-1];}
function pathEl(o){var e=document.createElementNS(NS,'path');e.setAttribute('d',dpath(o.p));e.setAttribute('fill','none');e.setAttribute('stroke',o.c);e.setAttribute('stroke-width',o.w);e.setAttribute('stroke-linecap','round');e.setAttribute('stroke-linejoin','round');e.setAttribute('opacity',o.o);return e;}
function size(){if(!layer)return;var de=document.documentElement;layer.style.width='0';layer.style.height='0';svg.setAttribute('width',0);svg.setAttribute('height',0);var w=Math.max(de.scrollWidth,de.clientWidth),h=Math.max(de.scrollHeight,de.clientHeight);layer.style.width=w+'px';layer.style.height=h+'px';svg.setAttribute('width',w);svg.setAttribute('height',h);}
function imgH(j){var e=iEls[j];return (e&&e.offsetHeight)||ink.i[j].w;}
function drawStrokes(){svg.innerHTML='';sEls=ink.s.map(function(o){var e=pathEl(o);svg.appendChild(e);return e;});}
function drawImgs(){imgs.innerHTML='';iEls=ink.i.map(function(m){var im=document.createElement('img');im.src=m.src;im.draggable=false;im.style.cssText='position:absolute;left:'+m.x+'px;top:'+m.y+'px;width:'+m.w+'px;height:auto;display:block;border-radius:6px;user-select:none;-webkit-user-select:none;pointer-events:none;';im.onload=function(){if(sel&&!act)drawSel();};imgs.appendChild(im);return im;});}
function keepSel(){if(!sel)return;sel.s=sel.s.filter(function(o){return ink.s.indexOf(o)>=0;});sel.i=sel.i.filter(function(m){return ink.i.indexOf(m)>=0;});if(!sel.s.length&&!sel.i.length)sel=null;}
function draw(){if(!layer)return;drawStrokes();drawImgs();keepSel();drawSel();size();}
function box(){var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;sel.s.forEach(function(o){var p=o.p,h=o.w/2;for(var k=0;k<p.length;k+=2){x0=Math.min(x0,p[k]-h);x1=Math.max(x1,p[k]+h);y0=Math.min(y0,p[k+1]-h);y1=Math.max(y1,p[k+1]+h);}});sel.i.forEach(function(m){var h=imgH(ink.i.indexOf(m));x0=Math.min(x0,m.x);y0=Math.min(y0,m.y);x1=Math.max(x1,m.x+m.w);y1=Math.max(y1,m.y+h);});return {x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)};}
function place(x,y,w,h){selEl.style.left=(x-PAD)+'px';selEl.style.top=(y-PAD)+'px';selEl.style.width=(w+PAD*2)+'px';selEl.style.height=(h+PAD*2)+'px';}
function drawSel(){if(!selEl)return;selEl.innerHTML='';if(!sel){selEl.style.display='none';return;}var b=box();selEl.style.display='block';place(b.x,b.y,b.w,b.h);
var x=document.createElement('div');x.setAttribute('data-k','del');x.setAttribute('role','button');x.setAttribute('aria-label','고른 것 지우기');x.textContent='×';x.style.cssText='position:absolute;top:-16px;right:-16px;width:32px;height:32px;border-radius:16px;background:#1d1d1f;color:#fff;font:400 19px/32px system-ui,sans-serif;text-align:center;cursor:pointer;pointer-events:auto;';selEl.appendChild(x);
var h=document.createElement('div');h.setAttribute('data-k','size');h.style.cssText='position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;border-radius:12px;background:#fff;border:2px solid #7fb0e8;box-sizing:border-box;cursor:nwse-resize;pointer-events:auto;';selEl.appendChild(h);}
function nx(a,v,ax){if(a.mode==='move')return v+(ax?a.dy:a.dx);var o=ax?a.b.y:a.b.x;return o+(v-o)*a.k;}
function live(){var a=act,t=a.mode==='move'?'translate('+a.dx+' '+a.dy+')':'translate('+a.b.x+' '+a.b.y+') scale('+a.k+') translate('+(-a.b.x)+' '+(-a.b.y)+')';var k=a.mode==='size'?a.k:1;
sel.s.forEach(function(o){var e=sEls[ink.s.indexOf(o)];if(e)e.setAttribute('transform',t);});
sel.i.forEach(function(m){var e=iEls[ink.i.indexOf(m)];if(!e)return;e.style.left=nx(a,m.x,0)+'px';e.style.top=nx(a,m.y,1)+'px';e.style.width=(m.w*k)+'px';});
place(nx(a,a.b.x,0),nx(a,a.b.y,1),a.b.w*k,a.b.h*k);}
function bake(a){sel.s.forEach(function(o){for(var k=0;k<o.p.length;k+=2){o.p[k]=r1(nx(a,o.p[k],0));o.p[k+1]=r1(nx(a,o.p[k+1],1));}if(a.mode==='size')o.w=r1(Math.max(0.6,o.w*a.k));});
sel.i.forEach(function(m){m.x=Math.round(nx(a,m.x,0));m.y=Math.round(nx(a,m.y,1));if(a.mode==='size')m.w=Math.max(30,Math.round(m.w*a.k));});}
function inside(x,y,P){var c=false;for(var i=0,j=P.length-2;i<P.length;j=i,i+=2){var xi=P[i],yi=P[i+1],xj=P[j],yj=P[j+1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi))c=!c;}return c;}
function near(o,q){var r=144+o.w*o.w/4,p=o.p;if(p.length<4)return seg(q,p[0],p[1],p[0],p[1])<r;for(var k=0;k<p.length-2;k+=2){if(seg(q,p[k],p[k+1],p[k+2],p[k+3])<r)return true;}return false;}
function pick(P){var s=[],im=[],j;
if(P.length<8){var q=[P[0],P[1]];for(j=ink.i.length-1;j>=0;j--){var m=ink.i[j];if(q[0]>=m.x&&q[0]<=m.x+m.w&&q[1]>=m.y&&q[1]<=m.y+imgH(j)){im=[m];break;}}
if(!im.length){for(j=ink.s.length-1;j>=0;j--){if(near(ink.s[j],q)){s=[ink.s[j]];break;}}}}
else{ink.s.forEach(function(o){var n=0,p=o.p;for(var k=0;k<p.length;k+=2){if(inside(p[k],p[k+1],P))n++;}if(n*4>=p.length)s.push(o);});ink.i.forEach(function(m,j2){if(inside(m.x+m.w/2,m.y+imgH(j2)/2,P))im.push(m);});}
sel=(s.length||im.length)?{s:s,i:im}:null;drawSel();}
function pt(e){var r=layer.getBoundingClientRect();return [r1(e.clientX-r.left),r1(e.clientY-r.top)];}
function seg(q,ax,ay,bx,by){var vx=bx-ax,vy=by-ay,l=vx*vx+vy*vy,t=l?Math.max(0,Math.min(1,((q[0]-ax)*vx+(q[1]-ay)*vy)/l)):0,dx=ax+t*vx-q[0],dy=ay+t*vy-q[1];return dx*dx+dy*dy;}
function erase(q){var n=ink.s.length;ink.s=ink.s.filter(function(o){return !near(o,q);});if(ink.s.length!==n)drawStrokes();}
function setTool(t,c){if(t!==tool&&t!=='lasso')sel=null;tool=t;if(c)color=c;if(!layer)return;layer.style.pointerEvents=tool==='off'?'none':'auto';layer.style.cursor=tool==='eraser'?'cell':tool==='lasso'?'default':'crosshair';
if(tool!=='off'){var ae=document.activeElement;if(ae&&ae!==document.body&&ae.blur)ae.blur();}drawSel();}
function mk(){layer=document.createElement('div');layer.id='seyo-ink';layer.style.cssText='position:absolute;left:0;top:0;z-index:2147483000;pointer-events:none;touch-action:none;-webkit-user-select:none;user-select:none;';
imgs=document.createElement('div');imgs.style.cssText='position:absolute;left:0;top:0;width:0;height:0;';layer.appendChild(imgs);
svg=document.createElementNS(NS,'svg');svg.style.cssText='position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';layer.appendChild(svg);
selEl=document.createElement('div');selEl.style.cssText='position:absolute;display:none;border:1.5px dashed #7fb0e8;border-radius:8px;box-sizing:border-box;pointer-events:none;';layer.appendChild(selEl);
document.body.appendChild(layer);
layer.addEventListener('pointerdown',function(e){if(tool==='off')return;if(e.pointerType==='touch'){tp++;if(tp>1){cancel();return;}}if(e.pointerType==='pen')penSeen=true;if(penSeen&&e.pointerType==='touch'){tY=e.clientY;return;}e.preventDefault();layer.setPointerCapture(e.pointerId);var q=pt(e);
if(tool==='lasso'){var k=e.target&&e.target.getAttribute?e.target.getAttribute('data-k'):null;
if(sel&&k==='del'){snap();ink.s=ink.s.filter(function(o){return sel.s.indexOf(o)<0;});ink.i=ink.i.filter(function(m){return sel.i.indexOf(m)<0;});sel=null;draw();queue();return;}
if(sel){var b=box();if(k==='size'||(q[0]>=b.x-PAD&&q[0]<=b.x+b.w+PAD&&q[1]>=b.y-PAD&&q[1]<=b.y+b.h+PAD)){snap();act={mode:k==='size'?'size':'move',q:q,b:b,dx:0,dy:0,k:1};return;}}
sel=null;drawSel();lz=q.slice();lzEl=document.createElementNS(NS,'path');lzEl.setAttribute('fill','rgba(127,176,232,0.08)');lzEl.setAttribute('stroke','#7fb0e8');lzEl.setAttribute('stroke-width','1.5');lzEl.setAttribute('stroke-dasharray','5 5');svg.appendChild(lzEl);return;}
snap();if(tool==='eraser'){cur={erase:true};erase(q);return;}var mk2=tool==='marker';cur={c:color,w:mk2?16:2.4,o:mk2?0.38:1,p:q.slice()};curEl=pathEl(cur);svg.appendChild(curEl);});
layer.addEventListener('pointermove',function(e){if(tY!==null&&e.pointerType==='touch'){var d=tY-e.clientY,y0=scrollY;window.scrollBy(0,d);if(scrollY===y0&&d)post({seyo:'scroll',dy:d});tY=e.clientY;return;}var q;
if(act){q=pt(e);var dx=q[0]-act.q[0],dy=q[1]-act.q[1];if(act.mode==='move'){act.dx=dx;act.dy=dy;}else{act.k=Math.max(0.2,(act.b.w+dx)/act.b.w);}live();return;}
if(lz){q=pt(e);var lx=q[0]-lz[lz.length-2],ly=q[1]-lz[lz.length-1];if(lx*lx+ly*ly<9)return;lz.push(q[0],q[1]);lzEl.setAttribute('d','M'+lz.slice(0,2).join(' ')+'L'+lz.slice(2).join(' ')+'Z');return;}
if(!cur)return;q=pt(e);if(cur.erase){erase(q);return;}var p=cur.p;var ex=q[0]-p[p.length-2],ey=q[1]-p[p.length-1];if(ex*ex+ey*ey<3)return;p.push(q[0],q[1]);curEl.setAttribute('d',dpath(p));});
function cancel(){tY=null;if(cur){if(curEl)curEl.remove();cur=null;curEl=null;hist.pop();drawStrokes();}if(lz){lz=null;if(lzEl)lzEl.remove();lzEl=null;}if(act){act=null;hist.pop();draw();}}
function end(e){if(e&&e.pointerType==='touch')tp=Math.max(0,tp-1);tY=null;
if(act){var a=act;act=null;if(a.dx||a.dy||a.k!==1){bake(a);draw();queue();}else hist.pop();return;}
if(lz){var P=lz;lz=null;if(lzEl)lzEl.remove();lzEl=null;pick(P);return;}
if(!cur)return;if(!cur.erase){ink.s.push(cur);sEls.push(curEl);}cur=null;curEl=null;queue();}
layer.addEventListener('pointerup',end);layer.addEventListener('pointercancel',end);
draw();setTool(tool);if(pend){var m0=pend;pend=null;cmd(m0);}setInterval(size,1000);window.addEventListener('resize',size);}
function addImage(src){var im=new Image();im.onload=function(){var w=Math.round(Math.min(280,innerWidth*0.6));var h=Math.round(w*im.height/Math.max(1,im.width));snap();var m={src:src,x:Math.round(scrollX+(innerWidth-w)/2),y:Math.round(scrollY+Math.max(24,(innerHeight-h)/3)),w:w};ink.i.push(m);sel=tool==='lasso'?{s:[],i:[m]}:null;drawImgs();drawSel();queue();};im.src=src;}
function cmd(m){if(!m)return;if(!layer){pend=m;return;}if(m.tool)setTool(m.tool,m.color);if(m.seq!==lastSeq){if(m.image)addImage(m.image);if(m.undo&&hist.length){ink=JSON.parse(hist.pop());sel=null;draw();queue();}}lastSeq=m.seq;}
window.__seyoInk=cmd;
window.addEventListener('message',function(e){var m=e.data;if(typeof m==='string'){try{m=JSON.parse(m);}catch(x){return;}}if(m&&m.seyoInk)cmd(m.seyoInk);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mk);else mk();
`;

/**
 * Pinch → the app (parent) zooms the stack of sheets: two fingers report the live scale since
 * they landed, then `end`; a trackpad pinch (ctrl+wheel) reports steps. Same one-line rules as PHOTO.
 */
const PINCH = `
var pz=null;function pd(t){var dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy)||1;}
document.addEventListener('touchstart',function(e){if(e.touches.length===2){pz=pd(e.touches);e.preventDefault();}},{passive:false,capture:true});
document.addEventListener('touchmove',function(e){if(pz&&e.touches.length===2){e.preventDefault();post({seyo:'pinch',scale:pd(e.touches)/pz});}},{passive:false,capture:true});
function pe(e){if(pz&&e.touches.length<2){pz=null;post({seyo:'pinch',end:true});}}
document.addEventListener('touchend',pe,{capture:true});document.addEventListener('touchcancel',pe,{capture:true});
document.addEventListener('wheel',function(e){if(e.ctrlKey){e.preventDefault();post({seyo:'pinch',step:Math.exp(-e.deltaY/120)});}},{passive:false});
`;

/** what the app sends to the page's ink layer: the tool and its color, and one-off actions keyed by `seq` */
export type InkCmd = { tool: 'off' | 'pen' | 'marker' | 'eraser' | 'lasso'; color: string; seq: number; image?: string; undo?: boolean };

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
${PINCH}
${PHOTO}
${INK}
})();</script>`.replace(/\n/g, '');

/** The part of a streaming model answer that is HTML so far ('' until the doctype arrives). */
export function htmlSoFar(text: string): string {
  const i = text.search(/<!doctype|<html/i);
  return i < 0 ? '' : text.slice(i);
}

/** `sheetWidth`: an A4 sheet, laid out at that fixed width (a WebView scales it to fit its frame) */
export function buildDoc(html: string, state: Record<string, unknown>, sheetWidth?: number): string {
  const viewport = sheetWidth ? `width=${sheetWidth},user-scalable=no` : 'width=device-width,initial-scale=1,maximum-scale=1';
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="${viewport}"><style id="seyo-kit">${APP_KIT}</style>${bridge(state)}`;
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index !== undefined) return html.slice(0, m.index + m[0].length) + head + html.slice(m.index + m[0].length);
  const h = html.match(/<html[^>]*>/i);
  if (h && h.index !== undefined) return html.slice(0, h.index + h[0].length) + `<head>${head}</head>` + html.slice(h.index + h[0].length);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

export function parseMsg(data: unknown): AppMsg | null {
  try {
    const m = (typeof data === 'string' ? JSON.parse(data) : data) as AppMsg;
    return m && typeof m === 'object' && (m.seyo === 'save' || m.seyo === 'error' || m.seyo === 'scroll' || m.seyo === 'pinch') ? m : null;
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
  /** an A4 sheet: the page is laid out at w×h and drawn scaled by k (the frame is w·k × h·k) */
  sheet?: { w: number; h: number; k: number };
  /** 필기 with a Pencil: a finger dragged on a sheet that can't scroll (dy in sheet px) */
  onScrollBy?: (dy: number) => void;
  /** a sheet was pinched (zoom is the stack's job: the sheet itself never zooms) */
  onPinch?: (m: { scale?: number; step?: number; end?: boolean }) => void;
};
