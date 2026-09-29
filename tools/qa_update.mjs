// TESIS_URL=http://localhost:8091 node tools/qa_update.mjs
// PLAYWRIGHT_MODULE optionally points to an installed playwright-core module.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const output='target/qa-update'; await mkdir(output,{recursive:true});
try {
  await page.goto(process.env.TESIS_URL || 'http://localhost:8091');
  await page.evaluate(async()=>{
    const {board}=await import('/js/board.js');
    const {settled}=await import('/js/effects.js');
    const {dialog,phaseDialog,closeDialog}=await import('/js/dialogs.js');
    const {articleChoices}=await import('/js/players.js');
    const role={indice:0,nombre:'Pre-Doctoral',orden:6,habilidad:'Una vez por turno, añade 1 punto de trabajo a uno de tus artículos en desarrollo.',arte:'personajes/07_pre_doctoral.webp'};
    const card={indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,arte:'articulos/03_casos_controles.webp',marco:'cartas/marco_articulo_comun.webp'};
    window.fixture={yo:'Ana',actual:'Ana',fase:'TURNO_JUGADOR',ronda:1,roles:2,ideas:8,mano:[],seleccion:[],eventos:[],acciones:[],accionesRestantes:2,
      jugadores:['Ana','Bruno','Clara'].map((nombre,i)=>({nombre,activo:i===0,rol:i===2?null:role,monedas:2,prestigio:0,cartas:2,estudios:[{indice:0,carta:card,trabajo:i,publicado:false,prestigioExtra:0}]}))};
    window.draw=()=>{board(fixture);settled(null,fixture);};
    window.closeQA=closeDialog;
    window.selectionQA=()=>phaseDialog({...fixture,fase:'SELECCION_ROLES',seleccion:[role],catalogoSeleccion:[role,{...role,indice:-1,nombre:'Decana',orden:4}]});
    window.articlesQA=()=>dialog('Revisor 2',articleChoices({opciones:[{indice:0,objetivo:'Bruno'},{indice:0,objetivo:'Clara'}]},fixture),{wide:true});
    draw();
  });
  assert.equal(await page.locator('.deck').count(),0);
  assert.equal(await page.locator('.action-bolt.available').count(),2);
  for (const remaining of [1,0,2]) {
    await page.evaluate(n=>{fixture.accionesRestantes=n;draw();for(let i=0;i<10;i++)draw();},remaining);
    assert.equal(await page.locator('.action-bolt.available').count(),remaining);
    assert.equal(await page.locator('.action-bolt').count(),6);
    assert.equal(await page.locator('.rival:not(.active) .action-bolt.spent').count(),4);
    assert.equal(await page.locator('.active').count(),1);
  }
  await page.screenshot({path:`${output}/turno-local.png`});
  await page.locator('.rival[data-player="Bruno"]').hover();
  assert.equal(await page.locator('.rival-seat').filter({has:page.locator('[data-player="Bruno"]')}).locator('.player-role-preview').isVisible(),true);
  const badge=await page.locator('.rival[data-player="Bruno"]').boundingBox();
  const tooltip=await page.locator('.rival-seat').filter({has:page.locator('.rival[data-player="Bruno"]')}).locator('.player-role-preview').boundingBox();
  assert(Math.abs(tooltip.y-badge.y-badge.height-8)<2,'Role preview must stay next to the player frame');
  await page.screenshot({path:`${output}/personaje-revelado.png`});
  await page.locator('.rival[data-player="Clara"]').hover();
  assert.equal(await page.locator('.rival-seat').filter({has:page.locator('.rival[data-player="Clara"]')}).locator('.player-role-preview').count(),0);
  await page.evaluate(()=>{fixture.actual='Bruno';fixture.jugadores.forEach(p=>p.activo=p.nombre==='Bruno');fixture.accionesRestantes=0;draw();});
  assert.equal(await page.locator('#local.active').count(),0);
  assert.equal(await page.locator('.rival.active[data-player="Bruno"]').count(),1);
  assert.equal(await page.locator('#local .action-bolt.spent').count(),2);
  assert.equal(await page.locator('.rival.active .action-bolt').count(),2);
  assert.equal(await page.locator('.rival.active .action-bolt.available').count(),0);
  await page.evaluate(()=>{fixture.accionesRestantes=2;draw();});
  assert.equal(await page.locator('.rival.active .action-bolt.available').count(),2);
  await page.evaluate(()=>{fixture.jugadores[1].rol=null;draw();});
  assert.equal(await page.locator('#rivals .player-role-preview').count(),0);
  await page.evaluate(()=>selectionQA());
  assert.equal(await page.locator('.role-selection .role-card').count(),2);
  assert.equal(await page.locator('.role-selection .unavailable').count(),1);
  assert.match(await page.locator('.unavailable').innerText(),/No disponible/);
  assert.equal(await page.locator('.unavailable').isEnabled(),true);
  await page.screenshot({path:`${output}/seleccion.png`});
  await page.evaluate(()=>{closeQA();articlesQA();});
  assert.equal(await page.locator('.article-choice .card-frame').count(),2);
  assert.deepEqual(await page.locator('.article-owner').allTextContents(),['Bruno','Clara']);
  assert.deepEqual(await page.locator('.article-choice progress').evaluateAll(es=>es.map(e=>e.value)),[1,2]);
  await page.screenshot({path:`${output}/articulos.png`});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/articulos-movil.png`});
  await page.evaluate(()=>closeQA());
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{
    fixture.jugadores.push(...['Diego','Elena'].map(nombre=>({...structuredClone(fixture.jugadores[0]),nombre,activo:false})));
    draw();
  });
  for (const name of ['Diego','Elena']) {
    await page.locator(`.rival[data-player="${name}"]`).hover();
    const preview=page.locator('.rival-seat').filter({has:page.locator(`.rival[data-player="${name}"]`)}).locator('.player-role-preview');
    assert(await preview.isVisible());
    const box=await preview.boundingBox();
    assert(box.y>=0 && box.y+box.height<=768,`Preview outside viewport: ${name}`);
  }
  assert.deepEqual(errors,[]);
  // Exercise the actual app, authenticated perspectives and its polling loop.
  const base=process.env.TESIS_URL || 'http://localhost:8091';
  async function api(path,body,token) {
    const response=await fetch(`${base}/api/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Tesis':'1',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
    assert(response.ok,await response.clone().text()); return response.json();
  }
  const a=await api('salas',{nombre:'QA Ana'});
  const accesses=[a,await api(`salas/${a.codigo}/unirse`,{nombre:'QA Bruno'}),await api(`salas/${a.codigo}/unirse`,{nombre:'QA Clara'})];
  const route=`salas/${a.codigo}`;
  const get=access=>api(`${route}/estado`,null,access.playerToken);
  await api(`${route}/iniciar`,{revision:(await get(a)).revision},a.playerToken);
  const initial=await get(a);
  const selector=accesses.find(access=>access.sala.yo===initial.partida.actual);
  const next=accesses.find(access=>access!==selector);
  const real=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  real.on('pageerror',e=>errors.push(e.message));
  await real.addInitScript(identity=>sessionStorage.setItem('tesis.sala',JSON.stringify(identity)),{codigo:a.codigo,playerToken:selector.playerToken});
  await real.goto(base);
  await real.locator('[data-command="phase"]').click();
  assert.equal(await real.locator('.role-selection .role-card').count(),7);
  await real.locator('.unavailable').first().click();
  assert.equal(await real.locator('[data-command="confirm-role"]').count(),0);
  await real.locator('[data-command="back-roles"]').click();
  await real.locator('.role-selection [data-command="role"]:not([data-order="1"])').first().click();
  await real.locator('[data-command="confirm-role"]').click();
  await real.waitForFunction(()=>!document.querySelector('[data-command="phase"]'));
  const otherState=await get(next);
  assert.equal(otherState.partida.jugadores.find(p=>p.nombre===selector.sala.yo).rol,undefined);
  while((await get(a)).partida.fase==='SELECCION_ROLES') {
    const current=await get(a);
    const access=accesses.find(x=>x.sala.yo===current.partida.actual);
    const state=await get(access);
    const role=state.partida.seleccion.find(r=>r.orden!==1);
    await api(`${route}/accion`,{revision:state.revision,tipo:'SELECCIONAR',indice:role.indice},access.playerToken);
  }
  const turn=await get(a);
  const active=accesses.find(x=>x.sala.yo===turn.partida.actual);
  const clients=[{page:real,access:selector}];
  for (const access of accesses.filter(x=>x!==selector)) {
    const client=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
    client.on('pageerror',e=>errors.push(e.message));
    await client.addInitScript(identity=>sessionStorage.setItem('tesis.sala',JSON.stringify(identity)),{codigo:a.codigo,playerToken:access.playerToken});
    await client.goto(base);
    clients.push({page:client,access});
  }
  async function checkAllClients(name,remaining) {
    await Promise.all(clients.map(async({page,access})=>{
      await page.waitForFunction(({name,remaining})=>{
        const active=document.querySelector('#board .active');
        return !document.body.classList.contains('visual-busy') &&
          document.querySelector('#turn-panel strong')?.textContent===`Turno de ${name}` &&
          active?.querySelectorAll('.action-bolt.available').length===remaining;
      },{name,remaining},{timeout:30000});
      assert.equal(await page.locator('.action-bolts').count(),3);
      assert.equal(await page.locator('.action-bolt').count(),6);
      assert.equal(await page.locator('.action-bolt.available').count(),remaining);
      assert.equal(await page.locator('#board .active').count(),1);
      const activeName=await page.locator('#board .active').getAttribute('data-player') || access.sala.yo;
      assert.equal(activeName,name);
      assert.equal(await page.locator('#board .active .action-bolt.spent').count(),2-remaining);
    }));
  }
  await checkAllClients(turn.partida.actual,2);
  // External actions must reach every already-open client through polling.
  await api(`${route}/accion`,{revision:turn.revision,tipo:'COBRAR'},active.playerToken);
  await checkAllClients(turn.partida.actual,1);
  await api(`${route}/accion`,{revision:(await get(active)).revision,tipo:'PENSAR'},active.playerToken);
  await checkAllClients(turn.partida.actual,0);
  const beforeEnd=await get(active);
  await api(`${route}/accion`,{revision:beforeEnd.revision,tipo:'FIN_TURNO'},active.playerToken);
  const afterEnd=await get(a);
  await checkAllClients(afterEnd.partida.actual,2);
  await Promise.all(clients.map(({page})=>page.reload()));
  await checkAllClients(afterEnd.partida.actual,2);
  assert.deepEqual(errors,[]);
  await Promise.all(clients.map(({page})=>page.close()));
  console.log('QA navegador superada: cartas, privacidad, acciones, cambio de turno, estados repetidos y móvil.');
} finally {await browser.close();}
