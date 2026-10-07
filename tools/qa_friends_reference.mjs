// Navegador real con Auth y HTTP simulados: no crea cuentas ni contactos remotos.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-friends-reference';
await mkdir(out,{recursive:true});
const code='61F6F7E9EFE94792',errors=[],calls=[],checks=[],geometry=[];
const person=(nombre,nivel,index,enLinea=false)=>({nombre,nivel,codigo:index.toString(16).padStart(16,'0').toUpperCase(),enLinea});
const candidates=[person('ValeriaNox',10,1),person('DrakeSol',5,2),person('LyraAeterna',20,3),person('KaelArden',35,4),person('Irene',50,5),person('Marcos',75,6)];
let community={codigo:code,amigos:[],recibidas:[],enviadas:[],sugerencias:structuredClone(candidates),presenciaDisponible:true},failFriends=false,failCommunity=false,delayCommunity=0;
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__emit=fn},getSession:async()=>({data:{session:window.__signedOut?null:{access_token:'qa-token',user:{id:window.__identity||'qa-user'}}}}),signOut:async()=>{window.__signedOut=true;window.__emit('SIGNED_OUT',null);return {}}}})};`;
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});
const page=await context.newPage();
await page.clock.install();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).pathname.startsWith('/assets/'))errors.push(`Asset ${response.status()}: ${response.url()}`);});
await page.addInitScript(()=>{window.__qaCsp=[];document.addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('QA portapapeles denegado');}}});});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin!==new URL(base).origin)return route.abort();
 if(url.pathname.startsWith('/js/vendor/supabase-'))return route.fulfill({contentType:'text/javascript',body:sdk});
 if(url.pathname==='/api/cuentas/config')return route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-placeholder'}});
 if(url.pathname==='/api/perfil')return route.fulfill({json:{nombre:'Falio3',nivel:1,xp:0,partidasTerminadas:0,victorias:0}});
 if(['/api/comunidad','/api/amigos','/api/presencia'].includes(url.pathname)){
  calls.push({path:url.pathname,method:req.method(),body:req.postDataJSON()});
  assert.equal(req.headers().authorization,'Bearer qa-token');
  if(req.method()==='POST')assert.equal(req.headers()['x-tesis'],'1');
  if(url.pathname==='/api/presencia')return route.fulfill({json:{activa:true}});
  if(url.pathname==='/api/comunidad'){
   const snapshot=structuredClone(community);if(delayCommunity)await new Promise(resolve=>setTimeout(resolve,delayCommunity));
   return route.fulfill(failCommunity?{status:503,json:{error:'QA comunidad no disponible'}}:{json:snapshot});
  }
  if(failFriends)return route.fulfill({status:400,json:{error:'Código desconocido de prueba'}});
  const {codigo,accion}=req.postDataJSON();
  const found=[...community.sugerencias,...community.recibidas,...community.enviadas,...community.amigos].find(p=>p.codigo===codigo)||person('Nueva investigadora',1,7);
  if(accion==='solicitar'){community.enviadas.push({...found,codigo});community.sugerencias=community.sugerencias.filter(p=>p.codigo!==codigo);}
  if(accion==='aceptar'){community.amigos.push({...found,enLinea:false});community.recibidas=community.recibidas.filter(p=>p.codigo!==codigo);}
  if(accion==='rechazar')community.recibidas=community.recibidas.filter(p=>p.codigo!==codigo);
  if(accion==='cancelar')community.enviadas=community.enviadas.filter(p=>p.codigo!==codigo);
  if(accion==='eliminar')community.amigos=community.amigos.filter(p=>p.codigo!==codigo);
  return route.fulfill({json:community});
 }
 return route.continue();
});
async function capture(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: desbordamiento horizontal`);
 assert.deepEqual(await page.locator('#account-panel img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)),[],`${label}: imágenes rotas`);
 assert.deepEqual(await page.evaluate(()=>window.__qaCsp),[],`${label}: CSP`);
 assert(await page.evaluate(()=>{const list=document.querySelector('.community-friend-grid'),suggestions=document.querySelector('.friend-suggestions');return [...list.children].every(node=>node.getBoundingClientRect().bottom<=suggestions.getBoundingClientRect().top+1);}),`${label}: paneles de contactos solapados con sugerencias`);
 geometry.push({label,viewport:page.viewportSize(),boxes:await page.locator('.community-heading,.friend-invite,.community-friend-grid,.friends-stats,.friend-suggestions').evaluateAll(nodes=>nodes.map(node=>({selector:node.className,...Object.fromEntries(['x','y','width','height'].map(key=>[key,node.getBoundingClientRect()[key]]))})))});
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
async function refresh(){await page.locator('[data-community-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-community-content]')?.parentElement.getAttribute('aria-busy')==='false');}
try{
 await page.goto(`${base}/#amigos`);await page.locator('#friend-own-code').waitFor();
 assert.equal(await page.locator('#friend-own-code').inputValue(),code);
 if(process.env.TESIS_DEBUG_GEOMETRY)console.log(JSON.stringify(await page.locator('.community-friend-grid,.friend-list-panel,.friend-empty-copy,.friend-empty-scene,[data-friend-list-body]').evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return {selector:node.className,x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,minHeight:s.minHeight,height:s.height,position:s.position,gridTemplate:s.gridTemplateRows,flex:s.flex};})),null,2));
 for(const kind of ['friends','received','sent','online'])assert.equal(await page.locator(`.friend-stat-${kind} strong`).innerText(),'0');
 assert.equal(await page.locator('.friend-suggestion-grid li').count(),4);
 for(const width of [1672,1440,1280,390,360]){await page.setViewportSize({width,height:width>400?941:844});await capture(`friends-empty-${width}`);}
 await page.setViewportSize({width:1672,height:941});
 const firstSuggestion=await page.locator('.friend-suggestion-grid li').first().innerText();
 await page.locator('[data-suggestions-next]').first().click();assert.notEqual(await page.locator('.friend-suggestion-grid li').first().innerText(),firstSuggestion);
 await page.locator('[data-suggestions-prev]').click();assert.equal(await page.locator('.friend-suggestion-grid li').first().innerText(),firstSuggestion);
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
 await page.locator('[data-share-code]').click();await page.locator('[data-community-message]').filter({hasText:'manualmente'}).waitFor();
 // Copiar sin API disponible debe seleccionar el código, sin falsos positivos.
 await page.locator('[data-copy-code]').click();
 await page.locator('[data-community-message]').filter({hasText:'manualmente'}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'friend-own-code');
 community={codigo:code,amigos:[person('Bruno <script>',10,11,true),person('Clara',35,12,false)],recibidas:[person('Solicitud entrante',5,13)],enviadas:[person('Solicitud enviada',20,14)],sugerencias:structuredClone(candidates),presenciaDisponible:true};
 await refresh();await page.locator('[data-friend-action=eliminar]').first().waitFor();
 assert.equal(await page.locator('.friend-stat-online strong').innerText(),'1');
 assert.equal(await page.locator('.community-people script').count(),0,'Alias debe escaparse');
 assert((await page.locator('[data-community-content]').innerText()).includes('Bruno <script>'));
 await capture('friends-populated-1672');
 const search=page.locator('#friend-search');
 {
  await search.fill('Bruno');assert.equal(await page.locator('[data-friend-action=eliminar]').count(),1);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'friend-search');
  await page.locator('#friend-code').fill('1234BORRADOR');await search.focus();await refresh();assert.equal(await search.inputValue(),'Bruno');assert.equal(await page.locator('#friend-code').inputValue(),'1234BORRADOR');
  await search.focus();await search.evaluate(node=>node.setSelectionRange(1,3));community.amigos[1].enLinea=true;
  await page.clock.fastForward(31000);await page.locator('.friend-stat-online strong').filter({hasText:'2'}).waitFor();
  assert.equal(await search.inputValue(),'Bruno');assert.equal(await page.locator('#friend-code').inputValue(),'1234BORRADOR');assert.equal(await page.evaluate(()=>document.activeElement.id),'friend-search');assert.deepEqual(await search.evaluate(node=>[node.selectionStart,node.selectionEnd]),[1,3]);
  await search.fill('ZZZZ');assert.equal(await page.locator('[data-friend-action=eliminar]').count(),0);await search.fill('');
 }
 failFriends=true;await page.locator('#friend-code').fill('FFFFFFFFFFFFFFFF');await page.locator('#friend-request button.gold-button').click();await page.locator('[data-community-message]').filter({hasText:'Código desconocido'}).waitFor();assert.equal(await page.locator('#friend-code').inputValue(),'FFFFFFFFFFFFFFFF');failFriends=false;
 await page.locator('[data-friend-action=aceptar]').click();await page.locator('[data-friend-action=aceptar]').waitFor({state:'detached'});assert.equal(community.amigos.length,3);
 await page.locator('[data-friend-action=cancelar]').first().click();assert.equal(community.enviadas.length,0);
 const suggested=page.locator('[data-friend-action=solicitar]').first();
 {
  const chosen=await suggested.getAttribute('data-code'),before=calls.filter(c=>c.path==='/api/amigos').length;
  await suggested.dblclick().catch(()=>{});await page.locator(`[data-friend-action=cancelar][data-code="${chosen}"]`).waitFor();
  assert.equal(calls.filter(c=>c.path==='/api/amigos').length-before,1,'Un doble clic produce una sola mutación');assert(!community.sugerencias.some(p=>p.codigo===chosen));
 }
 for(const width of [390,360]){await page.setViewportSize({width,height:844});await capture(`friends-populated-${width}`);}
 community={codigo:code,amigos:Array.from({length:100},(_,i)=>person(`Investigador ${i+1}`,1,i+100)),recibidas:[],enviadas:[],sugerencias:structuredClone(candidates),presenciaDisponible:true};await refresh();
 assert.equal(await page.locator('.friend-stat-friends strong').innerText(),'100');assert(await page.locator('#friend-request button.gold-button').isDisabled(),'Límite de contactos bloquea nueva solicitud');
 await capture('friends-limit-360');
 community={codigo:code,amigos:[],recibidas:[],enviadas:[],sugerencias:[],presenciaDisponible:true};await refresh();await capture('friends-no-suggestions-360');
 community.presenciaDisponible=false;await refresh();assert.equal(await page.locator('.friend-stat-online strong').innerText(),'—','Legacy no afirma presencia disponible');await capture('friends-presence-unavailable-360');community.presenciaDisponible=true;
 await page.reload();await page.locator('#friend-own-code').waitFor();assert.equal(new URL(page.url()).hash,'#amigos');
 failCommunity=true;await refresh();await page.locator('[data-community-message]').filter({hasText:'no disponible'}).waitFor();failCommunity=false;
 delayCommunity=800;await page.locator('[data-community-refresh]').click();await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});await page.waitForTimeout(900);assert.equal(await page.locator('#account-panel').isVisible(),false);delayCommunity=0;
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,calls,geometry,scope:'Chrome real; Auth/comunidad/presencia simulados, sin Supabase remoto'},null,2));
 console.log(`PASS Amigos referencia: ${checks.length} capturas, dimensiones, assets, CSP, mutaciones, errores y navegación.`);
}finally{await browser.close();}
