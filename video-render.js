// ==============================================
// video-render.js v2 — عرض [video:URL] + حماية
// ==============================================
// ✅ v2:
//   1. منع النقر بزر الماوس الأيمن
//   2. controlsList="nodownload"
//   3. إخفاء الرابط من العرض
//   4. مقاوم للنسخ
// ==============================================

(function(){
'use strict';
if(window.__videoRenderV2)return;
window.__videoRenderV2=true;

var processed=new WeakSet();

function parse(text){
if(!text||text.indexOf('[video:')===-1)return null;
var regex=/\[video:([^\]]+)\]/g;
var parts=[],last=0,m;
while((m=regex.exec(text))!==null){
if(m.index>last)parts.push({type:'text',value:text.substring(last,m.index)});
parts.push({type:'video',value:m[1].trim()});
last=regex.lastIndex;
}
if(last<text.length)parts.push({type:'text',value:text.substring(last)});
return parts.length?parts:null;
}

function build(url){
var w=document.createElement('div');
w.className='video-msg-wrap';
w.style.cssText='max-width:320px;margin-top:6px;border-radius:12px;overflow:hidden;background:#000;';

var v=document.createElement('video');
v.src=url;
v.controls=true;
v.preload='metadata';
v.playsInline=true;
v.setAttribute('playsinline','');
v.setAttribute('webkit-playsinline','');
v.setAttribute('controlsList','nodownload noremoteplayback');
v.setAttribute('disablePictureInPicture','');
v.style.cssText='width:100%;display:block;border-radius:12px;max-height:400px;background:#000;';

/* منع قائمة السياق */
v.oncontextmenu=function(e){e.preventDefault();return false;};

/* منع السحب */
v.ondragstart=function(e){e.preventDefault();return false;};

v.onerror=function(){
w.innerHTML='<div style="padding:12px;color:#ff6666;font-size:12px;text-align:center;">⚠️ تعذّر تحميل الفيديو</div>';
};

w.appendChild(v);
return w;
}

function process(root){
if(!root||root.nodeType!==1)return;
if(processed.has(root))return;
processed.add(root);

var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
acceptNode:function(n){
if(n.parentNode&&n.parentNode.classList&&(n.parentNode.classList.contains('video-msg-wrap')||n.parentNode.tagName==='VIDEO'))return NodeFilter.FILTER_REJECT;
return n.nodeValue&&n.nodeValue.indexOf('[video:')!==-1?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
}
});

var nodes=[];
while(walker.nextNode())nodes.push(walker.currentNode);

nodes.forEach(function(tn){
var parts=parse(tn.nodeValue);
if(!parts)return;

var frag=document.createDocumentFragment();
parts.forEach(function(p){
if(p.type==='text'){
if(p.value&&p.value.trim())frag.appendChild(document.createTextNode(p.value));
}
else if(p.type==='video'){
frag.appendChild(build(p.value));
}
});

try{tn.parentNode.replaceChild(frag,tn);}catch(e){}
});
}

function observe(id){
var c=document.getElementById(id);
if(!c||c.__vRObserved)return;
c.__vRObserved=true;

new MutationObserver(function(muts){
muts.forEach(function(m){
m.addedNodes.forEach(function(n){
if(n.nodeType!==1)return;
if(n.classList&&(n.classList.contains('message')||n.classList.contains('pc-msg'))){
setTimeout(function(){process(n);},60);
}
});
});
}).observe(c,{childList:true,subtree:false});

c.querySelectorAll('.message,.pc-msg').forEach(process);
}

function scan(){
document.querySelectorAll('#messages .message:not(.video-processed),#pc-messages .pc-msg:not(.video-processed)').forEach(function(el){
el.classList.add('video-processed');
process(el);
});
}

function hookDisplay(){
var attempts=0;
var t=setInterval(function(){
attempts++;
var done=0;

if(typeof window.displayMessage==='function'&&!window.displayMessage.__vRWrapped){
var o=window.displayMessage;
window.displayMessage=function(){var r=o.apply(this,arguments);setTimeout(scan,50);return r;};
window.displayMessage.__vRWrapped=true;done++;
}

if(typeof window.displayPrivateMsg==='function'&&!window.displayPrivateMsg.__vRWrapped){
var o2=window.displayPrivateMsg;
window.displayPrivateMsg=function(){var r=o2.apply(this,arguments);setTimeout(scan,50);return r;};
window.displayPrivateMsg.__vRWrapped=true;done++;
}

if(done===2||attempts>=80)clearInterval(t);
},200);
}

function init(){
hookDisplay();
observe('messages');
observe('pc-messages');
setInterval(scan,800);
setTimeout(scan,500);
setTimeout(scan,1500);
setTimeout(function(){
observe('messages');
observe('pc-messages');
},3000);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

window.VideoRender={scan:scan,version:2};
console.log('🎬 video-render.js v2 loaded — anti-copy + no download');
})();
