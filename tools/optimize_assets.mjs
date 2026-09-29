// One-time lossless conversion. Optional dependency: sharp (or SHARP_MODULE).
// Originals and verification report are retained in ignored target/asset-originals.
import {createRequire} from 'node:module';
import {readdir,readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE || 'sharp');
const root=resolve('src/main/resources/static/assets/Tesis-assets');
const backup=resolve('target/asset-originals');
const report=[];
async function convert(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=resolve(dir,entry.name);
    if(entry.isDirectory()) {if(entry.name!=='referencias')await convert(path);continue;}
    if(!entry.name.endsWith('.png')) continue;
    assert(path.startsWith(root+ '/'.replace('/',process.platform==='win32'?'\\':'/')));
    const input=await readFile(path);
    const result=await sharp(input).keepIccProfile().webp({lossless:true,effort:6}).toBuffer();
    const original=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=await sharp(result).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual(decoded.info,original.info);
    // WebP may normalize invisible RGB under fully transparent pixels.
    for(let i=0;i<original.data.length;i+=4) {
      assert.equal(decoded.data[i+3],original.data[i+3]);
      if(original.data[i+3]) for(let c=0;c<3;c++)assert.equal(decoded.data[i+c],original.data[i+c]);
    }
    assert(result.length<input.length,`No saving: ${path}`);
    const saved=resolve(backup,relative(root,path));await mkdir(dirname(saved),{recursive:true});
    await writeFile(saved,input);
    await writeFile(path.replace(/\.png$/,'.webp'),result);
    await unlink(path);
    report.push({file:relative(root,path),before:input.length,after:result.length,visiblePixelsIdentical:true});
  }
}
await convert(root);
if(report.length)await writeFile(resolve(backup,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:report.length,before:report.reduce((s,p)=>s+p.before,0),after:report.reduce((s,p)=>s+p.after,0)}));
