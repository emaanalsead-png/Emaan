(function(){
'use strict';
if(window.__ftUploadFixV2)return;
window.__ftUploadFixV2=true;

function toast(i,m){if(typeof showToast==='function')showToast(i,m);}

function mkInput(accept){
var fi=document.createElement('input');
fi.type='file';
fi.accept=accept;
fi.style.display='none';
document.body.appendChild(fi);
return fi;
}

var inputFiles=mkInput('image/*,video/*,audio/*');
var inputAudio=mkInput('audio/*');

async function doUpload(fi){
var file=fi.files&&fi.files[0];
if(!file)return;
fi.value='';
var type='auto';
if(file.type.indexOf('video/')===0)type='video';
else if(file.type.indexOf('audio/')===0)type='audio';
else type='image';
var maxMb=type==='video'?50:type==='audio'?30:20;
if(file.size/(1024*1024)>maxMb){
toast('fa-exclamation-triangle','⚠️ الحد '+maxMb+'MB');
return;
}

toast('fa-spinner','⏳ جاري الرفع...');
try{
if(!window.UploadService||typeof window.UploadService.upload!=='function'){
throw new Error('خدمة الرفع غير جاهزة');
}
var url=await window.UploadService.upload(file);
if(!url)throw new Error('لم يرجع رابط');

var token;
if(type==='image')token='[img:'+url+']';
else if(type==='video')token='[video:'+url+']';
else if(type==='audio')token='[audio:'+url+']';
else token='[img:'+url+']';

var pm=document.getElementById('private-chat-modal');
var isPm=pm&&pm.classList.contains('open');
var inputId=isPm?'pc-input':'message-input';
var inp=document.getElementById(inputId);
if(!inp)throw new Error('حقل الإدخال غير موجود');

var prev=inp.value;
inp.value=token;

try{
if(isPm){
if(typeof sendPrivateMsg==='function'){
await sendPrivateMsg();
}else{
throw new Error('sendPrivateMsg غير محمّل');
}
}else{
if(typeof sendMessage==='function'){
await sendMessage();
}else{
throw new Error('sendMessage غير محمّل');
}
}

// تحقق: هل تم تفريغ الحقل؟ إذا نعم → نجح الإرسال
setTimeout(function(){
if(inp.value===token){
// لم يُفرَّغ → الإرسال فشل (rate limit مثلاً)
inp.value=prev?prev+' '+token:token;
toast('fa-info-circle','⚠️ اضغط إرسال يدوياً');
}else{
toast('fa-check','✅ تم الإرسال');
}
},500);
}catch(e){
inp.value=prev;
throw e;
}
}catch(err){
console.error('FT upload failed:',err);
toast('fa-times','⚠️ '+(err.message||'فشل الرفع'));
}
}

inputFiles.onchange=function(){doUpload(this);};
inputAudio.onchange=function(){doUpload(this);};

function closeToolbar(){
var t=document.getElementById('floating-toolbar');
if(t)t.classList.remove('open');
var b=document.getElementById('plus-btn');
if(b)b.classList.remove('active');
}

var attempts=0;
var t=setInterval(function(){
attempts++;
var tb=document.getElementById('floating-toolbar');
if(!tb||!tb.getAttribute('data-v2')){
if(attempts>=60)clearInterval(t);
return;
}

// زر ملفات
var filesBtn=tb.querySelector('[data-action="files"]');
if(filesBtn&&!filesBtn.__ftFix){
filesBtn.__ftFix=true;
filesBtn.onclick=function(e){
e.preventDefault();e.stopPropagation();
closeToolbar();
inputFiles.click();
};
}

// زر صوتيات
var audioBtn=tb.querySelector('[data-action="audio"]');
if(audioBtn&&!audioBtn.__ftFix){
audioBtn.__ftFix=true;
audioBtn.onclick=function(e){
e.preventDefault();e.stopPropagation();
closeToolbar();
inputAudio.click();
};
}

clearInterval(t);
console.log('✅ ft-upload-fix v2: direct send wired');
},500);
})();
