// Lifecycle and untrusted catalog rendering without a browser framework.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {customizationFixture} from '../tools/preview_customization.mjs';
const context=vm.createContext({CSS:{escape:value=>value},console});
const modules=new Map();
async function load(name){if(modules.has(name))return modules.get(name);const mod=new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context});modules.set(name,mod);await mod.link(spec=>load(spec.replace('./','')));await mod.evaluate();return mod;}
const {mountCustomization,cosmeticArt,profileCosmeticParts}=(await load('profile-customization.js')).namespace;
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function root(){
 const nodes=new Map(),listeners=new Map(),attrs=new Map();
 return {innerHTML:'',ownerDocument:{activeElement:null},nodes,listeners,
 querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',focus(){},insertAdjacentHTML(_,html){this.innerHTML+=html;}});return nodes.get(selector);},
 querySelectorAll:()=>[],contains:()=>true,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),
 addEventListener:(key,value)=>listeners.set(key,value),removeEventListener:key=>listeners.delete(key)};
}
const profile={nombre:'<img src=x onerror=bad()>',nivel:1,xp:0};
let identity='one',resolve,reads=0;
const accounts={identity:()=>identity,cosmetics:()=>{reads++;return new Promise(done=>resolve=done);}};
const first=root(),controller=mountCustomization(first,{accounts,profile,onSummary(){}});
assert.equal(reads,1);controller.destroy();resolve(customizationFixture());await flush();
assert.equal(first.querySelector('.customization-grid').innerHTML,'','Destroyed mounts discard private late data');assert.equal(first.listeners.size,0);
const second=root();mountCustomization(second,{accounts,profile,onSummary(){}});identity='two';resolve(customizationFixture());await flush();
assert.equal(second.querySelector('.customization-grid').innerHTML,'','Account changes discard private late data');
const fixture=customizationFixture();fixture.catalogo[0].cosmetico.nombre='<img src=x onerror=bad()>';fixture.catalogo[0].cosmetico.asset='https://example.org/tracker.svg';fixture.inventario[0]={...fixture.catalogo[0].cosmetico};
const third=root(),active=mountCustomization(third,{accounts:{identity:()=>identity,cosmetics:async()=>fixture},profile,onSummary(){}});await flush();
const grid=third.querySelector('.customization-grid').innerHTML;
assert(!grid.includes('<img src=x'));assert(grid.includes('&lt;img'));assert(!grid.includes('https://example.org'));
assert(!third.querySelector('.customization-preview').innerHTML.includes('<img src=x'));
assert(third.innerHTML.includes('data-category="interaccion"'));assert.equal((third.querySelector('.customization-slots').innerHTML.match(/class="customization-slot /g)||[]).length,7);
assert.equal(fixture.catalogo.length,12);assert.equal(fixture.temporadas[0].totalRecompensas,10);assert.equal(fixture.equipamiento.interaccion,null);
active.destroy();
assert(!cosmeticArt({tipo:'titulo',nombre:'Custodio <del Archivo>',asset:null}).includes('<img'));
assert(cosmeticArt({tipo:'titulo',nombre:'Custodio <del Archivo>',asset:null}).includes('Custodio &lt;del Archivo&gt;'));
assert(cosmeticArt({tipo:'avatar',asset:'/assets/seasons/cronicas-del-archivo/avatares/avatar-aprendiz-del-archivo.png'}).includes('/assets/seasons/'));
assert(!cosmeticArt({tipo:'avatar',asset:'/assets/seasons/../tracker.png'}).includes('<img'));
const originals=profileCosmeticParts({inventario:[],equipamiento:{}});
assert(originals.portrait.includes('user-icon.svg'));assert(originals.back.includes('cartas/reverso_idea.webp'));assert.equal(originals.title,'');assert.equal(originals.plate,'');
let saved;
const defaultsFixture=customizationFixture();defaultsFixture.inventario=defaultsFixture.catalogo.map(row=>row.cosmetico);defaultsFixture.equipamiento.marco=defaultsFixture.catalogo.find(row=>row.cosmetico.tipo==='marco').cosmetico.id;
const defaultRoot=root();const defaultsMount=mountCustomization(defaultRoot,{accounts:{identity:()=>identity,cosmetics:async()=>defaultsFixture,equipCosmetic:async(tipo,id)=>{saved={tipo,id};return {...defaultsFixture,equipamiento:{...defaultsFixture.equipamiento,[tipo]:id}};}},profile,onSummary(){}});await flush();
const originalsGrid=defaultRoot.querySelector('.customization-grid').innerHTML;
for(const tipo of ['avatar','marco','titulo','insignia','placa','reverso','interaccion'])assert(originalsGrid.includes(`data-select="default:${tipo}"`));
const button=(dataset,attributes=[])=>({dataset,hasAttribute:key=>attributes.includes(key)});
const click=target=>defaultRoot.listeners.get('click')({target:{closest:()=>target}});
click(button({select:'default:marco'}));click(button({},['data-equip']));await flush();
assert.equal(saved.tipo,'marco');assert.equal(saved.id,null,'Default is translated to unequip, never sent as a cosmetic ID');
assert(defaultRoot.querySelector('.customization-detail').innerHTML.includes('Sin marco'));
assert(defaultRoot.querySelector('.customization-detail').innerHTML.includes('✓ Equipado'));
assert(!defaultRoot.querySelector('.customization-preview').innerHTML.includes('customization-frame-overlay'));
defaultsMount.destroy();
console.log('Personalización: generación, destroy, identidad, catálogo no confiable, assets locales e Interacciones catalogadas PASS');
