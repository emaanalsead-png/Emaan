(function(){
'use strict';
if(window.__pmArchiverV1)return;
window.__pmArchiverV1=true;

var KEEP_RECENT = 100;
var RUN_INTERVAL_MS = 6 * 60 * 60 * 1000;
var FIRST_RUN_DELAY_MS = 3 * 60 * 1000;
var LOCK_TTL_MS = 5 * 60 * 1000;
var BATCH_SIZE = 200;

function log(m){ console.log('📦 [PMArchiver] ' + m); }

function getMe(){
try{if(typeof getCurrentUser==='function')return getCurrentUser();}catch(e){}
try{return JSON.parse(localStorage.getItem('qamar_current_user')||'null');}catch(e){return null;}
}

async function _acquireLock(){
if(typeof db==='undefined'||!db)return false;
try{
var me=getMe()||{};
var r=await db.ref('system/pm_archiver_lock').transaction(function(cur){
var now=Date.now();
if(cur && (now-(cur.at||0))<LOCK_TTL_MS)return;
return {at:now,by:me.uid||'unknown'};
});
return r && r.committed===true;
}catch(e){return false;}
}

async function _releaseLock(){
if(typeof db==='undefined'||!db)return;
try{await db.ref('system/pm_archiver_lock').remove();}catch(e){}
}

async function _archiveConversation(uid1, uid2){
try{
var snap=await db.ref('user_private_messages/'+uid1+'/'+uid2).once('value');
if(!snap.exists())return {moved:0,total:0};

var data=snap.val()||{};
var keys=Object.keys(data);
var total=keys.length;

if(total<=KEEP_RECENT)return {moved:0,total:total};

var msgs=keys.map(function(k){
var m=data[k];
return {key:k,time:(typeof m.time==='number')?m.time:0};
}).sort(function(a,b){return a.time-b.time;});

var toArchive=msgs.slice(0, msgs.length - KEEP_RECENT);
if(toArchive.length===0)return {moved:0,total:total};

var archiveOps=[];
var deleteOps=[];

for(var i=0;i<toArchive.length;i+=BATCH_SIZE){
var batchEnd=Math.min(i+BATCH_SIZE, toArchive.length);
var archiveBatch={};
var deleteBatch={};
for(var j=i;j<batchEnd;j++){
var k=toArchive[j].key;
archiveBatch[k]=data[k];
deleteBatch[k]=null;
}
archiveOps.push(db.ref('private_archive/'+uid1+'/'+uid2).update(archiveBatch));
deleteOps.push(db.ref('user_private_messages/'+uid1+'/'+uid2).update(deleteBatch));
}

await Promise.all(archiveOps.concat(deleteOps));

try{
var statsSnap=await db.ref('private_archive/'+uid1+'/'+uid2).once('value');
var archCount=statsSnap.numChildren();
await db.ref('pm_archive_index/'+uid1+'/'+uid2).update({
count:archCount,
lastArchive:Date.now(),
keepRecent:KEEP_RECENT
});
}catch(e){}

return {moved:toArchive.length,total:total};
}catch(e){
return {moved:0,total:0,error:e.message};
}
}

async function _runCycle(){
log('start');

var usersSnap=await db.ref('user_private_messages').once('value');
if(!usersSnap.exists()){log('لا توجد محادثات');return {moved:0};}

var users=usersSnap.val()||{};
var uids=Object.keys(users);
var totalMoved=0;
var totalConv=0;

for(var i=0;i<uids.length;i++){
var uid1=uids[i];
var others=users[uid1]||{};
var otherUids=Object.keys(others);

for(var j=0;j<otherUids.length;j++){
var uid2=otherUids[j];
if(uid1 > uid2) continue;

var r1=await _archiveConversation(uid1, uid2);
totalMoved+=r1.moved;
if(r1.moved>0)totalConv++;

var r2=await _archiveConversation(uid2, uid1);
totalMoved+=r2.moved;
if(r2.moved>0)totalConv++;
}
}

log('done — moved '+totalMoved+' msgs across '+totalConv+' conversations');
return {moved:totalMoved,conv:totalConv};
}

async function runArchiver(){
var gotLock=await _acquireLock();
if(!gotLock){log('lock busy — skip');return;}

try{
var result=await _runCycle();

if(result.moved>0){
try{
var me=getMe()||{};
await db.ref('audit_log').push({
type:'pm_archive_cleanup',
byUid:me.uid||null,
byName:me.name||'system',
moved:result.moved,
conversations:result.conv,
at:firebase.database.ServerValue.TIMESTAMP
});
}catch(e){}
}
}catch(e){
console.warn('runArchiver error:',e);
}

await _releaseLock();
}

function _schedule(){
setTimeout(function(){
if(getMe())runArchiver();
}, FIRST_RUN_DELAY_MS);

setInterval(function(){
if(getMe())runArchiver();
}, RUN_INTERVAL_MS);
}

window.PMArchiver={
run:runArchiver,
version:1,
KEEP_RECENT:KEEP_RECENT
};

function init(){
var attempts=0;
var t=setInterval(function(){
attempts++;
if(typeof db!=='undefined'&&db&&getMe()){
clearInterval(t);
log('ready — keep='+KEEP_RECENT+' · interval=6h');
_schedule();
return;
}
if(attempts>=60)clearInterval(t);
},1000);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}

console.log('📦 pm-archiver.js v1 loaded — archive after 100 msgs');
})();
