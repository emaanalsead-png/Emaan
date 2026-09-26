(function(){
'use strict';
if(window.__uploadButtonV1)return;
window.__uploadButtonV1=true;

// انتظر حتى يظهر input-area
var t=setInterval(function(){
var inputArea=document.querySelector('.input-area');
if(!inputArea)return;
if(document.getElementById('upload-btn-main')){clearInterval(t);return;}

// أنشئ زر رفع
var btn=document.createElement('button');
btn.type='button';
btn.id='upload-btn-main';
btn.className='emoji-btn';
btn.innerHTML='<i class="fas fa-image"></i>';
btn.title='رفع صورة/فيديو';
btn.style.cssText='color:#ffd700;font-size:18px;';

// file input مخفي
var fi=document.createElement('input');
fi.type='file';
fi.accept='image/*,video/*,audio/*';
fi.style.display='none';
document.body.appendChild(fi);

btn.onclick=function(e){
e.preventDefault();
e.stopPropagation();
fi.click();
};

fi.onchange=async function(){
var file=this.files&&this.files[0];
if(!file){return;}
this.value='';

// تحديد النوع
var type='image';
if(file.type.indexOf('video/')===0)type='video';
else if(file.type.indexOf('audio/')===0)type='audio';

// حد الحجم
var maxMb=type==='video'?50:type==='audio'?30:20;
if(file.size/(1024*1024)>maxMb){
if(typeof showToast==='function')showToast('fa-exclamation-triangle','⚠️ الحد '+maxMb+'MB');
return;
}

if(typeof showToast==='function')showToast('fa-spinner','⏳ جاري الرفع...');

try{
if(!window.UploadService||typeof window.UploadService.upload!=='function'){
throw new Error('خدمة الرفع غير جاهزة');
}
var url=await window.UploadService.upload(file);
if(!url)throw new Error('لم يرجع رابط');

// حدد الـ input (عام أو خاص)
var isPm=document.getElementById('private-chat-modal');
isPm=isPm&&isPm.classList.contains('open');
var inputId=isPm?'pc-input':'message-input';
var inp=document.getElementById(inputId);
if(!inp)throw new Error('حقل الإدخال غير موجود');

// أضف التوكن حسب النوع
var token;
if(type==='image'){
token='[img:'+url+']';
}else if(type==='video'){
token='[video:'+url+']';
}else{
token='[audio:'+url+']';
}

var cur=inp.value;
inp.value=(cur?cur+' ':'')+token+' ';
try{inp.focus();}catch(e){}

if(typeof showToast==='function')showToast('fa-check','✅ تم الرفع — اضغط إرسال');
}catch(err){
console.error('Upload failed:',err);
if(typeof showToast==='function')showToast('fa-times','⚠️ '+(err.message||'فشل الرفع'));
}
};

// أضف الزر في أول input-area
inputArea.insertBefore(btn,inputArea.firstChild);
console.log('✅ upload-button v1: added');
clearInterval(t);
},500);

// إن لم يظهر input-area بعد 30 ثانية
setTimeout(function(){clearInterval(t);},30000);
})();
