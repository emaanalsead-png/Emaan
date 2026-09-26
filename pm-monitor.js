// ==============================================
// pm-monitor.js v4 — الملك يرى الأرشيف + الحديث
// ==============================================
// ✅ v4:
//   1. الملك يرى الرسائل الحديثة (user_private_messages)
//   2. الملك يرى الأرشيف (private_archive)
//   3. زر تبديل بين الحديث والأرشيف
//   4. حذف الأرشيف يدوياً
// ==============================================

(function(){
'use strict';
if(window.__pmMonitorV4)return;
window.__pmMonitorV4=true;

var PM={
currentMember:null,
currentOther:null,
screen:'members',
membersCache:[],
viewMode:'recent' /* 'recent' | 'archive' */
};

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
try{return JSON.parse(localStorage.getItem('qamar_current_user')||'null');}catch(e){}
return null;
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

function timeAgo(ts){
if(!ts)return '';
var s=Math.floor((Date.now()-ts)/1000);
if(s<60)return 'الآن';
var m=Math.floor(s/60);if(m<60)return 'قبل '+m+'د';
var h=Math.floor(m/60);if(h<24)return 'قبل '+h+'س';
return 'قبل '+Math.floor(h/24)+'ي';
}

function fmtTime(ts){
if(!ts)return '—';
try{
return new Date(ts).toLocaleString('ar-EG',{
year:'numeric',month:'2-digit',day:'2-digit',
hour:'2-digit',minute:'2-digit'
});
}catch(e){return '—';}
}

function toast(icon,msg){
if(typeof showToast==='function')showToast(icon,msg);
}

function logAudit(type,data){
try{
var me=getMe();
db.ref('audit_log').push(Object.assign({
type:type,
byUid:me?me.uid:null,
byName:me?me.name:'King',
at:firebase.database.ServerValue.TIMESTAMP
},data||{})).catch(function(){});
}catch(e){}
}

/* ═══ Modal ═══ */
function ensureModal(){
var m=document.getElementById('pm-monitor-modal');
if(m)return m;

m=document.createElement('div');
m.id='pm-monitor-modal';
m.innerHTML=
'<div id="pmm-box">'+
'<div id="pmm-header">'+
'<h3>'+
'<button id="pmm-back" class="pmm-back-btn" type="button">← رجوع</button>'+
'<span id="pmm-title">💬 مراقبة المحادثات</span>'+
'</h3>'+
'<button id="pmm-close" type="button">✕</button>'+
'</div>'+
'<div id="pmm-search-wrap">'+
'<input type="text" id="pmm-search" placeholder="🔍 بحث بالاسم أو الكود..." autocomplete="off">'+
'</div>'+
'<div id="pmm-actionbar" class="pmm-actionbar" style="display:none;"></div>'+
'<div id="pmm-modebar" style="display:none;padding:8px 10px;border-bottom:1px solid rgba(168,85,247,0.2);">'+
'<button id="pmm-mode-recent" class="pmm-mode-btn active" type="button">📨 الحديث</button>'+
'<button id="pmm-mode-archive" class="pmm-mode-btn" type="button">📦 الأرشيف</button>'+
'</div>'+
'<div id="pmm-body"></div>'+
'</div>';

document.body.appendChild(m);

/* CSS */
if(!document.getElementById('pmm-v4-css')){
var s=document.createElement('style');
s.id='pmm-v4-css';
s.textContent=
'#pm-monitor-modal{position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(6px);z-index:9999999;display:none;justify-content:center;align-items:center;direction:rtl;font-family:Cairo,sans-serif;padding:10px;}'+
'#pm-monitor-modal.active{display:flex;}'+
'#pmm-box{background:#0a0616;border:2px solid #a855f7;border-radius:18px;width:100%;max-width:540px;height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.9),0 0 40px rgba(168,85,247,0.4);}'+
'#pmm-header{padding:14px;border-bottom:1px solid rgba(168,85,247,0.3);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(168,85,247,0.1));flex-shrink:0;}'+
'#pmm-header h3{color:#c084fc;margin:0;font-size:15px;font-weight:900;display:flex;align-items:center;gap:8px;}'+
'#pmm-back{background:rgba(255,255,255,0.08);border:1px solid rgba(168,85,247,0.3);color:#c084fc;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;display:none;}'+
'#pmm-back.show{display:inline-block;}'+
'#pmm-close{background:rgba(255,68,68,0.2);border:1px solid rgba(255,68,68,0.5);color:#ff7777;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;font-weight:900;padding:0;}'+
'#pmm-search-wrap{padding:10px;border-bottom:1px solid rgba(168,85,247,0.2);flex-shrink:0;}'+
'#pmm-search{width:100%;padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(168,85,247,0.4);border-radius:10px;color:#fff;font-family:inherit;font-size:13px;outline:none;text-align:right;box-sizing:border-box;}'+
'#pmm-search:focus{border-color:#c084fc;}'+
'.pmm-mode-btn{flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(168,85,247,0.3);color:#aaa;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer;border-radius:10px;}'+
'.pmm-mode-btn.active{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-color:#c084fc;}'+
'#pmm-modebar{display:flex;gap:8px;}'+
'#pmm-body{flex:1;overflow-y:auto;padding:10px;}'+
'.pmm-row{display:flex;align-items:center;gap:10px;padding:10px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:10px;margin-bottom:8px;cursor:pointer;}'+
'.pmm-row:hover{background:rgba(168,85,247,0.15);}'+
'.pmm-row img{width:42px;height:42px;border-radius:50%;border:2px solid #a855f7;object-fit:cover;flex-shrink:0;background:#333;}'+
'.pmm-row-info{flex:1;min-width:0;}'+
'.pmm-row-name{color:#fff;font-weight:900;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
'.pmm-row-sub{color:#888;font-size:10px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
'.pmm-row-badge-del{color:#ff7777;font-size:10px;font-weight:900;margin-top:2px;}'+
'.pmm-loading{text-align:center;color:#c084fc;padding:30px;font-size:13px;}'+
'.pmm-empty{text-align:center;color:#666;padding:30px;font-size:12px;}'+
'.pmm-msg{padding:10px 12px;border-radius:10px;margin-bottom:8px;max-width:90%;position:relative;word-break:break-word;font-size:12px;line-height:1.5;}'+
'.pmm-msg.sent{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;margin-left:auto;}'+
'.pmm-msg.received{background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.1);margin-right:auto;}'+
'.pmm-msg.deleted{background:rgba(239,68,68,0.15) !important;border:1px solid rgba(239,68,68,0.5) !important;color:#ffcccc !important;}'+
'.pmm-msg-meta{font-size:9px;opacity:0.8;margin-bottom:4px;font-weight:900;}'+
'.pmm-msg-time{font-size:9px;opacity:0.65;margin-top:5px;}'+
'.pmm-msg-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}'+
'.pmm-btn-sm{padding:5px 10px;border-radius:6px;border:none;font-family:inherit;font-size:10px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:4px;}'+
'.pmm-btn-sm.restore{background:rgba(34,197,94,0.25);color:#4ade80;border:1px solid rgba(34,197,94,0.6);}'+
'.pmm-btn-sm.delete{background:rgba(239,68,68,0.25);color:#ff7777;border:1px solid rgba(239,68,68,0.6);}'+
'.pmm-stats{display:flex;gap:8px;padding:8px 10px;background:rgba(168,85,247,0.08);border-radius:8px;margin-bottom:10px;font-size:11px;font-weight:900;justify-content:center;flex-wrap:wrap;}'+
'.pmm-stats span{color:#c084fc;}'+
'.pmm-stats .s-del{color:#ff7777;}'+
'.pmm-stats .s-act{color:#4ade80;}'+
'.pmm-actionbar{display:flex;gap:6px;padding:10px;border-bottom:1px solid rgba(168,85,247,0.2);flex-shrink:0;background:rgba(0,0,0,0.3);flex-wrap:wrap;}'+
'.pmm-actionbar button{flex:1;min-width:120px;padding:10px;border-radius:10px;border:none;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer;}'+
'.pmm-actionbar .ab-del-deleted{background:rgba(255,152,0,0.2);border:1px solid rgba(255,152,0,0.6);color:#ffbb66;}'+
'.pmm-actionbar .ab-del-all{background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.6);color:#ff7777;}'+
'.pmm-actionbar .ab-del-archive{background:rgba(168,85,247,0.2);border:1px solid rgba(168,85,247,0.6);color:#c084fc;}';
document.head.appendChild(s);
}

m.querySelector('#pmm-close').onclick=close;
m.querySelector('#pmm-back').onclick=function(){
if(PM.screen==='messages')showConversations(PM.currentMember);
else if(PM.screen==='conversations')showMembers();
};

return m;
}

function showModal(){
var m=ensureModal();
m.classList.add('active');
}

function close(){
var m=document.getElementById('pm-monitor-modal');
if(m)m.classList.remove('active');
PM.currentMember=null;
PM.currentOther=null;
PM.screen='members';
PM.membersCache=[];
PM.viewMode='recent';
}

function setTitle(t){
var el=document.getElementById('pmm-title');
if(el)el.textContent=t;
}

function setBackVisible(show){
var b=document.getElementById('pmm-back');
if(b){if(show)b.classList.add('show');else b.classList.remove('show');}
}

function setSearchVisible(show,placeholder){
var w=document.getElementById('pmm-search-wrap');
var s=document.getElementById('pmm-search');
if(w)w.style.display=show?'block':'none';
if(s){s.value='';if(placeholder)s.placeholder=placeholder;}
}

function setActionBar(html){
var ab=document.getElementById('pmm-actionbar');
if(!ab)return;
if(html){ab.innerHTML=html;ab.style.display='flex';}
else{ab.innerHTML='';ab.style.display='none';}
}

function setModeBar(show){
var mb=document.getElementById('pmm-modebar');
if(mb)mb.style.display=show?'flex':'none';
}

/* ═══ أعضاء ═══ */
async function showMembers(){
if(!isKing()){toast('fa-lock','للملك فقط');close();return;}

PM.screen='members';
PM.currentMember=null;
PM.currentOther=null;
setTitle('💬 مراقبة المحادثات');
setBackVisible(false);
setActionBar(null);
setSearchVisible(true,'🔍 بحث بالاسم أو الكود...');
setModeBar(false);

var body=document.getElementById('pmm-body');
body.innerHTML='<div class="pmm-loading">⏳ جاري التحميل...</div>';

try{
var snap=await db.ref('users').limitToLast(500).once('value');
var all=snap.val()||{};
var users=Object.keys(all).map(function(uid){
var u=all[uid]||{};
u.uid=uid;
return u;
}).filter(function(u){return !u.isBot;});

users.sort(function(a,b){return (b.lastSeen||0)-(a.lastSeen||0);});
PM.membersCache=users;
renderMembers('');
}catch(e){
console.error('showMembers error:',e);
body.innerHTML='<div class="pmm-empty">⚠️ فشل التحميل: '+esc(e.message)+'</div>';
}

var search=document.getElementById('pmm-search');
if(search&&!search.__bound){
search.__bound=true;
search.oninput=function(){
if(PM.screen==='members')renderMembers(this.value.trim());
};
}
}

function renderMembers(query){
var body=document.getElementById('pmm-body');
if(!body)return;

var users=PM.membersCache||[];
if(query){
var q=query.toLowerCase();
users=users.filter(function(u){
var name=(u.name||'').toLowerCase();
var code=(u.code||'').toLowerCase();
return name.indexOf(q)!==-1||code.indexOf(q)!==-1;
});
}

body.innerHTML='';
var cnt=document.createElement('div');
cnt.style.cssText='text-align:center;color:#a855f7;font-size:11px;font-weight:900;padding:6px 0 10px;';
cnt.textContent='👥 '+users.length+' عضو';
body.appendChild(cnt);

if(!users.length){
body.innerHTML+='<div class="pmm-empty">لا يوجد أعضاء</div>';
return;
}

users.forEach(function(u){
var row=document.createElement('div');
row.className='pmm-row';

var img=document.createElement('img');
img.src=u.avatar||'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name||'U')+'&background=333&color=fff';
img.onerror=function(){this.src='https://ui-avatars.com/api/?name=U&background=333&color=fff';};

var info=document.createElement('div');
info.className='pmm-row-info';
info.innerHTML=
'<div class="pmm-row-name">'+esc(u.name||'مجهول')+'</div>'+
'<div class="pmm-row-sub">'+esc(u.code||'—')+' · '+timeAgo(u.lastSeen)+'</div>';

row.appendChild(img);
row.appendChild(info);
row.onclick=function(){showConversations(u);};
body.appendChild(row);
});
}

/* ═══ محادثات ═══ */
async function showConversations(member){
if(!isKing()){toast('fa-lock','للملك فقط');return;}
if(!member||!member.uid)return;

PM.screen='conversations';
PM.currentMember=member;
PM.currentOther=null;

setTitle('📨 محادثات: '+(member.name||''));
setBackVisible(true);
setActionBar(null);
setSearchVisible(false);
setModeBar(false);

var body=document.getElementById('pmm-body');
body.innerHTML='<div class="pmm-loading">⏳ جاري التحميل...</div>';

try{
var [recentSnap, archiveSnap]=await Promise.all([
db.ref('user_private_messages/'+member.uid).once('value'),
db.ref('private_archive/'+member.uid).once('value').catch(function(){return null;})
]);

var recent=recentSnap.val()||{};
var archive=archiveSnap?archiveSnap.val():{};

/* اجمع كل otherUids */
var allOthers={};
Object.keys(recent).forEach(function(k){allOthers[k]=true;});
Object.keys(archive).forEach(function(k){allOthers[k]=true;});
var otherUids=Object.keys(allOthers);

body.innerHTML='';

if(!otherUids.length){
body.innerHTML='<div class="pmm-empty">لا توجد محادثات لهذا العضو</div>';
return;
}

/* احسب stats لكل محادثة */
var rows=[];
for(var i=0;i<otherUids.length;i++){
var otherUid=otherUids[i];
var rMsgs=recent[otherUid]||{};
var aMsgs=archive[otherUid]||{};

var rKeys=Object.keys(rMsgs);
var aKeys=Object.keys(aMsgs);
var deletedCount=0;
var lastTime=0;
var lastText='';

rKeys.forEach(function(k){
var m=rMsgs[k]||{};
if(m.deleted===true)deletedCount++;
if((m.time||0)>lastTime){lastTime=m.time||0;lastText=m.deleted?'🚫 محذوفة':(m.text||'📎 مرفق');}
});
aKeys.forEach(function(k){
var m=aMsgs[k]||{};
if((m.time||0)>lastTime){lastTime=m.time||0;lastText='📦 '+(m.deleted?'[محذوفة]':(m.text||'📎 مرفق'));}
});

/* اسم ورقم */
var otherName='مجهول';
var otherAvatar='https://ui-avatars.com/api/?name=U&background=333&color=fff';
if(otherUid==='bot_guardian'){
otherName='🚔 السجان';
otherAvatar='https://ui-avatars.com/api/?name='+encodeURIComponent('السجان')+'&background=111&color=ff4444&bold=true&size=64';
}else{
try{
var uSnap=await db.ref('users/'+otherUid).once('value');
var u=uSnap.val()||{};
otherName=u.name||'مجهول';
otherAvatar=u.avatar||otherAvatar;
}catch(e){}
}

rows.push({
otherUid:otherUid,
otherName:otherName,
otherAvatar:otherAvatar,
recentCount:rKeys.length,
archiveCount:aKeys.length,
deletedCount:deletedCount,
lastTime:lastTime,
lastText:lastText
});
}

rows.sort(function(a,b){return (b.lastTime||0)-(a.lastTime||0);});

rows.forEach(function(r){
var row=document.createElement('div');
row.className='pmm-row';

var img=document.createElement('img');
img.src=r.otherAvatar;

var info=document.createElement('div');
info.className='pmm-row-info';

var archiveBadge=r.archiveCount>0?'<div style="color:#c084fc;font-size:10px;font-weight:900;margin-top:2px;">📦 '+r.archiveCount+' مؤرشف</div>':'';

info.innerHTML=
'<div class="pmm-row-name">'+esc(r.otherName)+'</div>'+
'<div class="pmm-row-sub">'+esc(r.lastText)+'</div>'+
'<div style="display:flex;gap:8px;font-size:10px;margin-top:3px;">'+
'<span style="color:#4ade80;">📨 '+r.recentCount+'</span>'+
(r.archiveCount>0?'<span style="color:#c084fc;">📦 '+r.archiveCount+'</span>':'')+
(r.deletedCount>0?'<span style="color:#ff7777;">🚫 '+r.deletedCount+'</span>':'')+
'</div>';

var cnt=document.createElement('div');
cnt.style.cssText='color:#c084fc;font-size:10px;font-weight:900;flex-shrink:0;text-align:left;';
cnt.innerHTML=timeAgo(r.lastTime);

row.appendChild(img);
row.appendChild(info);
row.appendChild(cnt);
row.onclick=function(){showMessages(PM.currentMember, r);};
body.appendChild(row);
});

}catch(e){
console.error('showConversations error:',e);
body.innerHTML='<div class="pmm-empty">⚠️ فشل: '+esc(e.message)+'</div>';
}
}

/* ═══ الرسائل ═══ */
async function showMessages(member, other){
if(!isKing()){toast('fa-lock','للملك فقط');return;}
if(!member||!other)return;

PM.screen='messages';
PM.currentOther=other;
PM.viewMode='recent';

setTitle('💬 '+(member.name||'')+' ↔ '+(other.otherName||''));
setBackVisible(true);
setSearchVisible(false);
setModeBar(true);

/* تحديث أزرار الوضع */
setTimeout(function(){
var btnRecent=document.getElementById('pmm-mode-recent');
var btnArchive=document.getElementById('pmm-mode-archive');
if(btnRecent&&!btnRecent.__bound){
btnRecent.__bound=true;
btnRecent.onclick=function(){
PM.viewMode='recent';
btnRecent.classList.add('active');
btnArchive.classList.remove('active');
renderMessages();
};
}
if(btnArchive&&!btnArchive.__bound){
btnArchive.__bound=true;
btnArchive.onclick=function(){
PM.viewMode='archive';
btnArchive.classList.add('active');
btnRecent.classList.remove('active');
renderMessages();
};
}
btnRecent.classList.add('active');
btnArchive.classList.remove('active');
if(other.archiveCount>0){
btnArchive.textContent='📦 الأرشيف ('+other.archiveCount+')';
}else{
btnArchive.textContent='📦 الأرشيف';
}
},50);

renderMessages();
}

async function renderMessages(){
var body=document.getElementById('pmm-body');
if(!body)return;

var member=PM.currentMember;
var other=PM.currentOther;
if(!member||!other)return;

body.innerHTML='<div class="pmm-loading">⏳ جاري التحميل...</div>';

try{
var path = PM.viewMode==='archive' ? 'private_archive' : 'user_private_messages';
var snap=await db.ref(path+'/'+member.uid+'/'+other.otherUid).once('value');
var msgs=snap.val()||{};

var arr=Object.keys(msgs).map(function(k){
var m=msgs[k];
m._key=k;
return m;
}).sort(function(a,b){
var ta=(typeof a.time==='number')?a.time:0;
var tb=(typeof b.time==='number')?b.time:0;
if(ta!==tb)return ta-tb;
return (a._key<b._key)?-1:1;
});

body.innerHTML='';

/* Action bar */
if(PM.viewMode==='recent'){
setActionBar(
'<button class="ab-del-deleted" id="pmm-ab-del-deleted">🗑️ حذف كل المحذوفات</button>'+
'<button class="ab-del-all" id="pmm-ab-del-all">☠️ حذف المحادثة كاملة</button>'
);
}else{
setActionBar(
'<button class="ab-del-archive" id="pmm-ab-del-archive">🗑️ حذف كل الأرشيف</button>'
);
}

setTimeout(function(){
var bd=document.getElementById('pmm-ab-del-deleted');
var ba=document.getElementById('pmm-ab-del-all');
var barc=document.getElementById('pmm-ab-del-archive');
if(bd)bd.onclick=function(){deleteAllDeleted(member,other);};
if(ba)ba.onclick=function(){deleteFullConversation(member,other);};
if(barc)barc.onclick=function(){deleteArchive(member,other);};
},30);

/* Stats */
var delCount=arr.filter(function(m){return m.deleted===true;}).length;
var activeCount=arr.length-delCount;
var stats=document.createElement('div');
stats.className='pmm-stats';
stats.innerHTML=
'<span>'+(PM.viewMode==='archive'?'📦 أرشيف':'📨')+' '+arr.length+' رسالة</span>'+
'<span class="s-act">✅ '+activeCount+' نشطة</span>'+
'<span class="s-del">🚫 '+delCount+' محذوفة</span>';
body.appendChild(stats);

if(!arr.length){
body.innerHTML+='<div class="pmm-empty">'+(PM.viewMode==='archive'?'الأرشيف فارغ':'لا توجد رسائل')+'</div>';
return;
}

arr.forEach(function(m){
var el=buildMessageEl(member,other,m);
body.appendChild(el);
});

}catch(e){
console.error('renderMessages error:',e);
body.innerHTML='<div class="pmm-empty">⚠️ فشل: '+esc(e.message)+'</div>';
}
}

function buildMessageEl(member, other, m){
var isDeleted=m.deleted===true;
var hasOriginal=isDeleted&&(!!m.originalText||!!m.originalAttachment);
var displayText=isDeleted
?(m.originalText||'[النص الأصلي غير محفوظ]')
:(m.text||'');
var displayAtt=isDeleted
?(m.originalAttachment||null)
:(m.attachment||null);

var fromMember=m.fromUid===member.uid;

var el=document.createElement('div');
el.className='pmm-msg '+(fromMember?'sent':'received')+(isDeleted?' deleted':'');

var meta=document.createElement('div');
meta.className='pmm-msg-meta';
meta.textContent=(fromMember?(member.name||'—'):(other.otherName||'—'));
el.appendChild(meta);

if(displayText){
var t=document.createElement('div');
t.style.cssText='word-break:break-word;';
if(isDeleted){
t.style.textDecoration='line-through';
t.style.textDecorationColor='rgba(255,68,68,0.6)';
}
t.textContent=displayText;
el.appendChild(t);
}

if(displayAtt&&displayAtt.url){
var att=document.createElement('div');
att.className='pmm-msg-attach';
var type=displayAtt.type||'image';
if(type==='image'){
var im=document.createElement('img');
im.src=displayAtt.url;
im.loading='lazy';
im.style.cssText='max-width:100%;max-height:200px;border-radius:8px;margin-top:6px;display:block;';
im.onclick=function(){window.open(displayAtt.url,'_blank');};
att.appendChild(im);
}else if(type==='video'){
var vi=document.createElement('video');
vi.src=displayAtt.url;
vi.controls=true;
vi.style.cssText='max-width:100%;max-height:200px;border-radius:8px;margin-top:6px;display:block;';
att.appendChild(vi);
}else if(type==='audio'){
var au=document.createElement('audio');
au.src=displayAtt.url;
au.controls=true;
au.style.cssText='width:100%;max-width:240px;margin-top:6px;';
att.appendChild(au);
}
el.appendChild(att);
}

if(isDeleted){
var badge=document.createElement('div');
badge.style.cssText='color:#ff8888;font-size:9px;font-weight:900;margin-top:4px;';
badge.textContent=hasOriginal?'🚫 محذوفة — بحوزتك نسخة':'🚫 محذوفة — لا نسخة';
el.appendChild(badge);
}

var tm=document.createElement('div');
tm.className='pmm-msg-time';
tm.textContent=fmtTime(m.time);
el.appendChild(tm);

var actions=document.createElement('div');
actions.className='pmm-msg-actions';

if(isDeleted&&hasOriginal&&PM.viewMode==='recent'){
var rb=document.createElement('button');
rb.className='pmm-btn-sm restore';
rb.innerHTML='♻️ استرجاع';
rb.onclick=function(){restoreMessage(member,other,m._key);};
actions.appendChild(rb);
}

var db_=document.createElement('button');
db_.className='pmm-btn-sm delete';
db_.innerHTML='🗑️ حذف';
db_.onclick=function(){deleteMessage(member,other,m._key,isDeleted);};
actions.appendChild(db_);

el.appendChild(actions);

return el;
}

/* ═══ Actions ═══ */
async function restoreMessage(member,other,msgKey){
if(!isKing())return;
if(!confirm('♻️ استرجاع هذه الرسالة؟\n\nستظهر مرة أخرى للطرفين.'))return;

try{
var snap=await db.ref('user_private_messages/'+member.uid+'/'+other.otherUid+'/'+msgKey).once('value');
var m=snap.val()||{};
if(!m.originalText&&!m.originalAttachment){
alert('⚠️ لا توجد نسخة احتياطية.');
return;
}
var patch={
deleted:false,
text:m.originalText||'',
attachment:m.originalAttachment||null,
restoredAt:Date.now(),
restoredBy:'king'
};
await Promise.all([
db.ref('user_private_messages/'+member.uid+'/'+other.otherUid+'/'+msgKey).update(patch),
db.ref('user_private_messages/'+other.otherUid+'/'+member.uid+'/'+msgKey).update(patch)
]);
logAudit('pm_restore',{targetUid:member.uid,otherUid:other.otherUid,msgKey:msgKey});
toast('fa-check','✅ تم الاسترجاع');
renderMessages();
}catch(e){
alert('⚠️ فشل: '+e.message);
}
}

async function deleteMessage(member,other,msgKey,isDeleted){
if(!isKing())return;
var path=PM.viewMode==='archive'?'private_archive':'user_private_messages';
if(!confirm('🗑️ حذف هذه الرسالة نهائياً؟'))return;
try{
await db.ref(path+'/'+member.uid+'/'+other.otherUid+'/'+msgKey).remove();
if(PM.viewMode==='recent'){
await db.ref(path+'/'+other.otherUid+'/'+member.uid+'/'+msgKey).remove().catch(function(){});
}
logAudit('pm_delete_msg',{targetUid:member.uid,otherUid:other.otherUid,msgKey:msgKey,viewMode:PM.viewMode});
toast('fa-check','✅ تم الحذف');
renderMessages();
}catch(e){
toast('fa-times','⚠️ فشل: '+e.message);
}
}

async function deleteAllDeleted(member,other){
if(!isKing())return;
if(!confirm('🗑️ حذف كل الرسائل المحذوفة؟'))return;

try{
var snap=await db.ref('user_private_messages/'+member.uid+'/'+other.otherUid).once('value');
var msgs=snap.val()||{};
var toDel=Object.keys(msgs).filter(function(k){return msgs[k]&&msgs[k].deleted===true;});

if(!toDel.length){toast('fa-info-circle','لا توجد');return;}

var promises=[];
toDel.forEach(function(k){
promises.push(db.ref('user_private_messages/'+member.uid+'/'+other.otherUid+'/'+k).remove());
promises.push(db.ref('user_private_messages/'+other.otherUid+'/'+member.uid+'/'+k).remove());
});
await Promise.all(promises);
logAudit('pm_delete_all_deleted',{targetUid:member.uid,otherUid:other.otherUid,count:toDel.length});
toast('fa-check','✅ تم حذف '+toDel.length);
renderMessages();
}catch(e){
toast('fa-times','⚠️ فشل: '+e.message);
}
}

async function deleteFullConversation(member,other){
if(!isKing())return;
if(!confirm('☠️ حذف المحادثة كاملة؟\n\nلا يمكن التراجع!'))return;
if(prompt('اكتب كلمة: حذف')!=='حذف'){toast('fa-times','❌ أُلغي');return;}
try{
await Promise.all([
db.ref('user_private_messages/'+member.uid+'/'+other.otherUid).remove(),
db.ref('user_private_messages/'+other.otherUid+'/'+member.uid).remove(),
db.ref('user_private_chats/'+member.uid+'/'+other.otherUid).remove().catch(function(){}),
db.ref('user_private_chats/'+other.otherUid+'/'+member.uid).remove().catch(function(){}),
db.ref('private_archive/'+member.uid+'/'+other.otherUid).remove().catch(function(){}),
db.ref('private_archive/'+other.otherUid+'/'+member.uid).remove().catch(function(){}),
db.ref('pm_archive_index/'+member.uid+'/'+other.otherUid).remove().catch(function(){}),
db.ref('pm_archive_index/'+other.otherUid+'/'+member.uid).remove().catch(function(){})
]);
logAudit('pm_delete_full_conversation',{targetUid:member.uid,otherUid:other.otherUid});
toast('fa-check','✅ حُذفت');
showConversations(member);
}catch(e){
toast('fa-times','⚠️ فشل: '+e.message);
}
}

async function deleteArchive(member,other){
if(!isKing())return;
if(!confirm('🗑️ حذف كل الأرشيف لهذه المحادثة؟\n\nلا يمكن التراجع!'))return;
try{
await Promise.all([
db.ref('private_archive/'+member.uid+'/'+other.otherUid).remove(),
db.ref('private_archive/'+other.otherUid+'/'+member.uid).remove().catch(function(){}),
db.ref('pm_archive_index/'+member.uid+'/'+other.otherUid).remove().catch(function(){})
]);
logAudit('pm_delete_archive',{targetUid:member.uid,otherUid:other.otherUid});
toast('fa-check','✅ تم حذف الأرشيف');
showConversations(member);
}catch(e){
toast('fa-times','⚠️ فشل: '+e.message);
}
}

/* ═══ Public API ═══ */
function open(){
if(!isKing()){toast('fa-lock','للملك فقط');return;}
showModal();
showMembers();
}

async function openFor(targetUid){
if(!isKing()){toast('fa-lock','للملك فقط');return;}
if(!targetUid){toast('fa-times','⚠️');return;}

showModal();
var body=document.getElementById('pmm-body');
body.innerHTML='<div class="pmm-loading">⏳...</div>';
setTitle('📨 محادثات العضو');
setBackVisible(true);
setActionBar(null);
setSearchVisible(false);
setModeBar(false);

try{
var snap=await db.ref('users/'+targetUid).once('value');
var u=snap.val();
if(!u){body.innerHTML='<div class="pmm-empty">⚠️ غير موجود</div>';return;}
u.uid=targetUid;
showConversations(u);
}catch(e){
body.innerHTML='<div class="pmm-empty">⚠️ '+esc(e.message)+'</div>';
}
}

/* زر غرفة الملك */
function injectButton(){
if(!isKing())return;
var header=document.getElementById('kr-header');
if(!header)return;
if(document.getElementById('kr-pm-monitor-btn'))return;

var btn=document.createElement('button');
btn.id='kr-pm-monitor-btn';
btn.type='button';
btn.textContent='💬 المحادثات';
btn.style.cssText='background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;padding:8px 14px;border-radius:10px;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;margin-right:8px;box-shadow:0 4px 12px rgba(168,85,247,0.4);';
btn.onclick=open;

var exitBtn=document.getElementById('kr-exit-btn');
if(exitBtn&&exitBtn.parentNode){
exitBtn.parentNode.insertBefore(btn,exitBtn);
}else{
header.appendChild(btn);
}
}

setInterval(function(){
var krView=document.getElementById('king-room-view');
if(krView&&krView.classList.contains('active')){
injectButton();
}
},500);

window.PmMonitor={
open:open,
openFor:openFor,
close:close,
version:4
};

console.log('📨 pm-monitor.js v4 loaded — archive support');
})();
