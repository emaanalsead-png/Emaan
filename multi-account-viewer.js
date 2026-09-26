(function(){
'use strict';
if(window.__multiAccountViewerV1)return;
window.__multiAccountViewerV1=true;

function esc(s){
if(s==null)return '';
return String(s).replace(/[&<>"']/g,function(c){
return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
});
}

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
return null;
}

function isKing(){
var u=getMe();
return !!(u&&u.rank==='King');
}

function timeAgo(ts){
if(!ts)return '';
var s=Math.floor((Date.now()-ts)/1000);
if(s<60)return 'الآن';
var m=Math.floor(s/60);if(m<60)return 'قبل '+m+'د';
var h=Math.floor(m/60);if(h<24)return 'قبل '+h+'س';
return 'قبل '+Math.floor(h/24)+'ي';
}

// بديل renderMultiAccount — يعرض الحسابات المطابقة بأسماء
async function renderEnhancedMultiAccount(body){
if(!isKing()){body.innerHTML='<div class="kr-empty">للملك فقط</div>';return;}
body.innerHTML='<div class="kr-loading">⏳</div>';

try{
var s=await db.ref('multi_account_alerts').limitToLast(100).once('value');
var data=s.val()||{};
var alerts=Object.keys(data).map(function(k){
var a=data[k];a._id=k;return a;
}).sort(function(a,b){return (b.at||0)-(a.at||0);});

// فلترة
var filter=window._mavFilter||'pending';
var filtered=alerts;
if(filter==='pending')filtered=alerts.filter(function(a){return a.status!=='resolved';});
else if(filter==='resolved')filtered=alerts.filter(function(a){return a.status==='resolved';});

var h='<div class="kr-card">';
h+='<div class="kr-card-title">🚨 الحسابات المكرّرة</div>';
h+='<div style="color:#888;font-size:11px;margin-bottom:10px;">يتم الكشف تلقائياً عند محاولة تسجيل حساب ثانٍ من نفس الجهاز</div>';
h+='</div>';

h+='<div class="kr-filters">';
h+='<button class="kr-chip'+(filter==='pending'?' active':'')+'" data-mav="pending">🆕 جديدة ('+alerts.filter(function(a){return a.status!=='resolved';}).length+')</button>';
h+='<button class="kr-chip'+(filter==='resolved'?' active':'')+'" data-mav="resolved">✅ معالَجة ('+alerts.filter(function(a){return a.status==='resolved';}).length+')</button>';
h+='</div>';
h+='<div id="kr-ma-list"></div>';
body.innerHTML=h;

body.querySelectorAll('[data-mav]').forEach(function(c){
c.onclick=function(){
window._mavFilter=c.getAttribute('data-mav');
renderEnhancedMultiAccount(body);
};
});

var listEl=document.getElementById('kr-ma-list');
if(!filtered.length){
listEl.innerHTML='<div style="text-align:center;color:#888;padding:20px;font-size:12px;">لا توجد تنبيهات</div>';
return;
}

// لكل تنبيه — بطاقة كاملة
for(var i=0;i<filtered.length;i++){
var a=filtered[i];
var card=await buildAlertCard(a);
listEl.appendChild(card);
}

}catch(e){
console.error('renderEnhancedMultiAccount:',e);
body.innerHTML='<div class="kr-empty">❌ '+esc(e.message)+'</div>';
}
}

// بطاقة تنبيه كاملة
async function buildAlertCard(a){
var card=document.createElement('div');
card.className='kr-card';
card.style.cssText='padding:14px;margin-bottom:10px;border-color:rgba(255,68,68,0.4);background:linear-gradient(135deg,rgba(120,0,0,0.15),rgba(0,0,0,0.3));';

var isResolved=a.status==='resolved';

// جلب الحسابات المطابقة
var existingUids=a.existingUids||[];
if(typeof existingUids==='object'&&!Array.isArray(existingUids)){
existingUids=Object.keys(existingUids);
}

// جلب الأسماء + الصور
var existingUsers=[];
for(var i=0;i<existingUids.length&&i<10;i++){
var uid=existingUids[i];
try{
var s=await db.ref('users/'+uid).once('value');
var u=s.val()||{};
existingUsers.push({
uid:uid,
name:u.name||'مجهول',
avatar:u.avatar||'',
rank:u.rank||'User'
});
}catch(e){
existingUsers.push({uid:uid,name:'مجهول',avatar:''});
}
}

// جلب بيانات الحساب الجديد
var suspectName=a.name||'مجهول';
var suspectAvatar='';
try{
var ss=await db.ref('users/'+(a.uid||'')+'/avatar').once('value');
suspectAvatar=ss.val()||'';
}catch(e){}

var h='';
h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
h+='<div style="color:'+(isResolved?'#84cc16':'#ff6666')+';font-weight:900;font-size:13px;">'+(isResolved?'✅ مُعالَج':'🚨 محاولة مكرّرة')+'</div>';
h+='<div style="color:#888;font-size:10px;">'+timeAgo(a.at)+'</div>';
h+='</div>';

// الحساب الجديد
h+='<div style="padding:10px;background:rgba(255,68,68,0.15);border-radius:10px;margin-bottom:10px;border:1px solid rgba(255,68,68,0.3);">';
h+='<div style="color:#ff9999;font-size:10px;font-weight:900;margin-bottom:6px;">🆕 الحساب المُحاوِل</div>';
h+='<div style="display:flex;align-items:center;gap:10px;">';
h+='<img src="'+esc(suspectAvatar||'https://ui-avatars.com/api/?name=U&background=555&color=fff')+'" style="width:40px;height:40px;border-radius:50%;border:2px solid #ff4444;object-fit:cover;">';
h+='<div style="flex:1;min-width:0;">';
h+='<div style="color:#fff;font-weight:900;font-size:13px;">'+esc(suspectName)+'</div>';
h+='<div style="color:#ff8888;font-size:10px;">'+esc((a.uid||'').substring(0,16))+'...</div>';
h+='</div>';
h+='<button class="kr-btn kr-btn-outline kr-btn-sm" data-view-suspect="'+esc(a.uid||'')+'">👤 عرض</button>';
h+='</div></div>';

// الجهاز + الشبكة
h+='<div style="background:rgba(0,0,0,0.4);border-radius:10px;padding:10px;font-size:11px;line-height:1.8;margin-bottom:10px;">';
h+='<div style="color:#aaa;"><b>📱 الجهاز:</b> '+esc((a.deviceId||'—').substring(0,20))+'...</div>';
h+='<div style="color:#aaa;"><b>🌐 الشبكة:</b> '+esc(a.ip||'—')+'</div>';
h+='</div>';

// الحسابات المطابقة بالأسماء
if(existingUsers.length>0){
h+='<div style="margin-bottom:10px;">';
h+='<div style="color:#ffbb66;font-size:11px;font-weight:900;margin-bottom:8px;">👥 الحسابات الموجودة على نفس الجهاز ('+existingUsers.length+')</div>';
existingUsers.forEach(function(u){
h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:8px;margin-bottom:5px;">';
h+='<img src="'+esc(u.avatar||'https://ui-avatars.com/api/?name=U&background=333&color=fff')+'" style="width:32px;height:32px;border-radius:50%;border:2px solid #ff9800;object-fit:cover;">';
h+='<div style="flex:1;min-width:0;">';
h+='<div style="color:#fff;font-weight:900;font-size:12px;">'+esc(u.name)+'</div>';
h+='<div style="color:#ffbb66;font-size:9px;">'+esc(u.uid.substring(0,16))+'...</div>';
h+='</div>';
h+='<button class="kr-btn kr-btn-outline kr-btn-sm" data-view-existing="'+esc(u.uid)+'" style="padding:4px 8px;font-size:10px;">👤</button>';
h+='</div>';
});
h+='</div>';
}

// الأزرار
if(!isResolved){
h+='<div style="display:flex;gap:6px;flex-wrap:wrap;">';
h+='<button class="kr-btn kr-btn-red kr-btn-sm" data-ban-device="'+esc(a._id)+'" data-uid="'+esc(a.uid||'')+'" style="flex:1;min-width:120px;">🛡️ حظر الجهاز + IP</button>';
h+='<button class="kr-btn kr-btn-outline kr-btn-sm" data-resolve="'+esc(a._id)+'" style="flex:1;min-width:100px;">✅ معالجة</button>';
h+='<button class="kr-btn kr-btn-outline kr-btn-sm" data-delete="'+esc(a._id)+'" style="padding:6px 12px;">🗑️</button>';
h+='</div>';
}else{
h+='<div style="color:#84cc16;font-size:11px;font-weight:900;padding:8px;text-align:center;">✅ تمت المعالجة ('+esc(a.resolvedAction||'admin')+')</div>';
}

card.innerHTML=h;

// ربط الأزرار
card.querySelectorAll('[data-view-suspect],[data-view-existing]').forEach(function(b){
b.onclick=function(){
var uid=this.getAttribute('data-view-suspect')||this.getAttribute('data-view-existing');
if(uid&&typeof window.openUserProfile==='function'){
if(typeof closeRoom==='function')closeRoom();
setTimeout(function(){window.openUserProfile(uid,'');},200);
}
};
});

card.querySelectorAll('[data-ban-device]').forEach(function(b){
b.onclick=async function(){
if(!confirm('حظر جهاز + IP هذا الحساب؟'))return;
var alertId=this.getAttribute('data-ban-device');
var uid=this.getAttribute('data-uid');
try{
if(window.DeviceGuard&&typeof window.DeviceGuard.ban==='function'){
var me=getMe();
await window.DeviceGuard.ban(uid,me.uid,me.name||'King','multi_account');
await db.ref('multi_account_alerts/'+alertId).update({
status:'resolved',
resolvedAt:Date.now(),
resolvedBy:me.uid,
resolvedAction:'device_ban'
});
if(typeof showToast==='function')showToast('fa-check','🛡️ تم الحظر');
var body=document.getElementById('kr-body');
if(body)renderEnhancedMultiAccount(body);
}else{
if(typeof showToast==='function')showToast('fa-times','⚠️ DeviceGuard غير متاح');
}
}catch(e){
if(typeof showToast==='function')showToast('fa-times','⚠️ '+e.message);
}
};
});

card.querySelectorAll('[data-resolve]').forEach(function(b){
b.onclick=async function(){
var alertId=this.getAttribute('data-resolve');
var me=getMe();
try{
await db.ref('multi_account_alerts/'+alertId).update({
status:'resolved',
resolvedAt:Date.now(),
resolvedBy:me.uid,
resolvedAction:'manual'
});
if(typeof showToast==='function')showToast('fa-check','✅ تمت المعالجة');
var body=document.getElementById('kr-body');
if(body)renderEnhancedMultiAccount(body);
}catch(e){
if(typeof showToast==='function')showToast('fa-times','⚠️ '+e.message);
}
};
});

card.querySelectorAll('[data-delete]').forEach(function(b){
b.onclick=async function(){
if(!confirm('حذف هذا التنبيه؟'))return;
var alertId=this.getAttribute('data-delete');
try{
await db.ref('multi_account_alerts/'+alertId).remove();
if(typeof showToast==='function')showToast('fa-check','🗑️ حُذف');
var body=document.getElementById('kr-body');
if(body)renderEnhancedMultiAccount(body);
}catch(e){
if(typeof showToast==='function')showToast('fa-times','⚠️ '+e.message);
}
};
});

return card;
}

// ═══════════════════════════════════════════════════════
// اعتراض tab injection
// ═══════════════════════════════════════════════════════
function patchKingRoomTabs(){
if(!isKing())return;
if(window.__maViewerPatched)return;

// انتظر KingRoom ثم اعترض renderMultiAccount
var attempts=0;
var t=setInterval(function(){
attempts++;
if(typeof window.__krSetTab!=='function'&&!document.getElementById('king-room-view')){
if(attempts>=40)clearInterval(t);
return;
}

// override renderTab لجعل multiAccount يستخدم الكود الجديد
if(typeof window.KingRoom==='object'&&!window.KingRoom.__mavPatched){
window.KingRoom.__mavPatched=true;
}
clearInterval(t);
},500);
}

// استبدال renderMultiAccount في النطاق العام
function overrideRenderMultiAccount(){
// نحفظ الدالة الأصلية لو موجودة
// نضع النسخة الجديدة في النطاق العام
window.renderMultiAccount=function(body){
return renderEnhancedMultiAccount(body);
};
window._mavFilter='pending';
}

// تشغيل
function init(){
overrideRenderMultiAccount();
patchKingRoomTabs();
console.log('✅ multi-account-viewer: ready');
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

window.MultiAccountViewer={
render:renderEnhancedMultiAccount,
version:1
};

console.log('✅ multi-account-viewer.js v1 loaded');
})();
