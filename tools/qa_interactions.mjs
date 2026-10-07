import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startInteractionsPreview} from './preview_interactions.mjs';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'file:///C:/Users/radeu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const demo=await startInteractionsPreview(8122);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const pages=[],errors=[];await mkdir('target/qa-interactions',{recursive:true});
try {
 for(const person of demo.people){
  const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:person.nombre==='Sol'?'reduce':'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${demo.origin}/?jugador=${person.nombre}`);await page.waitForSelector('#local');
  await page.evaluate(()=>{window.__cosmeticObserved=0;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.classList?.contains('interaction-effects'))window.__cosmeticObserved++;}).observe(document.body,{childList:true});});
  pages.push(page);
 }
 const [fali,marta,sol]=pages;await fali.waitForSelector('[data-room-interaction]');await marta.waitForSelector('[data-room-interaction]');
 assert.equal(await sol.locator('[data-room-interaction]').count(),0);
 for(const page of [fali,marta]){assert.equal(await page.locator('[data-room-interaction]').count(),1);assert.equal(await page.locator('.rival [data-room-interaction]').count(),0);}
 const inside=page=>page.locator('[data-room-interaction]').evaluate(node=>{const button=node.getBoundingClientRect(),plaque=node.closest('#local').getBoundingClientRect();return button.left>=plaque.left&&button.right<=plaque.right&&button.top>=plaque.top&&button.bottom<=plaque.top+plaque.height*.75;});
 assert(await inside(fali),'Pointer is inside visible plaque');
 await fali.locator('[data-room-interaction]').click();assert.equal(await fali.locator('.room-interaction-target').count(),2);assert.equal(await fali.locator('#local.room-interaction-target').count(),0);
 await fali.screenshot({path:'target/qa-interactions/target-selection.png',fullPage:true});
 await fali.keyboard.press('Escape');assert.equal(await fali.locator('.room-interaction-target').count(),0);
 await fali.locator('[data-room-interaction]').click();await fali.locator('#local').click({position:{x:2,y:2}});assert.equal(await fali.locator('.room-interaction-target').count(),0);await fali.keyboard.press('Escape');
 const actor=demo.people[0],route=`salas/${demo.codigo}`;
 const before=await demo.api(`${route}/estado`,actor,undefined,actor.access.playerToken);
 console.log('Control/selection PASS');
 await fali.locator('[data-room-interaction]').click();await fali.locator('.rival[data-player="Marta"]').click();
 await fali.waitForSelector('.interaction-book');await fali.mouse.move(835,420);
 // Freeze only this test's decorative flight at mid-trajectory for a readable capture.
 await fali.evaluate(()=>document.querySelector('.interaction-effects')?.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=400;}));
 await fali.screenshot({path:'target/qa-interactions/book-flight.png',fullPage:true});
 await fali.evaluate(()=>document.querySelector('.interaction-effects')?.getAnimations({subtree:true}).forEach(animation=>animation.play()));
 await fali.waitForSelector('.interaction-spark');assert.equal(await fali.locator('.interaction-spark').count(),48);
 await fali.evaluate(()=>document.querySelector('.interaction-effects')?.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=280;}));
 await fali.screenshot({path:'target/qa-interactions/impact-fireworks.png',fullPage:true});
 await fali.evaluate(()=>document.querySelector('.interaction-effects')?.getAnimations({subtree:true}).forEach(animation=>animation.play()));
 await Promise.all(pages.map(page=>page.waitForFunction(()=>window.__cosmeticObserved>=1)));
 const after=await demo.api(`${route}/estado`,actor,undefined,actor.access.playerToken);assert.deepEqual(after,before,'Cosmetic event leaves functional state/revision untouched');
 const spam=await fali.evaluate(async({codigo})=>{const identity=JSON.parse(sessionStorage.getItem('tesis.sala'));return (await fetch(`/api/salas/${codigo}/interacciones`,{method:'POST',headers:{Authorization:`Bearer ${identity.playerToken}`,'X-Tesis-Account-Authorization':`Bearer ${window.__qaAccount.access_token}`,'X-Tesis':'1','Content-Type':'application/json'},body:JSON.stringify({interactionId:'archivo_lanzamiento_libro',objetivo:'Marta'})})).status;},{codigo:demo.codigo});assert.equal(spam,429);
 await fali.reload();await fali.waitForSelector('[data-room-interaction]:disabled');await fali.screenshot({path:'target/qa-interactions/cooldown-after-reload.png',fullPage:true});
 await fali.waitForFunction(()=>document.querySelector('[data-room-interaction]')?.disabled===false,{},{timeout:17000});
 await fali.locator('[data-room-interaction]').click();await fali.locator('.rival[data-player="Marta"]').click();await fali.waitForSelector('.interaction-book');
 const current=await demo.api(`${route}/estado`,actor,undefined,actor.access.playerToken);
 const turn=demo.people.find(p=>p.nombre===current.partida.actual);const view=await demo.api(`${route}/estado`,turn,undefined,turn.access.playerToken);
 const action=view.partida.acciones.find(a=>a.disponible&&['COBRAR','PENSAR','FIN_TURNO'].includes(a.id));assert(action,'Normal gameplay action available');
 const continued=await demo.api(`${route}/accion`,turn,{revision:view.revision,tipo:action.id},turn.access.playerToken);assert.equal(continued.revision,view.revision+1);
 await marta.setViewportSize({width:390,height:844});assert(await inside(marta),'Pointer remains inside mobile plaque');await marta.screenshot({path:'target/qa-interactions/mobile-control.png',fullPage:true});
 await new Promise(r=>setTimeout(r,1600));assert.equal(await fali.locator('.interaction-effects').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: three real room clients, own-only control, no-self/cancel, all observers/reduced-motion, immutable game state, server spam429, reload cooldown15s, gameplay continues, desktop/mobile.');
} finally {await browser.close();await demo.close();}
