// ==============================================
// guardian-inbox-reader.js v1 — قارئ guardian_inbox
// ==============================================
// الملك فقط — يحوّل رسائل guardian_inbox إلى PM السجان
// ==============================================

(function(){
'use strict';
if(window.__guardianInboxReaderV1)return;
window.__guardianInboxReaderV1=true;

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
try{return JSON.parse(localStorage.getItem('qamar_current_user')||'null');}catch(e){return null;}
}

function isKing(){
var u=getMe();
return !!(u&&u.rank==='King');
}

function startReader(){
var me=getMe();
if(!me||me.rank!=='King')return;
if(window.__guardianInboxActive)return;
window.__guardianInboxActive=true;

var processedKeys={};

db.ref('guardian_inbox/'+me.uid).limitToLast(20).on('child_added',async function(s){
var key=s.key;
if(processedKeys[key])return;
processedKeys[key]=true;

var a=s.val();
if(!a)return;

try{
// انقل إلى user_private_messages/bot_guardian
var msgKey=db.ref('user_private_messages/'+me.uid+'/bot_guardian').push().key;
await db.ref('user_private_messages/'+me.uid+'/bot_guardian/'+msgKey).set({
fromUid:'bot_guardian',
toUid:me.uid,
text:a.text||'',
time:a.at||Date.now(),
read:false,
deleted:false,
isGuardianCall:true,
guardianCallType:a.type||'multi_account'
});

// حدّث قائمة PM
await db.ref('user_private_chats/'+me.uid+'/bot_guardian').update({
otherUid:'bot_guardian',
otherName:'🚔 السجان',
otherAvatar:'https://ui-avatars.com/api/?name=' + encodeURIComponent('السجان') + '&background=111&color=ff4444&bold=true&size=64',
lastMessage:'🚨 محاولة حساب ثانٍ',
lastTime:Date.now()
});
db.ref('user_private_chats/'+me.uid+'/bot_guardian/unread').transaction(function(c){return (c||0)+1;});

// احذف من guardian_inbox
await db.ref('guardian_inbox/'+me.uid+'/'+key).remove();

// toast للملك
if(typeof showToast==='function')showToast('fa-shield','🚨 تنبيه أمني جديد — افتح الخاص');

console.log('📬 guardian_inbox: transferred message to PM');
}catch(e){console.warn('guardian_inbox transfer failed:',e);}
});

console.log('📬 guardian_inbox reader: active (King)');
}

function init(){
var attempts=0;
var t=setInterval(function(){
attempts++;
if(typeof db==='undefined'||!db){
if(attempts>=40)clearInterval(t);
return;
}
if(isKing()){
clearInterval(t);
setTimeout(startReader,1000);
}
if(attempts>=40)clearInterval(t);
},500);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

window.GuardianInboxReader={
start:startReader,
version:1
};

console.log('✅ guardian-inbox-reader.js v1 loaded');
})();
