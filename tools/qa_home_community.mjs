// Portada y navegación reales con Auth/HTTP simulados, sin servicios externos.
// Ejecutar contra servidor local: TESIS_URL, TESIS_PLAYWRIGHT y TESIS_CHROME opcionales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-home-community';
await mkdir(out,{recursive:true});
const errors=[],checks=[],calls=[];
const profile={nombre:'Ana <Academia>',xp:350,nivel:1,partidasTerminadas:4,victorias:2};
const session={access_token:'local-qa-token',user:{id:'local-qa-user'}};
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.qaAuth=fn},getSession:async()=>({data:{session:sessionStorage.getItem('qa.login')?${JSON.stringify(session)}:null}}),signInWithPassword:async()=>{sessionStorage.setItem('qa.login','1');const session=${JSON.stringify(session)};window.qaAuth('SIGNED_IN',session);return {data:{session}}},signOut:async()=>{sessionStorage.removeItem('qa.login');window.qaAuth('SIGNED_OUT',null);return {}}}})};`;
const room={codigo:'QA123',fase:'LOBBY',yo:'Ana',anfitrion:'Ana',soyAnfitrion:true,jugadores:['Ana'],revision:1,partida:null,progreso:{estado:'VINCULADA'}};
async function setup({signedIn=true,enabled=true,configFailure=false,rankingFailure=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 if(signedIn)await context.addInitScript(()=>sessionStorage.setItem('qa.login','1'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin){errors.push(`Solicitud externa: ${url.origin}`);await route.abort();return;}
  if(url.pathname==='/js/vendor/supabase-2.57.4.js'){await route.fulfill({contentType:'text/javascript',body:sdk});return;}
  if(url.pathname==='/api/cuentas/config'){await route.fulfill(configFailure?{status:503,json:{error:'QA desconectada'}}:{json:{habilitado:enabled,url:base,publishableKey:'qa-placeholder'}});return;}
  if(!url.pathname.startsWith('/api/')){await route.continue();return;}
  calls.push({path:url.pathname,method:req.method(),headers:req.headers(),body:req.postDataJSON()});
  if(url.pathname==='/api/perfil'){assert.equal(req.headers().authorization,'Bearer local-qa-token');await route.fulfill({json:profile});return;}
  if(url.pathname==='/api/comunidad'){await route.fulfill({json:{codigo:'AAAABBBBCCCCDDDD',amigos:[],recibidas:[],enviadas:[]}});return;}
  if(url.pathname==='/api/ranking'){await route.fulfill(rankingFailure?{status:503,json:{error:'Ranking temporalmente indisponible'}}:{json:{criterio:'xp',entradas:[],propia:null}});return;}
  if(url.pathname==='/api/misiones'){await route.fulfill({json:{reinicioDiario:'2030-10-07T00:00:00Z',reinicioSemanal:'2030-10-14T00:00:00Z',diarias:[],semanales:[]}});return;}
  if(url.pathname==='/api/salas'||url.pathname==='/api/salas/QA123/unirse'){assert.equal(req.headers()['x-tesis-account-authorization'],'Bearer local-qa-token');await route.fulfill({json:{codigo:'QA123',playerToken:'qa-room-token',sala:room}});return;}
  if(url.pathname==='/api/salas/QA123/estado'){assert.equal(req.headers().authorization,'Bearer qa-room-token');await route.fulfill({json:room});return;}
  errors.push(`API inesperada ${url.pathname}`);await route.fulfill({status:404,json:{error:'QA ruta inesperada'}});
 });
 return {context,page};
}
const routes={amigos:'friends',ranking:'ranking',misiones:'missions'};
async function section(page,name){await page.locator(`#account-panel[data-page="${name}"]`).waitFor();if(name==='friends')await page.locator('#friend-own-code').waitFor();if(name==='ranking')await page.locator('#ranking-criterion').waitFor();if(name==='missions')await page.locator('.mission-section').first().waitFor();if(name==='profile')await page.locator('.profile-identity').waitFor();}
async function shot(page,label){await page.screenshot({path:`${out}/${label}.png`,fullPage:true});if(label==='home-1440'||label==='home-390')await page.screenshot({path:`${out}/${label}.jpg`,fullPage:true,quality:85});checks.push(label);}
async function homeGeometry(page,width,height=width<500?844:1000){
 await page.setViewportSize({width,height});await page.locator('.home-community a').first().waitFor();
 const result=await page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const header=[...document.querySelectorAll('.home-nav-wordmark,.home-nav [data-command="help"],.home-nav #account-open')].map(rect);
  const cards=[...document.querySelectorAll('.home-community a')].map(rect);
  const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
  const nav=rect(document.querySelector('.home-nav')),logo=rect(document.querySelector('.home-header-logo')),copy=rect(document.querySelector('.home-copy')),setup=rect(document.querySelector('.setup-panel')),footer=rect(document.querySelector('.home-footer'));
  return {verticalOverflow:document.documentElement.scrollHeight>innerHeight+1,nav,logo,copy,setup,footer,overflow:document.documentElement.scrollWidth>innerWidth+1,header,cards,overlaps:header.some((a,i)=>header.slice(i+1).some(b=>overlap(a,b)))||cards.some((a,i)=>cards.slice(i+1).some(b=>overlap(a,b))),forms:[...document.querySelectorAll('#create-room,#join-room')].map(el=>el.id)};
 });
 assert.equal(result.overflow,false,`Inicio ${width}: overflow`);assert.equal(result.overlaps,false,`Inicio ${width}: solapamiento`);
 assert.equal(result.cards.length,3);for(const r of result.cards)assert(r.width>=44&&r.height>=44,`Inicio ${width}: destino táctil`);
 assert(result.logo.y>=result.nav.y&&result.logo.bottom<=result.nav.bottom,`Logo dentro de cabecera ${width}`);
 assert(result.nav.bottom<=result.copy.y,`Cabecera separada de contenido ${width}`);
 if(width>800){
  assert.equal(result.verticalOverflow,false,`Inicio ${width}x${height}: scroll vertical ${JSON.stringify(result)}`);
  assert(result.footer.y>=Math.max(result.copy.bottom,result.setup.bottom),`Pie separado del contenido ${width}x${height}`);
 }
 assert.deepEqual(result.forms,['create-room','join-room']);await shot(page,height===1000||width<500?`home-${width}`:`home-${width}x${height}`);
}
try{
 const {context,page}=await setup();await page.goto(base);await page.locator('#account-open.has-profile').waitFor();
 for(const width of [1440,1024,768,390,360])await homeGeometry(page,width);
 for(const [width,height] of [[1920,1080],[1536,864],[1440,900],[1366,768],[1280,720],[1152,648],[1024,768],[1024,600]])await homeGeometry(page,width,height);
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#create-name').fill('Borrador crear');await page.locator('#join-name').fill('Borrador entrar');await page.locator('#join-code').fill('QA123');
 for(const [hash,name] of Object.entries(routes)){
  const link=page.locator(`.home-community a[href="#${hash}"]`);await page.keyboard.press('Tab');await link.focus();assert.equal(await link.evaluate(el=>document.activeElement===el),true);
  assert.equal(await link.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true,`${hash}: foco visible`);
  await page.keyboard.press('Enter');await section(page,name);assert.equal(new URL(page.url()).hash,`#${hash}`);
  await page.locator('.account-close').click();await page.locator('#account-panel').waitFor({state:'hidden'});
  assert.equal(await link.evaluate(el=>document.activeElement===el),true,`${hash}: devuelve foco al enlace`);
  assert.equal(await page.locator('#create-name').inputValue(),'Borrador crear');assert.equal(await page.locator('#join-name').inputValue(),'Borrador entrar');assert.equal(await page.locator('#join-code').inputValue(),'QA123');
 }
 await page.locator('.home-community a[href="#ranking"]').click();await section(page,'ranking');await page.goBack();await page.locator('#account-panel').waitFor({state:'hidden'});await page.goForward();await section(page,'ranking');
 await page.locator('[data-academy-page="missions"]').click();await section(page,'missions');assert.equal(new URL(page.url()).hash,'#misiones');
 await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});await page.locator('#account-open').click();await section(page,'profile');assert.equal(new URL(page.url()).hash,'#perfil');
 await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});
 for(const [hash,name] of Object.entries(routes)){await page.goto(`${base}/#${hash}`);await section(page,name);await page.reload();await section(page,name);await page.locator('.account-close').click();await page.locator('#account-panel').waitFor({state:'hidden'});assert.equal(new URL(page.url()).hash,'');}
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});
  for(const [hash,name] of Object.entries(routes)){
   await page.locator(`.home-community a[href="#${hash}"]`).click();await section(page,name);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${hash} ${width}: overflow`);
   await shot(page,`${hash}-${width}`);await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 checks.push('keyboard-focus-return-history-profile-direct-reload-drafts');
 // Formularios originales y regreso de sala con identidad conservada.
 await page.locator('#create-name').fill('Ana');await page.locator('#create-room button').click();await page.locator('.room-code').waitFor();assert.equal(await page.locator('.home-community').count(),0,'Comunidad solo en portada');
 await page.locator('[data-command="home"]').click();await page.locator('[data-command="resume"]').waitFor();await page.locator('.home-community a[href="#amigos"]').click();await section(page,'friends');await page.locator('.account-close').click();await page.locator('#account-panel').waitFor({state:'hidden'});await page.locator('[data-command="resume"]').click();await page.locator('.room-code').waitFor();
 await page.locator('[data-command="home"]').click();await homeGeometry(page,1024,600);await page.locator('#join-code').fill('qa123');await page.locator('#join-name').fill('Ana');await page.locator('#join-room button').click();await page.locator('.room-code').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')).playerToken),'qa-room-token');checks.push('create-join-resume-room-identity');await context.close();
 for(const [hash,name] of Object.entries(routes)){
  const guest=await setup({signedIn:false});await guest.page.goto(`${base}/#${hash}`);await guest.page.locator('#account-login').waitFor();await guest.page.locator('[name="email"]').fill('qa@example.test');await guest.page.locator('[name="password"]').fill('password-qa');await guest.page.locator('#account-login button').click();await section(guest.page,name);assert.equal(new URL(guest.page.url()).hash,`#${hash}`);checks.push(`guest-login-${hash}`);await guest.context.close();
 }
 const unavailable=await setup({signedIn:false,enabled:false});await unavailable.page.goto(`${base}/#amigos`);await unavailable.page.locator('.account-availability').waitFor();assert.equal(await unavailable.page.locator('.community-panel').count(),0);await unavailable.page.locator('.account-close').click();await unavailable.page.locator('#create-room').waitFor();checks.push('accounts-unavailable');await unavailable.context.close();
 const disconnected=await setup({signedIn:false,configFailure:true});await disconnected.page.goto(`${base}/#misiones`);await disconnected.page.getByText('La academia está desconectada',{exact:true}).waitFor();assert.equal(await disconnected.page.locator('.community-panel').count(),0);await disconnected.page.locator('.account-close').click();await disconnected.page.locator('#account-panel').waitFor({state:'hidden'});await disconnected.page.locator('.home-community a[href="#ranking"]').click();await disconnected.page.getByText('La academia está desconectada',{exact:true}).waitFor();assert.equal(await disconnected.page.locator('#account-login').count(),0);checks.push('accounts-config-error-direct-and-link');await disconnected.context.close();
 const failed=await setup({rankingFailure:true});await failed.page.goto(`${base}/#ranking`);await failed.page.locator('[data-community-message]').filter({hasText:'indisponible'}).waitFor();await shot(failed.page,'ranking-error');await failed.context.close();
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,calls:calls.map(({headers,...rest})=>rest),scope:'Frontend real + HTTP/Auth simulados localmente. Sin Supabase remoto ni reglas motor.'},null,2));
 console.log(`PASS portada/comunidad: ${checks.length} comprobaciones; responsive, teclado/foco, history, auth/error y formularios/sala.`);
}finally{await browser.close();}
