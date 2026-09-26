(function(){
'use strict';
if(window.__ftRemoveAudio)return;
window.__ftRemoveAudio=true;

function removeAudioBtn(){
var tb=document.getElementById('floating-toolbar');
if(!tb)return;
var btn=tb.querySelector('[data-action="audio"]');
if(btn&&btn.parentNode){
btn.parentNode.removeChild(btn);
console.log('✅ ft-remove-audio: audio button removed');
}
}

var t=setInterval(function(){
var tb=document.getElementById('floating-toolbar');
if(tb&&tb.getAttribute('data-v2')){
removeAudioBtn();
clearInterval(t);
}
},500);

setTimeout(function(){removeAudioBtn();},2000);
setTimeout(function(){removeAudioBtn();},5000);

new MutationObserver(function(){
if(document.getElementById('floating-toolbar')){
setTimeout(removeAudioBtn,50);
}
}).observe(document.body,{childList:true,subtree:false});

console.log('✅ ft-remove-audio.js v1 loaded');
})();
