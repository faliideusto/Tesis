// node --experimental-vm-modules tests/profile_ranks.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const mod=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/profile-ranks.js',import.meta.url),'utf8'));
await mod.link(()=>{throw new Error('Las distinciones no necesitan APIs ni estado de partida');});
await mod.evaluate();
const {RANKS,progression,badge}=mod.namespace;
assert.deepEqual(Array.from(RANKS,rank=>rank.start),[1,5,10,20,35,50,75]);
for(const [i,rank] of RANKS.entries()) {
  const result=progression({nivel:rank.start,xp:(rank.start-1)*500});
  assert.equal(result.rank.id,rank.id);
  assert.equal(result.rankPercent,i===RANKS.length-1?100:0);
  assert.equal(result.percent,0);
  assert.equal(result.toNextLevel,500);
  if(i) assert.equal(progression({nivel:rank.start-1,xp:0}).rank.id,RANKS[i-1].id);
  const markup=badge(rank.id);
  assert.match(markup,new RegExp(`tier-${rank.id}`));
  assert(markup.includes(`/assets/Tesis-assets/Rango-Niveles/${rank.file}.png`));
  const asset=await readFile(new URL(`../src/main/resources/static/assets/Tesis-assets/Rango-Niveles/${rank.file}.png`,import.meta.url));
  assert.equal(asset.subarray(1,4).toString(),'PNG');
  assert.match(markup,/role="img" aria-label="Distinción/);
  assert(!/<script|onload=|onerror=|https?:/.test(markup));
}
assert.equal(progression({nivel:1,xp:0}).rank.id,'madera');
assert.equal(progression({nivel:2,xp:500}).inLevel,0);
assert.equal(progression({nivel:2,xp:650}).percent,30);
assert.equal(progression({nivel:2,xp:650}).toNextLevel,350);
assert.equal(progression({nivel:2,xp:650}).rankPercent,25);
assert.equal(progression({nivel:99,xp:49250}).rank.id,'eterno');
assert.equal(progression({nivel:99,xp:49250}).rankPercent,100);
// Si los campos discrepan, no adjudicamos un nivel inventado al usuario.
assert.equal(progression({nivel:1,xp:50000}).level,1);
for(const bad of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'abc',1.5]) {
  assert.equal(progression({nivel:bad,xp:bad}).level,1);
  assert.equal(progression({nivel:bad,xp:bad}).xp,0);
}
assert.equal(progression(null).level,1);
assert.equal(progression({nivel:'5',xp:'2050'}).rank.id,'bronce');
assert(Object.isFrozen(RANKS));
assert(Object.isFrozen(RANKS[0]));
const first=badge('eterno'), second=badge('eterno');
assert.equal(first,second);
assert.match(first,/Catedratico\.png/);
assert.match(badge('<img src=x onerror=alert(1)>',{small:true}),/tier-madera profile-badge-small/);
assert(!badge('<img src=x onerror=alert(1)>').includes('onerror'));
console.log('Distinciones: umbrales, progresión, entradas inválidas y assets locales seguros verificados');
