// Capture the real board with a varied five-player fixture.
// TESIS_URL and PLAYWRIGHT_MODULE can override the server and Playwright installation.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'});
const output='target/qa-reference-table';
await mkdir(output,{recursive:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.TESIS_URL || 'http://localhost:8091');
  await page.evaluate(async()=>{
    const {board}=await import('/js/board.js');
    const {feedback}=await import('/js/feedback.js');
    const cards=[
      ['Artículo Ecológico','01_ecologico',1,1,1],
      ['Artículo Transversal','02_transversal',2,1,2],
      ['Casos y Controles','03_casos_controles',2,2,3],
      ['Cohortes','04_cohortes',3,3,5],
      ['Revisión Sistemática','05_revision_sistematica',2,5,6],
      ['Ensayo Clínico Aleatorizado','06_ensayo_clinico_aleatorizado',4,4,7],
      ['Ensayo Comunitario','07_ensayo_comunitario',8,4,9]
    ].map(([nombre,art,coste,trabajo,prestigio],indice)=>({indice,nombre,coste,trabajo,prestigio,
      arte:`articulos/${art}.webp`,marco:`cartas/marco_articulo_${prestigio<=3?'comun':prestigio<=6?'raro':'epico'}.webp`}));
    const role=(nombre,arte,orden)=>({nombre,orden,indice:orden-1,arte:`personajes/${arte}.webp`,habilidad:'Una vez por turno.'});
    const configurations=[
      ['Jugador 5',3,0,role('Investigador Principal','04_investigador_principal',3)],
      ['Fali',2,1,role('Decana','05_decana',4)],
      ['Jugador 2',1,2,null],
      ['Jugador 3',1,2,null],
      ['Jugador 4',2,1,role('Comité de Ética','01_comite_etica',1)]
    ];
    window.referenceState={bloqueada:false,yo:'Jugador 5',actual:'Fali',fase:'TURNO_JUGADOR',ronda:3,
      ideas:8,roles:5,accionesRestantes:1,seleccion:[],eventos:[],ganadores:[],acciones:[],
      mano:[cards[5],cards[3],cards[0],cards[6],cards[1]],
      jugadores:configurations.map(([nombre,dev,pub,rol],i)=>({nombre,rol,monedas:i===0?0:i,cartas:i===0?5:i%2+1,
        publicados:pub,prestigio:pub*4,activo:nombre==='Fali',
        estudios:Array.from({length:dev+pub},(_,indice)=>{
          const carta=cards[(i*2+indice+4)%cards.length];
          return {indice,carta,trabajo:indice>=dev?carta.trabajo:Math.min(indice+1,carta.trabajo-1),
            prestigioExtra:0,publicado:indice>=dev};
        })}))};
    window.redrawReference=()=>{board(referenceState);feedback(null,referenceState);};
    redrawReference();
  });
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.mouse.move(0,0);
  await page.screenshot({path:`${output}/mesa-5-jugadores.png`});
  const checks=await page.evaluate(()=>{
    const problems=[];
    const rect=e=>e.getBoundingClientRect();
    const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    const seats=[...document.querySelectorAll('.rival-seat,.local-academy')];
    seats.forEach((seat,i)=>{
      seats.slice(i+1).forEach(other=>{if(overlap(rect(seat),rect(other)))problems.push('overlapping academies');});
      const panel=seat.querySelector('.rival-body'),r=rect(panel);
      for(const child of panel.children) {
        const c=rect(child);
        if(c.bottom>r.bottom+1||c.right>r.right+1)problems.push('plaque content clipped');
      }
    });
    if(document.querySelectorAll('.article-placeholder').length!==15)problems.push('wrong empty slot count');
    return problems;
  });
  await writeFile(`${output}/checks.json`,JSON.stringify({checks,errors},null,2));
  assert.deepEqual(checks,[]);
  assert.deepEqual(errors,[]);
  console.log(`PASS: five-player reference board. Screenshot: ${output}/mesa-5-jugadores.png`);
} finally {await browser.close();}
