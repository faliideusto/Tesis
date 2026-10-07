// UI real con SDK y API de cuentas simulados; no consulta Supabase remoto.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8092',out='target/qa-ranking-reference';await mkdir(out,{recursive:true});
const code='61F6F7E9EFE94792',errors=[],checks=[],calls=[],geometry=[];
const entry=(posicion,nombre,nivel,xp,victorias,partidas,id,yo=false)=>({posicion,nombre,nivel,xp,victorias,partidas,codigo:yo?code:id.toString(16).padStart(16,'0').toUpperCase(),yo});
const all=[entry(1,'AetherNoir',20,9500,18,32,1),entry(2,'LyriaAeterna',10,4500,9,21,2),entry(3,'DrakeSol',5,2000,6,15,3),entry(4,'Falio3',1,350,0,4,4,true),entry(5,'KaelArden',1,350,0,4,5)];
let rows=structuredClone(all),own=rows[3],failure=false,delay=0,rolled=false;
const period=scope=>scope==='temporada'?{id:'2026-10',inicio:'2026-09-30T22:00:00Z',fin:'2026-12-31T23:00:00Z',zonaHoraria:'Europe/Madrid'}:scope==='semanal'?(rolled?{id:'2026-10-12',inicio:'2026-10-11T22:00:00Z',fin:'2026-10-18T22:00:00Z',zonaHoraria:'Europe/Madrid'}:{id:'2026-10-05',inicio:'2026-10-04T22:00:00Z',fin:'2026-10-11T22:00:00Z',zonaHoraria:'Europe/Madrid'}):null;
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__qaAuth=fn},getSession:async()=>({data:{session:window.__qaOut?null:{access_token:'qa-token',user:{id:'qa-user'}}}}),signOut:async()=>{window.__qaOut=true;window.__qaAuth('SIGNED_OUT',null);return {}}}})};`;
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'}),page=await context.newPage();
await page.clock.install({time:new Date('2026-10-07T10:00:00Z')});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/assets/'))errors.push(`Asset ${r.status()}: ${r.url()}`);});
await page.addInitScript(()=>{window.__qaCsp=[];document.addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();
 if(url.pathname.startsWith('/js/vendor/supabase-'))return route.fulfill({contentType:'text/javascript',body:sdk});
 if(url.pathname==='/demo.css')return route.fulfill({contentType:'text/css',body:'#friends-demo{display:none}'});
 if(url.pathname==='/api/cuentas/config')return route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-placeholder'}});
 if(url.pathname==='/api/perfil')return route.fulfill({json:{nombre:'Falio3',nivel:1,xp:350,partidasTerminadas:4,victorias:0}});
 if(url.pathname==='/api/presencia')return route.fulfill({json:{activa:true}});
 if(url.pathname==='/api/invitaciones')return route.fulfill({json:{invitaciones:[]}});
 if(url.pathname==='/api/comunidad')return route.fulfill({json:{codigo:code,amigos:[],recibidas:[],enviadas:[],sugerencias:[],presenciaDisponible:true}});
 if(url.pathname==='/api/perfil-publico'){
  const person=all.find(p=>p.codigo===url.searchParams.get('codigo'));assert(person);return route.fulfill({json:{...person,partidasTerminadas:person.partidas,presenciaDisponible:false,enLinea:false}});
 }
 if(url.pathname==='/api/ranking'){
  assert.equal(req.headers().authorization,'Bearer qa-token');calls.push({url:req.url(),method:req.method()});const ambito=url.searchParams.get('ambito')||'global',criterio=url.searchParams.get('criterio')||'xp',snapshot={ambito,criterio,entradas:structuredClone(rows),propia:own?structuredClone(own):null,periodo:period(ambito)};
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return route.fulfill(failure?{status:503,json:{error:'QA ranking temporalmente no disponible'}}:{json:snapshot});
 }
 return route.continue();
});
async function ready(){await page.waitForFunction(()=>document.querySelector('.community-panel')?.getAttribute('aria-busy')==='false');}
async function refresh(){await page.locator('[data-community-refresh]').click();await ready();}
async function capture(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: overflow horizontal`);
 assert.deepEqual(await page.locator('#account-panel img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)),[]);
 assert.deepEqual(await page.evaluate(()=>window.__qaCsp),[]);
 if(process.env.TESIS_DEBUG_GEOMETRY&&label==='ranking-reference-1672')console.log(JSON.stringify(await page.locator('.ranking-controls,.ranking-scope-tabs,.ranking-scope-tabs button,.ranking-sort-controls,#ranking-criterion,.ranking-sort-controls button,.ranking-podium,.ranking-table th,.ranking-table td').evaluateAll(nodes=>nodes.slice(0,21).map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return {selector:node.className||node.tagName,y:r.y,h:r.height,marginTop:s.marginTop,marginBottom:s.marginBottom,padding:s.padding,minHeight:s.minHeight,font:s.font};})),null,2));
 const badges=await page.locator('.ranking-table .profile-badge,.ranking-podium .profile-badge').evaluateAll(nodes=>nodes.map(node=>({className:node.className,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));assert(badges.every(b=>b.height<=160),`${label}: emblemas gigantes`);
 geometry.push({label,viewport:page.viewportSize(),badges,boxes:await page.locator('.ranking-podium,.ranking-table,.ranking-controls,.ranking-layout').evaluateAll(nodes=>nodes.map(node=>({selector:node.className,...Object.fromEntries(['x','y','width','height'].map(k=>[k,node.getBoundingClientRect()[k]]))})))});
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
try{
 await page.goto(`${base}/#ranking`);await page.locator('#ranking-criterion').waitFor();await ready();
 assert.equal(await page.locator('.ranking-table tbody tr').count(),5);assert((await page.locator('.ranking-self').innerText()).includes('Falio3'));
 assert.deepEqual(await page.locator('.ranking-podium .public-person strong').allInnerTexts(),['LyriaAeterna','AetherNoir','DrakeSol'],'Podio muestra orden visual 2/1/3');
 for(const width of [1672,1680,390,360]){await page.setViewportSize({width,height:width>400?941:844});await capture(`ranking-reference-${width}`);}
 await page.setViewportSize({width:1672,height:941});
 for(const scope of ['amigos','semanal','temporada','global']){
  await page.locator(`[data-ranking-scope=${scope}]`).click();await ready();assert.equal(new URL(calls.at(-1).url).searchParams.get('ambito'),scope);await capture(`ranking-${scope}-1672`);
  assert.deepEqual((await page.locator('.ranking-stat-grid article strong').allInnerTexts()).slice(1,4),['350','0','4'],'Totales propios vitalicios conservados en cada ámbito');
  if(scope==='temporada'||scope==='semanal'){const countdown=page.locator('.ranking-period-info [data-countdown-end]');assert.equal(await countdown.getAttribute('data-countdown-end'),period(scope).fin);const before=await countdown.innerText();await page.clock.runFor(2000);assert.notEqual(await countdown.innerText(),before,'Ranking period countdown changes every second');assert(!/Europe\/Madrid|zona horaria|Se actualiza|1 nov/.test(await page.locator('.ranking-period-info').innerText()));}
 }
 await page.locator('[data-ranking-scope=semanal]').click();await ready();const beforeRollover=calls.length;rolled=true;await page.clock.setSystemTime(new Date('2026-10-11T22:00:10Z'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.querySelector('.ranking-period-info [data-countdown-end]')?.getAttribute('data-countdown-end')==='2026-10-18T22:00:00Z');assert(calls.length>beforeRollover,'Fin de semana refresca clasificación abierta');await page.locator('[data-ranking-scope=global]').click();await ready();
 await page.locator('#ranking-criterion').focus();await page.locator('#ranking-criterion').selectOption('victorias');await ready();assert.equal(new URL(calls.at(-1).url).searchParams.get('criterio'),'victorias');assert.equal(await page.evaluate(()=>document.activeElement.id),'ranking-criterion');
 failure=true;await page.locator('#ranking-criterion').selectOption('partidas');await page.locator('[data-community-message]').filter({hasText:'QA ranking temporalmente'}).waitFor();assert.equal(await page.locator('#ranking-criterion').inputValue(),'victorias');failure=false;await refresh();
 const person=page.locator('.ranking-table [data-public-profile]').first();await person.click();await page.locator('.public-researcher-card h3').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#account-panel').isVisible(),true);assert(await person.evaluate(node=>node===document.activeElement));
 for(const count of [0,1,2]){rows=all.slice(0,count);own=null;await refresh();assert.equal(await page.locator('.ranking-table tbody tr').count(),count);await capture(`ranking-${count}-entries-1672`);}
 rows=all.slice(0,3);own={...all[3],posicion:72};await refresh();assert.equal(await page.locator('.ranking-table tbody tr').count(),3);assert.equal(await page.locator('.ranking-self').count(),0);assert((await page.locator('[data-community-content]').innerText()).includes('72'));await capture('ranking-own-outside-1672');
 rows=[{...all[0],posicion:1},{...all[1],posicion:1}];own=null;await refresh();assert.deepEqual(await page.locator('.ranking-table tbody th[scope=row]').allInnerTexts().then(values=>values.map(v=>v.replace(/❧/g,'').trim())),['1','1'],'Los puestos recibidos se conservan en empate');assert.deepEqual(await page.locator('.podium-placement').allInnerTexts(),['1','1'],'Podio conserva los puestos recibidos');await capture('ranking-ties-1672');
 rows=Array.from({length:50},(_,i)=>entry(i+1,`Investigador ${i+1}`,1,Math.max(0,490-i*5),0,4,i+100));own=null;await refresh();
 const scroll=page.locator('.ranking-scroll');assert.equal(await page.locator('.ranking-table tbody tr').count(),50);assert(await scroll.evaluate(node=>node.scrollHeight>node.clientHeight&&node.clientHeight<=285),'Tabla de 50 personas conserva límite vertical de 285px');
 await scroll.focus();assert(await scroll.evaluate(node=>node===document.activeElement));await page.keyboard.press('PageDown');await page.waitForTimeout(250);assert(await scroll.evaluate(node=>node.scrollTop>0),'PageDown mueve la clasificación enfocada');await page.keyboard.press('Control+End');await page.waitForTimeout(250);assert(await scroll.evaluate(node=>node.scrollTop+node.clientHeight>=node.scrollHeight-2),'Teclado permite acceder a la última fila');assert(await scroll.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Tabla de escritorio no desborda horizontalmente');await capture('ranking-50-entries-1672');
 delay=700;await page.locator('[data-community-refresh]').click();await page.locator('[data-academy-page=friends]').click();await page.locator('#friend-own-code').waitFor();await page.waitForTimeout(850);assert.equal(await page.locator('.ranking-table').count(),0,'Respuesta tardía no restaura ranking');delay=0;
 await page.locator('[data-academy-page=ranking]').click();await page.locator('#ranking-criterion').waitFor();delay=700;await page.locator('[data-community-refresh]').click();await page.evaluate(()=>{window.__qaOut=true;window.__qaAuth('SIGNED_OUT',null);});await page.locator('#account-login').waitFor();await page.waitForTimeout(850);assert.equal(await page.locator('.ranking-table').count(),0,'Logout invalida respuesta pendiente');
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,calls,errors,geometry,scope:'Chrome real; Auth/API ranking y perfiles simulados; no Supabase remoto'},null,2));console.log(`PASS ranking referencia: ${checks.length} capturas; ámbitos, orden, errores, escasez, puestos, modal y respuestas tardías.`);
}finally{await browser.close();}
