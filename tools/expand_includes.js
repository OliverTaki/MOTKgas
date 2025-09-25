const fs=require('fs'); const path=require('path');
const root=path.join(__dirname,'..','src');
let txt=fs.readFileSync(path.join(root,'index.html'),'utf8');
const incRe=/<\?!=\s*include\(['"]([^'"]+)['"]\)\s*;?\s*\?>/g;
function resolveIncludes(s, depth){ if(depth>20) return s; return s.replace(incRe, function(m,name){
  const f1=path.join(root, name + '.html'); const f2=path.join(root, name + '.htm'); const f3=path.join(root, name);
  let p=null; if(fs.existsSync(f1)) p=f1; else if(fs.existsSync(f2)) p=f2; else if(fs.existsSync(f3)) p=f3; else return '';
  let c=fs.readFileSync(p,'utf8'); return resolveIncludes(c, depth+1);
}); }
let out=resolveIncludes(txt,0);
fs.writeFileSync(path.join(__dirname,'..','tmp_rendered_index.html'), out, 'utf8');
console.log('rendered to tmp_rendered_index.html length', out.length); 
const lines=out.split(/\r?\n/);
const L=lines.length; console.log('lines',L);
function showAround(n){ const start=Math.max(0,n-10); const end=Math.min(L, n+10); for(let i=start;i<end;i++){ console.log((i+1).toString().padStart(6,' ')+': '+lines[i]); } }
const target=4696; if(target<=L) { console.log('--- around',target); showAround(target); } else { console.log('file shorter than',target); }
