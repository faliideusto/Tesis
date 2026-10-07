// Browser fixtures only: this suite never contacts Supabase or a real account.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {customizationFixture} from './preview_customization.mjs';

const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'file:///C:/Users/radeu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out='target/qa-missions',staticRoot=resolve('src/main/resources/static');
await mkdir(out,{recursive:true});
const cosmetics=customizationFixture();cosmetics.inventario=[];
const profile={nombre:'Falio3',nivel:3,xp:1000,victorias:2,partidasTerminadas:7};
const season={id:'temporada:2026-10',nombre:'Crónicas del Archivo',inicio:'2026-09-30T22:00:00Z',fin:'2026-10-31T23:00:00Z',zonaHoraria:'Europe/Madrid',activa:true,gratuita:true};
const mission=(id,titulo,objetivo,progreso,xp,reclamada=false)=>({id,titulo,descripcion:`Completa el reto: ${titulo.toLowerCase()}.`,objetivo,progreso,xp,puntosPase:xp,completada:progreso>=objetivo,reclamada});
const missions={diarias:[mission('diaria_jugar','Juega una partida',1,1,50),mission('diaria_ganar','Gana una partida',1,0,75),mission('diaria_amigo','Forma tu círculo',1,1,40,true)],semanales:[mission('semanal_jugar','Juega tres partidas',3,2,100),mission('semanal_ganar','Gana tres partidas',3,3,150)],temporada:[mission('temporada_jugar','Investigador del Archivo',10,7,500),mission('temporada_ganar','Cronista de la Academia',5,5,600)],reinicioDiario:'2026-10-08T00:00:00Z',reinicioSemanal:'2026-10-12T00:00:00Z',reinicioTemporada:season.fin};
let points=450,failClaim=false,claimDelay=0,failMissionRead=false,failPassRead=false;const claims=[],errors=[],checks=[],geometry=[];
const rewards=Array.from({length:10},(_,index)=>({id:`archivo_nivel_${index+1}`,nombre:index===9?'Maestro del Archivo':cosmetics.catalogo.find(row=>row.nivel===index+1).cosmetico.nombre,nivel:index+1,cosmeticos:cosmetics.catalogo.filter(row=>row.nivel===index+1).map(row=>row.cosmetico),reclamada:index===0}));
cosmetics.inventario.push(...rewards[0].cosmeticos);
function pass(){const nivel=Math.min(10,1+Math.floor(points/500));return {temporada:season,progreso:{puntos:points,nivel,puntosSiguienteNivel:nivel===10?null:nivel*500,maxNivel:10,puntosPorNivel:500},recompensas:rewards.map(reward=>({...reward,desbloqueada:reward.nivel<=nivel}))};}
function collection(){cosmetics.temporadas=[{...season,nivel:pass().progreso.nivel,maxNivel:10,recompensasObtenidas:rewards.filter(row=>row.reclamada).length,totalRecompensas:10}];return cosmetics;}
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__qaAuth=fn},getSession:async()=>({data:{session:{access_token:'missions-qa',user:{id:'missions-qa'}}}}),signOut:async()=>({})}})};`;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(value):value);};
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/js/vendor/supabase-'))return send(200,sdk,'text/javascript');
  if(url.pathname==='/api/cuentas/config')return send(200,{habilitado:true,url:'http://127.0.0.1',publishableKey:'fixture'});
  if(url.pathname==='/api/config')return send(200,{jugadoresMinimos:3,jugadoresMaximos:5});
  if(url.pathname.startsWith('/api/')){
   assert.equal(req.headers.authorization,'Bearer missions-qa');
   if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw||'{}');
    if(url.pathname==='/api/presencia')return send(200,{activa:true});
    assert.equal(req.headers['x-tesis'],'1');claims.push({path:url.pathname,body});
    if(claimDelay)await new Promise(done=>setTimeout(done,claimDelay));
    if(failClaim)return send(503,{error:'QA reclamación temporalmente no disponible'});
    if(url.pathname==='/api/misiones/reclamar'){
     const item=[...missions.diarias,...missions.semanales,...missions.temporada].find(row=>row.id===body.id);
     if(!item?.completada)return send(400,{error:'Misión todavía incompleta'});
     if(!item.reclamada){item.reclamada=true;profile.xp+=item.xp;points+=item.puntosPase;}
     return send(200,missions);
    }
    if(url.pathname==='/api/pase/reclamar'){
     assert.equal(body.temporada,season.id);const item=rewards.find(row=>row.id===body.id);
     if(!item||item.nivel>pass().progreso.nivel)return send(400,{error:'Recompensa bloqueada'});
     if(!item.reclamada){item.reclamada=true;for(const cosmetic of item.cosmeticos)if(!cosmetics.inventario.some(row=>row.id===cosmetic.id))cosmetics.inventario.push(cosmetic);}
     return send(200,pass());
    }
   }
   if(url.pathname==='/api/perfil')return send(200,profile);
   if(url.pathname==='/api/invitaciones')return send(200,{invitaciones:[]});
   if(url.pathname==='/api/misiones')return failMissionRead?send(503,{error:'QA lectura misiones no disponible'}):send(200,missions);
   if(url.pathname==='/api/pase')return failPassRead?send(503,{error:'QA lectura pase no disponible'}):send(200,pass());
   if(url.pathname==='/api/cosmeticos')return send(200,collection());
   return send(404,{error:'Endpoint no implementado en fixture QA'});
  }
  const file=resolve(staticRoot,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(staticRoot+sep))return send(403,{});
  let content=await readFile(file);
  if(url.pathname==='/')content=content.toString().replace('</body>','<aside style="position:fixed;bottom:5px;right:8px;z-index:99999;border:1px solid #caa76a;background:#071624;color:#f5d690;padding:5px 10px;font:12px Georgia">QA local · datos simulados · sin Supabase</aside></body>');
  return send(200,content,mime[extname(file)]||'application/octet-stream');
 }catch(error){errors.push(error.message);return send(500,{error:'Fallo de fixture QA'});}
});
export async function startMissionsPreview(port=8140){await new Promise(done=>server.listen(port,'127.0.0.1',done));return server;}
async function runBrowserQa(){
await startMissionsPreview(0);
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce',timezoneId:'Europe/Madrid'}),page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).pathname.startsWith('/assets/'))errors.push(`Asset ${response.status()} ${response.url()}`);});
const card=id=>page.locator(`.mission-card[data-mission-id="${id}"]`);
const reward=id=>page.locator(`.mission-reward[data-reward-id="${id}"]`);
async function ready(){await page.locator('.mission-card').first().waitFor();}
async function shot(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 const box=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 assert(box.scrollWidth<=box.width+1,`${label}: overflow ${JSON.stringify(box)}`);
 assert.deepEqual(await page.locator('#account-panel img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)),[]);
 geometry.push({label,viewport:page.viewportSize(),...box});await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
try{
 await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
 await page.goto(`${base}/#misiones`);await ready();
 assert.equal(await page.locator('[data-season-countdown]').innerText(),'24 días · 11 h restantes');
 assert.equal(await card('diaria_jugar').count(),1);assert.equal(await card('diaria_amigo').count(),1);
 assert(await card('diaria_amigo').evaluate(node=>node.classList.contains('is-claimed')));
 for(const [width,height] of [[1672,941],[1366,768],[390,844]]){await page.setViewportSize({width,height});await shot(`missions-${width}`);}
 await page.setViewportSize({width:1672,height:941});
 for(const [period,count] of [['diarias',3],['semanales',2],['temporada',2],['todos',7]]){await page.locator(`[data-mission-period="${period}"]`).click();assert.equal(await page.locator('.mission-card').count(),count);}
 await page.locator('[data-mission-filter="reclamada"]').click();assert.equal(await page.locator('.mission-card').count(),1);await page.locator('[data-mission-filter="todos"]').click();
 claimDelay=300;const beforeMission=claims.length;
 await page.locator('[data-mission-claim="diaria_jugar"]').evaluate(button=>{button.click();button.click();});
 await page.waitForFunction(()=>document.querySelector('[data-mission-id="diaria_jugar"]')?.classList.contains('is-claimed'));
 assert.equal(claims.length,beforeMission+1,'Double click must produce one mission POST');assert.equal(points,500);assert.equal(pass().progreso.nivel,2);claimDelay=0;
 await page.locator('[data-rewards-toggle]').click();
 assert.equal(await page.locator('.missions-reward-track .mission-reward').count(),10);
 const xpBefore=profile.xp,pointsBefore=points;
 await page.locator('.missions-reward-track [data-season-claim="archivo_nivel_2"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-season-claim="archivo_nivel_2"]'));
 assert.equal(profile.xp,xpBefore);assert.equal(points,pointsBefore);assert(cosmetics.inventario.some(row=>row.id==='academia_avatar'));
 await shot('missions-reward-claimed');
 await page.reload();await ready();assert(await card('diaria_jugar').evaluate(node=>node.classList.contains('is-claimed')));assert.equal(points,500);
 failClaim=true;const beforeError=claims.length;await page.locator('[data-mission-claim="semanal_ganar"]').click();await page.getByText('QA reclamación temporalmente no disponible',{exact:false}).waitFor();await page.waitForTimeout(400);assert.equal(claims.length,beforeError+1,'No retry after failed claim');assert.equal(points,500);failClaim=false;
 points=4500;await page.reload();await ready();await page.locator('[data-rewards-toggle]').click();
 assert.equal(await page.locator('.missions-reward-track .mission-reward').count(),10);assert.equal(rewards[9].cosmeticos.length,3);
 const beforeBundleXp=profile.xp,beforeBundlePoints=points;await page.locator('.missions-reward-track [data-season-claim="archivo_nivel_10"]').click();await page.waitForFunction(()=>!document.querySelector('[data-season-claim="archivo_nivel_10"]'));
 assert.equal(profile.xp,beforeBundleXp);assert.equal(points,beforeBundlePoints);for(const id of ['archivo_maestro_marco','archivo_maestro_insignia','archivo_lanzamiento_libro'])assert(cosmetics.inventario.some(row=>row.id===id));
 await shot('missions-grand-prize');
 failMissionRead=true;failPassRead=true;
 await page.locator('[data-mission-claim="temporada_ganar"]').click();
 await page.getByText('QA lectura misiones no disponible',{exact:false}).waitFor();
 assert(await card('temporada_ganar').evaluate(node=>node.classList.contains('is-claimed')),'Claim response retained when subsequent GET fails');
 failMissionRead=false;failPassRead=false;
 await page.clock.setFixedTime(new Date('2026-10-31T22:59:00Z'));await page.reload();await ready();
 assert.equal(await page.locator('[data-season-countdown]').innerText(),'1 min restantes');
 await page.clock.setFixedTime(new Date('2026-10-31T23:00:00Z'));season.activa=false;await page.reload();await ready();
 assert.equal(await page.locator('[data-season-countdown]').innerText(),'Temporada finalizada');
 assert.equal(await page.locator('[data-season-claim]:not([disabled])').count(),0,'Expired season cannot be claimed');
 season.activa=true;await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
 await page.locator('[data-academy-page="profile"]').click();await page.locator('[data-customize]').click();await page.locator('.customization-grid').waitFor();
 for(const id of ['academia_avatar','archivo_maestro_marco','archivo_maestro_insignia','archivo_lanzamiento_libro'])assert(await page.locator(`.customization-grid [data-select="${id}"]`).evaluate(node=>node.classList.contains('is-owned')));
 await shot('missions-inventory-personalization');
 assert.equal(new Date(season.fin).toISOString(),'2026-10-31T23:00:00.000Z','Madrid November DST end instant');
 const assetPaths=new Set(cosmetics.catalogo.flatMap(row=>[row.cosmetico.asset,...Object.values(row.cosmetico.assets||{})]).filter(Boolean));
 assert.equal(assetPaths.size,13);for(const asset of assetPaths)assert((await context.request.get(base+asset)).ok(),`Definitive asset loads: ${asset}`);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/result.json`,JSON.stringify({fixtureOnly:true,checks,claims,geometry,errors,profile,pass:pass()},null,2));
 console.log(`Misiones: ${checks.length} capturas; estados, filtros, reclamación, inventario, persistencia y exclusión XP cosmético PASS (fixtures locales).`);
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.env.TESIS_MISSIONS_PREVIEW==='1'){const port=Number(process.env.TESIS_PREVIEW_PORT||8140);await startMissionsPreview(port);console.log(`QA local · datos simulados · http://127.0.0.1:${port}/#misiones`);}
 else await runBrowserQa();
}
