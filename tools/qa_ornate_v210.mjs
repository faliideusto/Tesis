// Fixture-only comparative QA: ornate plaques and every article visible without scrolling.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TESIS_URL||'http://localhost:8091',baseline=process.env.TESIS_ORNATE_BASELINE==='1';
const captureOnly=process.env.TESIS_ORNATE_CAPTURE_ONLY==='1';
const out=`target/qa-v210/ornate/${baseline?'before':'after'}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({reducedMotion:'reduce'});const errors=[],results=[],captures=[];page.on('pageerror',e=>errors.push(e.message));
if(baseline){const css=await readFile('target/qa-v210/ornate/premium-before.css');await page.route('**/css/premium.css',r=>r.fulfill({body:css,contentType:'text/css'}));const players=await readFile('target/qa-v210/ornate/players-before.js');await page.route('**/js/players.js',r=>r.fulfill({body:players,contentType:'text/javascript'}));}
try{
  await page.goto(base);await page.locator('#create-room').waitFor();
  await page.evaluate(async()=>{
    const {board}=await import('/js/board.js'),{feedback}=await import('/js/feedback.js');
    const card={indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,arte:'articulos/03_casos_controles.webp',marco:'cartas/marco_articulo_comun.webp'};
    window.drawOrnate=(players,articles)=>{const state={bloqueada:false,yo:'Ana',actual:'Bruno',fase:'TURNO_JUGADOR',ronda:2,ideas:8,roles:5,accionesRestantes:0,seleccion:[],eventos:[],ganadores:[],acciones:[],mano:[card],jugadores:['Ana','Bruno','Clara','Diego','Elena'].slice(0,players).map((nombre,i)=>({nombre,monedas:3,prestigio:3,cartas:2,publicados:articles,rol:i<=1?{indice:0,orden:5,nombre:'Decana',habilidad:'Inmune a las habilidades rivales. Automática.',arte:'personajes/05_decana.webp'}:null,activo:nombre==='Bruno',estudios:Array.from({length:articles*2},(_,indice)=>({indice,carta:{...card,indice},trabajo:1,prestigioExtra:0,publicado:indice>=articles}))}))};board(state);feedback(null,state);};
  });
  work: {
  for(const [width,height] of [[1920,1080],[1918,944],[1366,768],[1024,768],[768,1024],[390,844],[360,800]])for(const players of [3,4,5])for(const articles of [0,1,2,3,6,10,20]){
    if(captureOnly&&!(width===1918&&players===5&&articles===6))continue;
    await page.setViewportSize({width,height});await page.evaluate(([p,a])=>{drawOrnate(p,a);scrollTo(0,0)},[players,articles]);await page.mouse.move(0,300);
    const geometry=await page.evaluate(()=>{
      const failures=[],overlaps=[],paintOverlaps=[],rivalCards=[...document.querySelectorAll('.rival-studies .table-study')];
      const local=document.querySelector('.local-academy').getBoundingClientRect();
      if(document.documentElement.scrollWidth>innerWidth)failures.push('horizontal overflow');
      for(const support of document.querySelectorAll('.article-support')){const box=support.getBoundingClientRect();for(const slot of support.querySelectorAll('.table-study-slot')){const r=slot.getBoundingClientRect();if(r.bottom>box.bottom+1)failures.push('card/status outside support');if(r.left<box.left-1||r.right>box.right+1)failures.push('card outside support horizontally');}}
      for(const heading of document.querySelectorAll('.article-group h3'))if(heading.scrollWidth>heading.clientWidth+1)failures.push('heading text overflow');
      const activity=document.querySelector('.table-activity').getBoundingClientRect();for(const support of document.querySelectorAll('.article-support')){const r=support.getBoundingClientRect();if(Math.min(r.right,activity.right)-Math.max(r.left,activity.left)>2&&Math.min(r.bottom,activity.bottom)-Math.max(r.top,activity.top)>2)failures.push('activity overlaps article support');}
      for(const scroll of document.querySelectorAll('.article-scroll')){if(scroll.scrollWidth>scroll.clientWidth+1)failures.push('article lane has overflow');const s=scroll.getBoundingClientRect();for(const card of scroll.querySelectorAll('.table-study')){const r=card.getBoundingClientRect();if(r.left<s.left-1||r.right>s.right+1)failures.push('article not simultaneously visible');}}
      if(innerWidth>=1000){for(const tray of document.querySelectorAll('.rival-seat .rival-studies')){const r=tray.getBoundingClientRect();const w=Math.min(r.right,local.right)-Math.max(r.left,local.left),h=Math.min(r.bottom,local.bottom)-Math.max(r.top,local.top);if(w>2&&h>2)overlaps.push({player:tray.closest('.rival-seat').querySelector('.rival').dataset.player,width:w,height:h});}
        const own=[...document.querySelectorAll('#studies .article-support')].map(e=>e.getBoundingClientRect());for(const support of document.querySelectorAll('.rival-seat .article-support')){const r=support.getBoundingClientRect();for(const o of own){const w=Math.min(r.right,o.right)-Math.max(r.left,o.left),h=Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top);if(w>2&&h>2){failures.push('rival support overlaps local support');paintOverlaps.push({width:w,height:h});}}}
      }
      return{failures:[...new Set(failures)],overlaps,paintOverlaps,rivalCardWidth:rivalCards[0]?.getBoundingClientRect().width||null,localCardWidth:document.querySelector('#studies .table-study')?.getBoundingClientRect().width||null};
    });results.push({width,height,players,articles,...geometry});
    if([2,3].includes(articles)&&((players===5&&[1918,1366,390].includes(width))||(players===3&&width===1920))||[6,20].includes(articles)&&players===5&&width===1918){
      await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));const name=`${width}x${height}-${players}players-${articles===3?'mixed':articles+'pergroup'}-fixture`;await page.screenshot({path:`${out}/${name}.png`,fullPage:true});captures.push(name);
    }
    if(players===5&&articles===3){for(const selector of ['.rival','.local-role-button']){await page.locator(selector).first().scrollIntoViewIfNeeded();const anchor=await page.locator(selector).first().boundingBox();await page.mouse.move(anchor.x+5,anchor.y+5);const preview=selector==='.rival'?page.locator('.rival-seat .player-role-preview').first():page.locator('.local-panel .player-role-preview');await preview.waitFor({state:'visible'});const b=await preview.boundingBox();if(b.x<7||b.y<7||b.x+b.width>width-7||b.y+b.height>height-7)results.at(-1).failures.push('role preview outside viewport');await page.mouse.move(0,300);}if(width>=1000){const hit=await page.locator('.brand').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.brand')===e});if(!hit)results.at(-1).failures.push('logo hotspot inaccessible');}}
  }
  if(captureOnly){console.log('Captured 1918x944, five players, six articles per group fixture.');break work;}
  if(!baseline)for(const [width,height] of [[1920,1080],[1918,944],[1366,768],[1024,768],[768,1024],[390,844],[360,800]])for(const players of [3,4,5]){const sizes=results.filter(r=>r.width===width&&r.height===height&&r.players===players&&r.articles>0);for(let i=1;i<sizes.length;i++)if(sizes[i].rivalCardWidth>sizes[i-1].rivalCardWidth+1||sizes[i].localCardWidth>sizes[i-1].localCardWidth+1)sizes[i].failures.push('article size grows with count');}
  assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({fixture:true,checks:results.length,errors,results,captures},null,2));
  if(!baseline){const before=JSON.parse(await readFile('target/qa-v210/ornate/before/results.json','utf8'));const sizes=results.filter(r=>r.articles>0).map(r=>{const p=before.results.find(p=>p.width===r.width&&p.players===r.players&&p.articles===r.articles);return{...r,beforeWidth:p.rivalCardWidth,increasePercent:Math.round((r.rivalCardWidth/p.rivalCardWidth-1)*100)}});
    await writeFile('target/qa-v210/ornate/comparison.json',JSON.stringify(sizes,null,2));
    await writeFile('target/qa-v210/ornate/report.html',`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tesis · Placas y cartas rivales</title><style>body{background:#091522;color:#eee1ca;font:16px system-ui;padding:30px}h1,h2{color:#e8bd86;font-family:Georgia}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;height:auto}figure{margin:0}section{margin:40px 0}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>Placas ornamentales y cartas rivales</h1><p>Capturas de QA con jugadores y artículos de ejemplo. Comparación del diseño anterior frente a los marcos ornamentales y cartas rivales más grandes. Todas las zonas adaptan el tamaño al número de artículos, sin desplazamiento.</p>${captures.filter(n=>!n.includes('6pergroup')).map(n=>`<section><h2>${n.replaceAll('-',' ')}</h2><div class="pair"><figure><figcaption>Antes</figcaption><img src="before/${n}.png"></figure><figure><figcaption>Después</figcaption><img src="after/${n}.png"></figure></div></section>`).join('')}<section><h2>Seis artículos por zona · datos de ejemplo</h2><p>La misma mesa adapta el tamaño para mostrar todos los artículos a la vez.</p><img src="after/1918x944-5players-6pergroup-fixture.png" alt="Cinco jugadores con seis artículos en cada zona"></section><p><a href="comparison.json">Medidas y diagnósticos comparados</a></p></html>`);
  }
  console.log(JSON.stringify({baseline,checks:results.length,failedCases:results.filter(r=>r.failures.length).length,errors,captures}));
  }
}finally{await browser.close();}
