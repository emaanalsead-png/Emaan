(function(){
'use strict';
if(window.__guestPersistFixV1)return;
window.__guestPersistFixV1=true;

// الهدف: منع انقطاع الزائر من التسجيل في device_registry
// عند فشل الدخول، الجهاز يُحفظ لكن الجلسة لا تُعلَّق

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
return null;
}

// خطاف على registerGuest — لحفظ دخول الزائر قبل أي عملية أخرى
function hookRegisterGuest(){
if(typeof window.registerGuest!=='function')return false;
if(window.registerGuest.__guestPersistHooked)return true;

var orig=window.registerGuest;
window.registerGuest=async function(name,age,gender){
// احفظ deviceId مبدئياً (قبل التسجيل)
try{
if(window.DeviceGuard&&typeof window.DeviceGuard.getDeviceId==='function'){
var dgId=window.DeviceGuard.getDeviceId();
if(dgId){
// علامة مؤقتة للزائر الجديد
await db.ref('device_registry/'+dgId+'/_pending_'+Date.now()).set({
name:name||'زائر',
pending:true,
at:Date.now()
}).catch(function(){});
}
}
}catch(e){}

var r=await orig.apply(this,arguments);

// بعد التسجيل — احفظ device_registry بشكل دائم
if(r&&r.success&&r.user){
try{
if(window.DeviceGuard&&typeof window.DeviceGuard.getDeviceId==='function'){
var dgId2=window.DeviceGuard.getDeviceId();
if(dgId2){
// امسح _pending_
var snap=await db.ref('device_registry/'+dgId2).once('value');
var data=snap.val()||{};
var updates={};
Object.keys(data).forEach(function(k){
if(k.indexOf('_pending_')===0)updates[k]=null;
});
if(Object.keys(updates).length>0){
await db.ref('device_registry/'+dgId2).update(updates);
}
// احفظ الزائر الحقيقي
await db.ref('device_registry/'+dgId2+'/'+r.user.uid).set({
name:r.user.name||name||'زائر',
avatar:r.user.avatar||'',
at:Date.now(),
isGuest:true
});
}
}
}catch(e){console.warn('guest persist failed:',e);}
}

return r;
};
window.registerGuest.__guestPersistHooked=true;
console.log('✅ guest-persist: registerGuest hooked');
return true;
}

// تشغيل
function init(){
var attempts=0;
var t=setInterval(function(){
attempts++;
if(typeof db==='undefined'||!db){
if(attempts>=40)clearInterval(t);
return;
}
if(hookRegisterGuest()){
clearInterval(t);
console.log('✅ guest-persist-fix: ready');
}
if(attempts>=40)clearInterval(t);
},500);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

console.log('✅ guest-persist-fix.js v1 loaded');
})();
