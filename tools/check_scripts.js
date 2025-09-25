const fs=require('fs');
const path=require('path');
const p=path.join(__dirname,'..','src','viewer.html');
const txt=fs.readFileSync(p,'utf8');
const re=new RegExp('<script\\b[^>]*>([\s\S]*?)<\\/script>','gi');
let m,i=0,found=false;
while((m=re.exec(txt))){ i++; const src=m[1]; try{ new Function(src); }catch(e){ console.log('BAD_SCRIPT_INDEX:'+i); console.log('ERROR:'+e.message); console.log('---PREVIEW---'); console.log(src.slice(0,1200)); found=true; break; } }
if(!found) console.log('ALL_SCRIPTS_OK');
