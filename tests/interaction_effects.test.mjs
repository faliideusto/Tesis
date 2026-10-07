import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/main/resources/static/js/interaction-effects.js',import.meta.url),'utf8');
async function setup({reduced=false,hold=false}={}){
 const nodes=[],animations=[],listeners=new Map();let observed;
 class Element{
  constructor(x=0,y=0){this.style={};this.isConnected=true;this.x=x;this.y=y;this.children=[];}
  setAttribute(){} querySelector(){return null;} getBoundingClientRect(){return {left:this.x,top:this.y,width:60,height:60};}
  append(node){this.children.push(node);nodes.push(node);}remove(){this.isConnected=false;for(const child of this.children)child.remove();}
  animate(frames,options){let resolve;const finished=hold?new Promise(done=>resolve=done):Promise.resolve();const animation={frames,options,element:this,finished,cancelled:false,cancel(){this.cancelled=true;resolve?.();},finish(){resolve?.();}};animations.push(animation);return animation;}
 }
 const local=new Element(10,20),rival=new Element(310,420);
 const document={hidden:false,body:new Element(),createElement:()=>new Element(),getElementById:()=>local,querySelector:()=>rival,addEventListener:(name,fn)=>listeners.set(`doc:${name}`,fn),removeEventListener:name=>listeners.delete(`doc:${name}`)};
 const window={addEventListener:(name,fn)=>listeners.set(`win:${name}`,fn),removeEventListener:name=>listeners.delete(`win:${name}`)};
 const context=vm.createContext({document,window,matchMedia:()=>({matches:reduced}),CSS:{escape:value=>value},MutationObserver:class{constructor(fn){observed=fn;}observe(){}disconnect(){observed=null;}}});
 const mod=new vm.SourceTextModule(source,{context});await mod.link(async()=>new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/dom.js',import.meta.url),'utf8'),{context}));await mod.evaluate();
 return {play:mod.namespace.playInteraction,nodes,animations,listeners,local,rival,document,changed:()=>observed?.()};
}
const assets=Object.fromEntries(['libro','hoja-01','hoja-02','impacto'].map(key=>[key,`/assets/seasons/cronicas/interaccion/${key}.png`]));
const event={numero:1,emisor:'Ana',objetivo:'Bruno',interactionId:'archivo_lanzamiento_libro',fecha:'2026-10-07T10:00:00Z'};
const state={yo:'Ana',jugadores:[{nombre:'Ana',cosmeticos:{interaccion:{id:event.interactionId,tipo:'interaccion',assets}}},{nombre:'Bruno'}]};
{
 const fx=await setup(),unchanged=JSON.stringify(state);assert.equal(await fx.play(event,{state}),true);assert.equal(JSON.stringify(state),unchanged,'El renderer no modifica estado funcional ni loadout');assert.equal(fx.animations.length,53);assert.equal(fx.animations[0].options.duration,820);assert(fx.animations[0].frames.some(frame=>frame.transform.includes('300px,400px')));assert.equal(fx.animations.at(-1).element,fx.rival);assert(fx.nodes.every(node=>!node.isConnected));assert.equal(fx.listeners.size,0);
 const sparks=fx.animations.filter(animation=>animation.element.className?.includes('interaction-spark'));
 assert.equal(sparks.length,48);assert.equal(sparks.filter(animation=>animation.element.style.color==='#d5a2ff').length,24);assert.equal(sparks.filter(animation=>animation.element.style.color==='#ffd66f').length,24);
 assert(sparks.every(animation=>animation.options.duration===580&&animation.frames.at(-1).opacity===0));
}
{
 const fx=await setup({reduced:true});assert.equal(await fx.play(event,{state}),true);assert.equal(fx.animations.length,1);assert.equal(fx.animations[0].options.duration,200);assert(!fx.nodes.some(node=>node.className?.includes('interaction-book')||node.className?.includes('interaction-spark')));assert(fx.animations[0].frames.every(frame=>!frame.transform));
}
{
 const fx=await setup({hold:true}),controller=new AbortController();const playing=fx.play(event,{state,signal:controller.signal});controller.abort();assert.equal(await playing,false);assert(fx.animations.every(animation=>animation.cancelled));assert(fx.nodes.every(node=>!node.isConnected));assert.equal(fx.listeners.size,0);
}
{
 const fx=await setup({hold:true});const playing=fx.play(event,{state});fx.rival.isConnected=false;fx.changed();assert.equal(await playing,false);assert(fx.animations.every(animation=>animation.cancelled));assert(fx.nodes.every(node=>!node.isConnected));
}
for(const invalid of [{...event,interactionId:'unknown'},{...event,objetivo:'Ana'}]){const fx=await setup();assert.equal(await fx.play(invalid,{state}),false);assert.equal(fx.nodes.length,0);}
for(const cause of ['resize','hidden']){const fx=await setup({hold:true});const playing=fx.play(event,{state});if(cause==='hidden')fx.document.hidden=true;fx.listeners.get(cause==='resize'?'win:resize':'doc:visibilitychange')();assert.equal(await playing,false);assert(fx.animations.every(animation=>animation.cancelled));assert.equal(fx.listeners.size,0);}
{
 const fx=await setup();const bad={...state,jugadores:[{nombre:'Ana',cosmeticos:{interaccion:{id:event.interactionId,tipo:'interaccion',assets:{...assets,libro:'https://evil.test/tracker.png'}}}}]};assert.equal(await fx.play(event,{state:bad}),false);assert.equal(fx.animations.length,0);assert(fx.nodes.every(node=>!node.isConnected));
}
console.log('Interacciones renderer: trayectoria real, assets del emisor, reduced motion, abort/DOM cleanup, aislamiento y rutas seguras PASS');
