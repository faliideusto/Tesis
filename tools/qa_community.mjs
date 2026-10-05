// QA navegador local con Auth/RPC simulados. No usa cuentas ni servicios remotos.
// TESIS_PLAYWRIGHT: URL file del módulo instalado; TESIS_URL: servidor local.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-community';
await mkdir(out,{recursive:true});
const errors=[],calls=[],checks=[];
const code='AAAABBBBCCCCDDDD',friend='1111222233334444';
let profile={nombre:'Ana <Academia>',xp:350,nivel:1,partidasTerminadas:4,victorias:2};
let community={codigo:code,amigos:[],recibidas:[{codigo:friend,nombre:'Bruno <script>',nivel:2}],enviadas:[]};
let failFriends=false,failRanking=false;
let missions={reinicioDiario:'2030-10-07T00:00:00Z',reinicioSemanal:'2030-10-14T00:00:00Z',diarias:[
 {id:'diarias:jugar1:2030-10-06',titulo:'Juega una partida',objetivo:1,progreso:1,xp:50,completada:true,reclamada:false},
 {id:'diarias:ganar1:2030-10-06',titulo:'Gana una partida',objetivo:1,progreso:0,xp:75,completada:false,reclamada:false}],semanales:[
 {id:'semanales:jugar3:2030-09-30',titulo:'Juega tres partidas',objetivo:3,progreso:1,xp:100,completada:false,reclamada:false},
 {id:'semanales:jugar7:2030-09-30',titulo:'Juega siete partidas',objetivo:7,progreso:1,xp:200,completada:false,reclamada:false},
 {id:'semanales:ganar3:2030-09-30',titulo:'Gana tres partidas',objetivo:3,progreso:0,xp:150,completada:false,reclamada:false}]};
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.qaAuth=fn},getSession:async()=>({data:{session:{access_token:'local-qa-token',user:{id:'local-qa-user'}}}}),signOut:async()=>{window.qaAuth('SIGNED_OUT',null);return {}}}})};`;
async function shot(page,label){
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: desbordamiento horizontal`);
 checks.push(label);
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin){await route.abort();throw new Error('La QA no admite llamadas externas');}
  if(url.pathname==='/js/vendor/supabase-2.57.4.js'){await route.fulfill({contentType:'text/javascript',body:sdk});return;}
  if(url.pathname==='/api/cuentas/config'){await route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-public-placeholder'}});return;}
  if(!['/api/perfil','/api/comunidad','/api/amigos','/api/ranking','/api/misiones','/api/misiones/reclamar'].includes(url.pathname)){await route.continue();return;}
  calls.push({path:url.pathname,method:req.method(),body:req.postDataJSON()});
  assert.equal(req.headers().authorization,'Bearer local-qa-token');
  if(req.method()==='POST')assert.equal(req.headers()['x-tesis'],'1');
  if(url.pathname==='/api/perfil'){await route.fulfill({json:profile});return;}
  if(url.pathname==='/api/comunidad'){await route.fulfill({json:community});return;}
  if(url.pathname==='/api/amigos'){
   if(failFriends){await route.fulfill({status:400,json:{error:'Código desconocido de prueba'}});return;}
   const {codigo,accion}=req.postDataJSON();
   if(accion==='aceptar'){community.amigos=community.recibidas;community.recibidas=[];}
   if(accion==='eliminar')community.amigos=[];
   if(accion==='solicitar')community.enviadas=[{codigo,nombre:'Clara',nivel:1}];
   if(accion==='cancelar')community.enviadas=[];
   await route.fulfill({json:community});return;
  }
  if(url.pathname==='/api/ranking'){
   if(failRanking){await route.fulfill({status:503,json:{error:'Ranking temporalmente indisponible'}});return;}
   const own={posicion:72,codigo:code,nombre:profile.nombre,nivel:profile.nivel,xp:profile.xp,victorias:2,partidas:4,yo:true};
   await route.fulfill({json:{criterio:url.searchParams.get('criterio'),entradas:[{...own,posicion:1,codigo:friend,nombre:'Bruno <script>',yo:false}],propia:own}});return;
  }
  if(url.pathname==='/api/misiones/reclamar'){
   const mission=missions.diarias.find(m=>m.id===req.postDataJSON().id);
   assert(mission&&mission.completada&&!mission.reclamada,'Solo se reclama una recompensa pendiente');
   mission.reclamada=true;profile={...profile,xp:profile.xp+mission.xp};
  }
  await route.fulfill({json:missions});
 });
 await page.goto(base);await page.locator('#account-open.has-profile').waitFor();await page.locator('#account-open').click();
 await page.locator('[data-academy-page=friends]').click();await page.locator('#friend-own-code').waitFor();
 assert.equal(await page.locator('#friend-own-code').inputValue(),code);
 assert(await page.locator('.community-people').innerText().then(t=>t.includes('Bruno <script>')),'Nombre escapado como texto');
 assert.equal(await page.locator('.community-people script').count(),0);
 await shot(page,'friends-desktop');
 await page.locator('[data-friend-action=aceptar]').click();await page.locator('[data-friend-action=eliminar]').waitFor();
 failFriends=true;await page.locator('#friend-code').fill('FFFFFFFFFFFFFFFF');await page.locator('#friend-request button').click();
 await page.locator('[data-community-message]').filter({hasText:'Código desconocido'}).waitFor();
 assert.equal(await page.locator('#friend-code').inputValue(),'FFFFFFFFFFFFFFFF','Error conserva entrada');
 failFriends=false;await page.locator('#friend-request button').click();await page.locator('[data-friend-action=cancelar]').waitFor();
 await page.locator('[data-friend-action=cancelar]').click();await page.locator('[data-friend-action=cancelar]').waitFor({state:'detached'});
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-friend-action=eliminar]').click();assert.equal(community.amigos.length,1);
 page.once('dialog',dialog=>dialog.accept());await page.locator('[data-friend-action=eliminar]').click();await page.locator('[data-friend-action=eliminar]').waitFor({state:'detached'});
 await page.locator('[data-academy-page=ranking]').click();await page.locator('#ranking-criterion').waitFor();
 assert.equal(await page.locator('.ranking-position strong').innerText(),'#72');
 await page.locator('#ranking-criterion').focus();await page.locator('#ranking-criterion').selectOption('victorias');await page.locator('caption').filter({hasText:'Victorias'}).waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'ranking-criterion','Cambiar clasificación conserva foco');
 failRanking=true;await page.locator('#ranking-criterion').selectOption('partidas');await page.locator('[data-community-message]').filter({hasText:'indisponible'}).waitFor();
 assert.equal(await page.locator('#ranking-criterion').inputValue(),'victorias','Fallo mantiene criterio de la tabla vigente');
 failRanking=false;await page.locator('#ranking-criterion').selectOption('partidas');await page.locator('caption').filter({hasText:'Partidas terminadas'}).waitFor();
 await shot(page,'ranking-desktop');
 await page.locator('[data-academy-page=missions]').click();await page.locator('[data-claim-mission]').first().waitFor();
 assert.equal(await page.locator('[data-claim-mission]:disabled').count(),4);
 await page.locator('[data-claim-mission]').first().click();await page.locator('.mission-claimed').waitFor();
 assert.equal(calls.filter(c=>c.path==='/api/misiones/reclamar').length,1);
 assert.equal(await page.locator('[data-claim-mission]:disabled').count(),5);
 await shot(page,'missions-desktop');
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});
  for(const section of ['friends','ranking','missions']){
   await page.locator(`[data-academy-page=${section}]`).click();
   await page.locator('[data-community-content] h2').waitFor();
   await shot(page,`${section}-${width}`);
  }
 }
 await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement.id),'account-open');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,mutations:calls.filter(c=>c.method==='POST'),scope:'Interfaz real con SDK y respuestas HTTP simulados; sin Supabase remoto ni concurrencia SQL'},null,2));
 console.log(`PASS comunidad navegador: ${checks.length} capturas; amigos, ranking, misiones, errores, escape, teclado, 1440/390/360 px.`);
}finally{await browser.close();}
