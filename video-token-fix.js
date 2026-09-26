(function(){
'use strict';
if(window.__videoTokenFix)return;
window.__videoTokenFix=true;
function newIsLink(text){
if(!text)return false;
var c=String(text)
.replace(/\[img:[^\]]+\]/gi,'')
.replace(/\[e:\d+\]/gi,'')
.replace(/\[cu:[^\]]+\]/gi,'')
.replace(/\[sticker:[^\]]+\]/gi,'')
.replace(/\[paint:[^\]]+\]/gi,'')
.replace(/\[yt:[a-zA-Z0-9_-]{11}\]/gi,'')
.replace(/\[sty:[A-Za-z0-9_\-=]+\]/gi,'')
.replace(/\[audio:[^\]]+\]/gi,'')
.replace(/\[video:[^\]]+\]/gi,'');
if(!c.trim())return false;
var p=[
/(https?:\/\/[^\s]+)/i,
/(www\.[^\s]+)/i,
/([a-z0-9-]+\.(com|net|org|io|ly|co|me|info|xyz|app|dev|tv|fm|link|sh|to|cc|ru|cn|tk))(\/[^\s]*)?/i,
/(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)/i
];
return p.some(function(x){return x.test(c)});
}
window.isLink=newIsLink;
console.log('✅ video-token-fix: [video:] added to safe tokens');
})();
