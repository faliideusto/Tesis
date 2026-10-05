// Real room flow, visual evidence and responsive checks. Run against the local QA server.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.TESIS_URL || 'http://localhost:8091';
const output=process.env.TESIS_VISUAL_OUT || 'target/qa-v210/after';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const contexts=[],pages=new Map(),errors=[],checks=[];
async function fresh(name,width=1440,height=960){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  contexts.push(context); const page=await context.newPage(); pages.set(name,page);
  if(process.env.TESIS_VISUAL_BASELINE==='1') await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/'||/^\/(js|css)\/.*\.(js|css)$/.test(path)){
      const source=execFileSync('git',['show',`HEAD:src/main/resources/static/${path==='/'?'index.html':path.slice(1)}`]);
      await route.fulfill({body:source,contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
    }else await route.continue();
  });
  page.on('pageerror',e=>errors.push(e.message)); await page.goto(base); return page;
}
async function screenshot(page,name){
  await page.mouse.move(0,300);await page.evaluate(()=>document.activeElement?.blur());
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
  checks.push({name,...geometry}); assert(geometry.scrollWidth<=geometry.width,`${name}: horizontal overflow`);
}
async function state(page){
  const identity=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')));
  const r=await page.request.get(`${base}/api/salas/${identity.codigo}/estado`,{headers:{Authorization:`Bearer ${identity.playerToken}`}});
  assert(r.ok()); return r.json();
}
async function ready(page){await page.waitForFunction(()=>!document.body.matches('.busy,.visual-busy'));}
async function mutation(page,click){
  const pending=page.waitForResponse(r=>r.url().includes('/api/salas')&&r.request().method()==='POST');
  await click();const response=await pending;assert(response.ok(),await response.text());await ready(page);return response.json();
}
try {
  const host=await fresh('Ana');await host.locator('#create-room').waitFor();await screenshot(host,'01-home-desktop');
  const mobile=await fresh('Mobile',390,844);await mobile.locator('#create-room').waitFor();await screenshot(mobile,'02-home-mobile');
  for(const width of [1366,1024,768,360]){
    await mobile.setViewportSize({width,height:900});await screenshot(mobile,`responsive-home-${width}`);
  }
  await mobile.keyboard.press('Tab');assert(await mobile.evaluate(()=>document.activeElement!==document.body),'keyboard focus');
  if(process.env.TESIS_VISUAL_BASELINE!=='1'){
    const hero=await mobile.locator('.home-screen').evaluate(e=>getComputedStyle(e).backgroundImage);
    assert(hero.includes('academy'),`hero background configured: ${hero}`);
    assert((await mobile.request.get(`${base}/assets/Tesis-assets/visual-v2/academy-night.webp`)).ok(),'hero asset loads');
    const normalContext=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'no-preference'});contexts.push(normalContext);
    const normal=await normalContext.newPage();await normal.goto(base);await normal.locator('#create-room').waitFor();
    const normalMotion=await normal.locator('.showcase-card').first().evaluate(e=>e.getAnimations().filter(a=>a.playState==='running').length);
    const reducedMotion=await mobile.locator('.showcase-card').first().evaluate(e=>e.getAnimations().filter(a=>a.playState==='running'&&a.effect.getTiming().iterations===Infinity).length);
    assert.equal(await mobile.locator('.showcase-card').first().evaluate(e=>getComputedStyle(e).animationName),'none');
    checks.push({name:'motion',normalRunning:normalMotion,reducedInfinite:reducedMotion});assert(normalMotion>0,'normal home animations');assert.equal(reducedMotion,0,'reduce stops decorative loops');
  }
  await host.locator('[data-command=help]').click();await host.locator('#modal[open] .rules-copy').waitFor();await screenshot(host,'03-help');await host.locator('[data-command=close]').click();
  await host.locator('#create-room input').fill('Ana');await mutation(host,()=>host.locator('#create-room button[type=submit]').click());
  const code=await host.locator('.room-code').innerText();
  for(const name of ['Bruno','Clara']) {
    const page=await fresh(name);await page.locator('#join-room [name=codigo]').fill(code);
    await page.locator('#join-room [name=nombre]').fill(name);await mutation(page,()=>page.locator('#join-room button[type=submit]').click());
  }
  await host.waitForFunction(()=>document.querySelectorAll('.lobby-players li').length===3);await screenshot(host,'04-lobby-desktop');
  await host.setViewportSize({width:390,height:844});await screenshot(host,'05-lobby-mobile');await host.setViewportSize({width:1440,height:960});
  await mutation(host,()=>host.locator('[data-command=start-game]').click());
  let selectionCaptured=false;
  for(let step=0;step<5;step++){
    const room=await state(host);if(room.partida.fase!=='SELECCION_ROLES')break;
    const page=pages.get(room.partida.actual);await ready(page);
    await page.waitForFunction(name=>document.querySelector('#turn-panel strong')?.textContent==='Elige '+name,room.partida.actual);
    if(!await page.locator('#modal[open] .role-selection').count()) await page.locator('[data-command=phase]').click();await page.locator('.role-selection').waitFor();
    if(!selectionCaptured){await screenshot(page,'06-role-selection');selectionCaptured=true;}
    const own=await state(page);const role=own.partida.seleccion.find(r=>r.orden!==1)||own.partida.seleccion[0];
    await page.locator(`.role-selection [data-index="${role.indice}"]`).click();await mutation(page,()=>page.locator('[data-command=confirm-role]').click());
  }
  const room=await state(host);assert.equal(room.partida.fase,'TURNO_JUGADOR');const active=pages.get(room.partida.actual);
  await active.waitForFunction(name=>document.querySelector('#turn-panel strong')?.textContent==='Turno de '+name,room.partida.actual);await ready(active);
  if(process.env.TESIS_VISUAL_BASELINE!=='1'){
    assert((await active.request.get(`${base}/assets/Tesis-assets/visual-v2/reserved-scholar.webp`)).ok(),'reserved portrait asset loads');
    const portraits=await active.evaluate(async()=>{
      const {rival}=await import('/js/players.js');const p={nombre:'Ejemplo QA',monedas:2,prestigio:0,cartas:2,estudios:[],rol:null};
      const reserved=rival(p);const art='personajes/05_decana.webp';const revealed=rival({...p,rol:{nombre:'Decana',arte:art,habilidad:'Automática.',orden:5}});
      return {reserved:reserved.includes('reserved-portrait')&&reserved.includes('visual-v2/reserved-scholar.webp'),revealed:revealed.includes(art)&&!revealed.includes('reserved-scholar.webp')};
    });assert(portraits.reserved&&portraits.revealed,'hidden and revealed portrait presentation');checks.push({name:'portraits',...portraits});
  }
  await screenshot(active,'07-board-desktop');await active.setViewportSize({width:390,height:844});await screenshot(active,'08-board-mobile');
  if(process.env.TESIS_VISUAL_BASELINE!=='1'){
    const reserved=active.locator('.rival').filter({has:active.locator('.reserved-portrait')}).first();
    await reserved.locator('img').first().evaluate(i=>i.decode());await reserved.screenshot({path:`${output}/11-reserved-player-detail.png`});
  }
  await active.setViewportSize({width:1440,height:960});await active.evaluate(()=>scrollTo(0,0));await ready(active);
  await active.locator('#hand [data-command=inspect]').first().focus();await active.keyboard.press('Enter');await active.locator('#modal[open] .card-detail').waitFor();await screenshot(active,'09-card-detail');
  await active.locator('[data-command=close]').click();
  const fixture=await fresh('Fixture');
  await fixture.evaluate(async()=>{
    const {board}=await import('/js/board.js');const {feedback}=await import('/js/feedback.js');
    const card={indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,arte:'articulos/03_casos_controles.webp',marco:'cartas/marco_articulo_comun.webp'};
    window.drawVisualFixture=(players=5,articles=3)=>{const state={bloqueada:false,yo:'Ana',actual:'Bruno',fase:'TURNO_JUGADOR',ronda:2,ideas:8,roles:5,accionesRestantes:0,seleccion:[],eventos:[],ganadores:[],acciones:[],mano:[card],jugadores:['Ana','Bruno','Clara','Diego','Elena'].slice(0,players).map(nombre=>({nombre,monedas:3,prestigio:3,cartas:2,publicados:Math.floor(articles/3),rol:null,activo:nombre==='Bruno',estudios:Array.from({length:articles},(_,indice)=>({indice,carta:card,trabajo:1,prestigioExtra:0,publicado:indice>=Math.ceil(articles*2/3)}))}))};board(state);feedback(null,state);};window.drawVisualFixture();
  });
  await screenshot(fixture,'10-board-5players-fixture');
  const fixtureFindings=[];
  for(const width of [1920,1366,1024,768,390,360])for(const players of [3,4,5])for(const articles of [0,3,10]){
    await fixture.setViewportSize({width,height:width===1920?1080:960});await fixture.evaluate(([p,a])=>drawVisualFixture(p,a),[players,articles]);
    const result=await fixture.evaluate(()=>{
      const problems=[];if(document.documentElement.scrollWidth>innerWidth)problems.push('horizontal overflow');
      for(const heading of document.querySelectorAll('.article-group h3')){if(heading.scrollWidth>heading.clientWidth+1)problems.push('heading text overflow');const r=heading.getBoundingClientRect();if(r.top>=0&&r.bottom<=innerHeight){const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(top&&!heading.contains(top)&&!top.contains(heading))problems.push('heading covered');}}
      for(const scroll of document.querySelectorAll('.article-scroll'))if(scroll.querySelectorAll('.table-study').length>3){scroll.scrollLeft=scroll.scrollWidth;if(scroll.scrollLeft<=0)problems.push('crowded lane inaccessible');}
      return [...new Set(problems)];
    });checks.push({name:'board-fixture',width,players,articles,problems:result});if(result.length)fixtureFindings.push({width,players,articles,problems:result});
    assert(!result.includes('horizontal overflow'),`fixture overflow ${width}/${players}/${articles}`);
  }
  await writeFile(`${output}/fixture-findings.json`,JSON.stringify(fixtureFindings,null,2));
  assert.deepEqual(errors,[]);await writeFile(`${output}/results.json`,JSON.stringify({checks,errors,roomFlow:'3 real players; create, join, lobby, role selection, turn and card inspection; 5-player board is a visual fixture'},null,2));
  if(process.env.TESIS_VISUAL_BASELINE!=='1'){
    const names=['01-home-desktop','02-home-mobile','03-help','04-lobby-desktop','05-lobby-mobile','06-role-selection','07-board-desktop','08-board-mobile','09-card-detail'];
    const titles=['Inicio · escritorio','Inicio · móvil','Cómo jugar','Sala · escritorio','Sala · móvil','Selección de personaje','Mesa · escritorio','Mesa · móvil','Detalle de carta'];
    await writeFile('target/qa-v210/report.html',`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tesis 2.1.0 · Antes y después</title><style>body{margin:0;padding:40px;background:#091522;color:#f5e9d7;font:16px system-ui}h1{font:48px Georgia;color:#e6bb86}h2{font:30px Georgia}.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0;background:#15283b;padding:14px;border-radius:8px}figcaption{padding:8px;color:#e6bb86}img{width:100%;height:auto;display:block}section{margin:48px 0}a{color:#e6bb86}@media(max-width:700px){body{padding:20px}.pair{grid-template-columns:1fr}}</style><h1>Tesis · Edición 2.1.0</h1><p>Comparación actual obtenida en Chrome. Inicio, sala, selección, turno y detalle proceden de un flujo real con tres jugadores. La mesa de cinco jugadores es una composición de QA con datos de ejemplo.</p><p>Inicio comprobado en 1440, 1366, 1024, 768, 390 y 360 px. Sin errores JavaScript ni desbordamiento horizontal; formularios accesibles mediante teclado. Animación normal activa y movimiento reducido sin bucles decorativos.</p>${names.map((name,i)=>`<section><h2>${titles[i]}</h2><div class="pair"><figure><figcaption>Antes · 2.0.0</figcaption><a href="before/${name}.png"><img loading="lazy" src="before/${name}.png" alt="Antes: ${titles[i]}"></a></figure><figure><figcaption>Después · 2.1.0</figcaption><a href="after/${name}.png"><img loading="lazy" src="after/${name}.png" alt="Después: ${titles[i]}"></a></figure></div></section>`).join('')}<section><h2>Mesa de cinco jugadores · datos de ejemplo</h2><img loading="lazy" src="after/10-board-5players-fixture.png" alt="Mesa de cinco jugadores con estudios y publicaciones de ejemplo"></section><section><h2>Personaje reservado · nuevo emblema</h2><p>Un libro y una estrella representan a la academia mientras su personaje permanece oculto. Al revelarse, conserva su ilustración original.</p><img style="max-width:540px" loading="lazy" src="after/11-reserved-player-detail.png" alt="Detalle de jugador con nuevo emblema de personaje reservado"></section><p><a href="after/results.json">Resultados visuales completos</a></p></html>`);
  }
  console.log(`PASS: ${checks.filter(c=>!['motion','portraits','board-fixture'].includes(c.name)).length} visual captures, 54 board fixtures; real room flow; no page errors or horizontal overflow. See fixture-findings.json for baseline layout observations.`);
} finally {await browser.close();}
