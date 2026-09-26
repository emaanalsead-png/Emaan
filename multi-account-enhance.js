(function(){
'use strict';
if(window.__multiAccountEnhanceV1)return;
window.__multiAccountEnhanceV1=true;

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
try{return JSON.parse(localStorage.getItem('qamar_current_user')||'null');}catch(e){return null;}
}

function isKing(){
var u=getMe();
return !!(u&&u.rank==='King');
}

function esc(s){
if(s==null)return '';
return String(s).replace(/[&<>"']/g,function(c){
return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
});
}

function toast(i,m){if(typeof showToast==='function')showToast(i,m);}

// ═══════════════════════════════════════════════════════
// 1. حفظ بيانات المستخدم الكاملة في device_registry
// ═══════════════════════════════════════════════════════
async function saveUserToDeviceRegistry(uid,name,avatar){
if(!window.DeviceGuard)return;
var dgId=window.DeviceGuard.getDeviceId&&window.DeviceGuard.getDeviceId();
if(!dgId||!uid)return;
try{
await db.ref('device_registry/'+dgId+'/'+uid).update({
name:name||'مجهول',
avatar:avatar||'',
at:Date.now()
});
console.log('📝 device_registry: saved',uid.substring(0,8),name);
}catch(e){console.warn('save to device_registry failed:',e);}
}

// ═══════════════════════════════════════════════════════
// 2. حفظ الأسماء في multi_account_alerts
// ═══════════════════════════════════════════════════════
async function enrichMultiAccountAlert(alertKey,existingUids){
try{
var names=[];
for(var i=0;i<existingUids.length&&i<10;i++){
var uid=existingUids[i];
try{
var s=await db.ref('users/'+uid+'/name').once('value');
var av=await db.ref('users/'+uid+'/avatar').once('value');
names.push({
uid:uid,
name:s.val()||'مجهول',
avatar:av.val()||''
});
}catch(e){}
}
await db.ref('multi_account_alerts/'+alertKey+'/existingUsers').set(names);
console.log('📝 multi_account_alerts: enriched with',names.length,'users');
}catch(e){console.warn('enrich failed:',e);}
}

// ═══════════════════════════════════════════════════════
// 3. إشعار الملك بعدة قنوات
// ═══════════════════════════════════════════════════════
async function notifyKingMultiChannels(suspectUid,suspectName,deviceId,ip,existingUids){
try{
// جلب king_uid
var kingSnap=await db.ref('config/king_uid').once('value');
var kingUid=kingSnap.val();
if(!kingUid){
console.warn('⚠️ config/king_uid not set');
return;
}

// جلب أسماء الحسابات المطابقة
var names=[];
for(var i=0;i<existingUids.length&&i<5;i++){
try{
var n=await db.ref('users/'+existingUids[i]+'/name').once('value');
names.push({uid:existingUids[i],name:n.val()||'مجهول'});
}catch(e){}
}

var text='🚨 محاولة حساب ثانٍ من نفس الجهاز\n\n'+
'👤 الحساب الجديد: '+(suspectName||'مجهول')+'\n'+
'🆔 الجهاز: '+deviceId.substring(0,15)+'...\n'+
'🌐 الشبكة: '+(ip||'—')+'\n'+
'👥 حسابات موجودة: '+names.length+'\n'+
names.map(function(n){return '• '+n.name;}).join('\n')+'\n\n'+
'🕐 '+new Date().toLocaleString('ar-EG');

var now=Date.now();

// ─── القناة 1: user_notifications (مع icon pulse) ───
try{
await db.ref('user_notifications/'+kingUid).push({
fromUid:'bot_guardian',
fromName:'🚔 السجان',
fromAvatar:'',
type:'multi_account',
preview:'🚨 محاولة حساب ثانٍ: '+(suspectName||'مجهول'),
icon:'🚨',
urgent:true,
read:false,
time:now,
data:{
suspectUid:suspectUid,
suspectName:suspectName,
deviceId:deviceId,
ip:ip,
existingUids:existingUids
}
});
console.log('✅ user_notifications: sent to King');
}catch(e){console.warn('notif failed:',e);}

// ─── القناة 2: user_private_messages/bot_guardian ───
try{
var key=db.ref('user_private_messages/'+kingUid+'/bot_guardian').push().key;
await db.ref('user_private_messages/'+kingUid+'/bot_guardian/'+key).set({
fromUid:'bot_guardian',
toUid:kingUid,
text:text,
time:firebase.database.ServerValue.TIMESTAMP,
read:false,
deleted:false,
isGuardianCall:true,
guardianCallType:'multi_account',
suspectUid:suspectUid,
suspectName:suspectName,
deviceId:deviceId,
ip:ip,
existingUids:existingUids
});
await db.ref('user_private_chats/'+kingUid+'/bot_guardian').update({
otherUid:'bot_guardian',
otherName:'🚔 السجان',
otherAvatar:'https://ui-avatars.com/api/?name=' + encodeURIComponent('السجان') + '&background=111&color=ff4444&bold=true&size=64',
lastMessage:'🚨 محاولة حساب ثانٍ',
lastTime:now,
unread:(await db.ref('user_private_chats/'+kingUid+'/bot_guardian/unread').once('value')).val()+1
});
console.log('✅ PM from guardian: sent to King');
}catch(e){console.warn('PM failed:',e);}

// ─── القناة 3: audit_log ───
try{
await db.ref('audit_log').push({
type:'multi_account_alert',
byUid:'bot_guardian',
byName:'🚔 السجان',
suspectUid:suspectUid,
suspectName:suspectName,
deviceId:deviceId,
ip:ip,
existingUids:existingUids,
at:firebase.database.ServerValue.TIMESTAMP
});
}catch(e){}

}catch(e){console.warn('notifyKingMultiChannels failed:',e);}
}

// ═══════════════════════════════════════════════════════
// 4. اعتراض _handleMultiAccount الأصلي
// ═══════════════════════════════════════════════════════
function hookMultiAccountHandler(){
if(!window.DeviceGuard)return false;
if(window.DeviceGuard.__enhanced)return true;

// اعتراض preCheck
var origPreCheck=window.DeviceGuard.preCheck;
window.DeviceGuard.preCheck=async function(){
var r=await origPreCheck.apply(this,arguments);
// إذا الجهاز محظور — لا تغيير
return r;
};

window.DeviceGuard.__enhanced=true;
console.log('✅ multi-account: hooked');
return true;
}

// ═══════════════════════════════════════════════════════
// 5. مراقب multi_account_alerts — لإرسال إشعارات فورية
// ═══════════════════════════════════════════════════════
function startMultiAccountWatcher(){
if(!isKing())return;
if(window.__maWatcherStarted)return;
window.__maWatcherStarted=true;

db.ref('multi_account_alerts').limitToLast(1).on('child_added',async function(s){
var a=s.val();
if(!a||!a.uid)return;
if(a._notified)return;

// إرسال إشعار للملك لو ما أُرسل
setTimeout(async function(){
await notifyKingMultiChannels(
a.uid,
a.name||'مجهول',
a.deviceId||'',
a.ip||'',
a.existingUids||[]
);
await db.ref('multi_account_alerts/'+s.key+'/_notified').set(true);
},500);
});

console.log('👁️ multi_account watcher: started (King only)');
}

// ═══════════════════════════════════════════════════════
// 6. حفظ المستخدم في device_registry عند كل دخول
// ═══════════════════════════════════════════════════════
function hookAfterAuth(){
if(typeof window.DeviceGuard==='undefined'||!window.DeviceGuard)return false;
if(window.DeviceGuard.__afterAuthEnhanced)return true;

var orig=window.DeviceGuard.afterAuth;
window.DeviceGuard.afterAuth=async function(uid,name){
// حفظ مسبق للمستخدم (حتى لو فشل لاحقاً)
var me=getMe();
if(me&&me.uid===uid){
await saveUserToDeviceRegistry(uid,me.name||name,me.avatar||'');
}
return orig.apply(this,arguments);
};

window.DeviceGuard.__afterAuthEnhanced=true;
console.log('✅ afterAuth: hooked for device_registry');
return true;
}

// ═══════════════════════════════════════════════════════
// 7. الانتظار والتشغيل
// ═══════════════════════════════════════════════════════
function init(){
var attempts=0;
var t=setInterval(function(){
attempts++;
if(typeof db==='undefined'||!db){
if(attempts>=60)clearInterval(t);
return;
}
var ok1=hookAfterAuth();
var ok2=hookMultiAccountHandler();

// بدء watcher فقط للملك
if(isKing())startMultiAccountWatcher();

if(ok1||attempts>=20){
clearInterval(t);
console.log('✅ multi-account-enhance: ready');
}
},500);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

window.MultiAccountEnhance={
saveUserToDeviceRegistry:saveUserToDeviceRegistry,
enrichAlert:enrichMultiAccountAlert,
notifyKing:notifyKingMultiChannels,
version:1
};

console.log('✅ multi-account-enhance.js v1 loaded');
})();
