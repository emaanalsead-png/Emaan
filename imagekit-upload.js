(function(){
'use strict';
if(window.__imgbbPrimaryV1)return;
window.__imgbbPrimaryV1=true;

var IMGBB_KEY='80fd32c4ef79b5f25fbcf0893547de4f';

function upImgbb(file){
var fd=new FormData();
fd.append('key',IMGBB_KEY);
fd.append('image',file);
return fetch('https://api.imgbb.com/1/upload',{method:'POST',body:fd})
.then(function(r){return r.json()})
.then(function(d){
if(d.success&&d.data&&d.data.url)return d.data.url;
throw new Error(d.error&&d.error.message||'imgbb failed');
});
}

window.UploadService=window.UploadService||{};
var o=window.UploadService.upload;

window.UploadService.upload=function(f){
var isImage=f&&f.type&&f.type.indexOf('image/')===0;
if(isImage){
return upImgbb(f).catch(function(e){
console.warn('imgbb failed:',e.message);
if(o)return o.call(this,f);
throw e;
});
}
if(o)return o.call(this,f);
throw new Error('no uploader');
};

console.log('✅ imgbb primary uploader ready');
})();
