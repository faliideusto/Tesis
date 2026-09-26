// TESIS_URL=http://localhost:8091 node tools/qa_article_boxes.mjs
// PLAYWRIGHT_MODULE may point to an installed playwright module.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({reducedMotion:'reduce'});
const output = 'target/qa-article-boxes';
await mkdir(output,{recursive:true});
const errors = [], results = [];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.TESIS_URL || 'http://localhost:8091');
  await page.evaluate(async()=>{
    const {board} = await import('/js/board.js');
    const {feedback} = await import('/js/feedback.js');
    const card = {indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,
      arte:'articulos/03_casos_controles.png',marco:'cartas/marco_articulo_comun.png'};
    window.drawArticles = (players,development,published)=>{
      const state = {bloqueada:false,yo:'Ana',actual:'Bruno',fase:'TURNO_JUGADOR',ronda:2,
        ideas:8,roles:5,accionesRestantes:0,seleccion:[],eventos:[],ganadores:[],acciones:[],mano:[card],
        jugadores:['Ana','Bruno','Clara','Diego','Elena','Félix'].slice(0,players).map(nombre=>({
          nombre,monedas:3,prestigio:3,cartas:2,publicados:published,rol:null,activo:nombre==='Bruno',
          estudios:Array.from({length:development+published},(_,indice)=>({indice,carta:card,
            trabajo:1,prestigioExtra:0,publicado:indice>=development}))}))};
      board(state); feedback(null,state);
    };
  });
  for (const [width,height] of [[1920,1080],[1672,941],[1366,768],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({width,height});
    for (const players of [2,3,4,5,6]) {
      for (const [development,published] of [[0,0],[1,0],[3,0],[2,1],[1,2],[0,3],[3,3],[5,5]]) {
        await page.evaluate(([n,d,p])=>drawArticles(n,d,p),[players,development,published]);
        const context = {width,height,players,development,published};
        const problems = await page.evaluate(()=>{
          const failures=[];
          if(document.documentElement.scrollWidth>innerWidth) failures.push('page overflow');
          if(innerWidth>=1000) {
            const notice=document.querySelector('.table-activity').getBoundingClientRect();
            const identity=document.querySelector('.local-panel').getBoundingClientRect();
            if(identity.top<notice.bottom+6) failures.push('identity overlaps notice');
            const hand=document.querySelector('#hand .game-card').getBoundingClientRect();
            const local=document.querySelector('.local-academy').getBoundingClientRect();
            if(local.bottom>hand.top) failures.push(['academy overlaps hand',local.bottom,hand.top]);
          }
          for(const tray of document.querySelectorAll('.academy-tray')) {
            const boxes=[...tray.querySelectorAll('.article-support')].map(e=>e.getBoundingClientRect());
            if(Math.abs(boxes[0].top-boxes[1].top)>1 || Math.abs(boxes[0].bottom-boxes[1].bottom)>1) failures.push('unaligned boxes');
            for(const group of tray.querySelectorAll('.article-group')) {
              const box=group.querySelector('.article-support').getBoundingClientRect();
              const heading=group.querySelector('h3');
              const label=heading.getBoundingClientRect();
              if(label.bottom>box.top || heading.scrollWidth>heading.clientWidth+1) failures.push('heading clipped');
              if(getComputedStyle(heading,'::after').content!=='none') failures.push('diamond decoration');
              for(const slot of group.querySelectorAll('.table-study-slot')) {
                const r=slot.getBoundingClientRect();
                if(r.bottom>box.bottom+1) failures.push(['card/status outside box',r.toJSON(),box.toJSON(),getComputedStyle(slot).width]);
              }
              const scroll=group.querySelector('.article-scroll');
              if(group.querySelectorAll('.table-study').length>3) {
                scroll.scrollLeft=scroll.scrollWidth;
                if(scroll.scrollLeft<=0) failures.push('crowded lane inaccessible');
              }
            }
          }
          return failures;
        });
        assert.deepEqual(problems,[],JSON.stringify(context));
        results.push(context);
        if(players===5 && [1920,1366,390].includes(width) && development+published===3) {
          await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
          await page.screenshot({path:`${output}/${width}-${development}-${published}.png`,fullPage:true});
        }
      }
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/results.json`,JSON.stringify({checks:results.length,errors,results},null,2));
  console.log(`PASS: ${results.length} article layouts; aligned boxes, readable headings, card containment and scrolling.`);
} finally { await browser.close(); }
