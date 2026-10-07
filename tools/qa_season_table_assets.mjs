// Visual integration of public DTO fixtures. No real accounts, rooms or Supabase writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {customizationFixture,startCustomizationPreview} from './preview_customization.mjs';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'file:///C:/Users/radeu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const port=8099,base=`http://127.0.0.1:${port}`,server=await startCustomizationPreview(port);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('target/qa-season-assets',{recursive:true});
try {
 await page.goto(base);const items=Object.fromEntries(customizationFixture().catalogo.map(row=>[row.cosmetico.id,row.cosmetico]));
 const players=['Falio3','Cronista','Aprendiz'].map((nombre,index)=>({nombre,monedas:3,prestigio:2,cartas:3,publicados:0,rol:null,estudios:[],activo:index===0,cosmeticos:index===2?null:{avatar:items[index===0?'archivo_erudito':'academia_avatar'],marco:items[index===0?'archivo_maestro_marco':'academia_marco'],reverso:items.academia_reverso,interaccion:items.archivo_lanzamiento_libro}}));
 const state={yo:'Falio3',actual:'Falio3',fase:'TURNO_JUGADOR',ronda:1,jugadores:players,mano:[],acciones:[],seleccion:[],accionesRestantes:2,bloqueada:false};
 await page.evaluate(async state=>{document.body.innerHTML='<main id="app"></main>';document.body.className='';const {board}=await import('/js/board.js');board(state);},state);
 for(const width of [1672,390]){
  await page.setViewportSize({width,height:width===390?844:941});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  assert.deepEqual(await page.locator('#board img').evaluateAll(imgs=>imgs.filter(img=>!img.naturalWidth).map(img=>img.src)),[]);
  assert.equal(await page.locator('.player-avatar').count(),2);assert.equal(await page.locator('.player-avatar-frame').count(),2);assert.equal(await page.locator('.player-card-back').count(),2);
  const centers=await page.locator('.player-avatar-frame').evaluateAll(nodes=>nodes.map(node=>{const frame=node.getBoundingClientRect(),portrait=node.parentElement.getBoundingClientRect();return {x:Math.abs(frame.x+frame.width/2-portrait.x-portrait.width/2),y:Math.abs(frame.y+frame.height/2-portrait.y-portrait.height/2)};}));
  assert(centers.every(center=>center.x<.5&&center.y<.5),'Marco centrado sobre su avatar, sin desplazamiento por max-width global');
  assert.equal(await page.locator('img[src*="lanzamiento-libro"]').count(),0);
  await page.screenshot({path:`target/qa-season-assets/table-equipped-${width}.png`,fullPage:true});
 }
 await page.evaluate(async state=>{state.jugadores.forEach(p=>p.cosmeticos=null);(await import('/js/board.js')).board(state);},state);
 assert.equal(await page.locator('.player-avatar,.player-avatar-frame,.player-card-back').count(),0);await page.screenshot({path:'target/qa-season-assets/table-defaults.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Mesa cosmética: PNG reales desktop/móvil, dos propietarios, defaults, sin interacción animada PASS');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
