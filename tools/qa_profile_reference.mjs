// Comparación visual con la referencia: datos simulados, sin cuentas remotas.
// TESIS_URL, TESIS_PLAYWRIGHT (URL file del módulo) y TESIS_CHROME opcionales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-profile-reference';
await mkdir(out,{recursive:true});
const errors=[],checks=[],geometry=[];
const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__emit=fn},getSession:async()=>({data:{session:{access_token:'qa-token',user:{id:'qa-user'}}}}),signOut:async()=>{window.__emit('SIGNED_OUT',null);return {}}}})};`;
const code='AAAABBBBCCCCDDDD';
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'});
const page=await context.newPage();
await page.addInitScript(()=>{globalThis.__qaCsp=[];document.addEventListener('securitypolicyviolation',event=>globalThis.__qaCsp.push({directive:event.effectiveDirective,blocked:event.blockedURI}));});
let profile={nombre:'Falio3',nivel:1,xp:0,partidasTerminadas:0,victorias:0};
let configFailure=false;
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==new URL(base).origin){await route.abort();return;}
 if(url.pathname.startsWith('/js/vendor/supabase-'))return route.fulfill({contentType:'text/javascript',body:sdk});
 if(url.pathname==='/api/cuentas/config')return configFailure?route.fulfill({status:503,json:{error:'QA configuración no disponible'}}):route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-placeholder'}});
 if(url.pathname==='/api/perfil'){
  if(request.method()==='POST')profile={...profile,nombre:request.postDataJSON().nombre};
  return route.fulfill({json:profile});
 }
 if(url.pathname==='/api/comunidad')return route.fulfill({json:{codigo:code,amigos:[{codigo:'1111222233334444',nombre:'Bruno',nivel:5}],recibidas:[],enviadas:[]}});
 if(url.pathname==='/api/ranking'){
  const own={posicion:1,codigo:code,nombre:profile.nombre,nivel:profile.nivel,xp:profile.xp,victorias:0,partidas:0,yo:true};
  return route.fulfill({json:{criterio:url.searchParams.get('criterio'),entradas:[own],propia:own}});
 }
 if(url.pathname==='/api/misiones')return route.fulfill({json:{reinicioDiario:'2030-10-07T00:00:00Z',reinicioSemanal:'2030-10-14T00:00:00Z',diarias:[{id:'qa-diaria',titulo:'Juega una partida',objetivo:1,progreso:0,xp:50,completada:false,reclamada:false}],semanales:[{id:'qa-semanal',titulo:'Juega tres partidas',objetivo:3,progreso:0,xp:100,completada:false,reclamada:false}]}});
 await route.continue();
});
async function capture(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: desbordamiento horizontal`);
 assert(await page.locator('#account-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${label}: desbordamiento del perfil`);
 const broken=await page.locator('#account-panel img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src));
 assert.deepEqual(broken,[],`${label}: imágenes no disponibles`);
 assert.deepEqual(await page.evaluate(()=>globalThis.__qaCsp),[],`${label}: recursos bloqueados por CSP`);
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});
 geometry.push({label,viewport:page.viewportSize(),typography:await page.locator('.profile-identity h3,.xp-headline strong,.rank-description,.profile-section-label').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);return {selector:node.className||node.tagName,fontFamily:style.fontFamily,fontWeight:style.fontWeight,fontSize:style.fontSize,textShadow:style.textShadow};})),boxes:await page.locator('.academy-navigation,.community-tabs,.profile-main,.profile-identity,.profile-record,.rank-journey').evaluateAll(nodes=>nodes.map(node=>({selector:node.className,x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})))});
 checks.push(label);
}
try{
 await page.goto(base);await page.locator('#account-open.has-profile').waitFor();await page.locator('#account-open').click();await page.locator('.profile-shell.tier-madera').waitFor();
 assert.equal(await page.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');
 await capture('profile-reference-1672');
 await page.setViewportSize({width:1440,height:1000});await capture('profile-madera-1440');
 for(const width of [390,360]){await page.setViewportSize({width,height:844});await capture(`profile-madera-${width}`);}
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(new URL(page.url()).hash,'#perfil');
 await page.goBack();await page.locator('#account-panel').waitFor({state:'hidden'});
 await page.goForward();await page.locator('.profile-shell.tier-madera').waitFor();
 await page.reload();await page.locator('.profile-shell.tier-madera').waitFor();
 await page.locator('#account-edit').click();await page.locator('#account-rename input').fill('Mi borrador');
 profile={...profile,xp:100};await page.evaluate(async()=>{const {accounts}=await import('/js/auth.js');await accounts.refreshProfile();});
 assert.equal(await page.locator('#account-rename input').inputValue(),'Mi borrador');
 await page.locator('#account-rename button').click();await page.locator('.profile-identity h3').filter({hasText:'Mi borrador'}).waitFor();
 for(const section of ['friends','ranking','missions']){
  await page.locator(`[data-academy-page=${section}]`).click();await page.locator('[data-community-content] h2').waitFor();await capture(`${section}-1440`);
 }
 await page.locator('[data-academy-page=profile]').click();
 profile={nombre:'Falio3',nivel:78,xp:38850,partidasTerminadas:84,victorias:37};
 await page.evaluate(async()=>{const {accounts}=await import('/js/auth.js');await accounts.refreshProfile();});await page.locator('.profile-shell.tier-eterno').waitFor();await capture('profile-eterno-1440');
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});await capture(`profile-eterno-${width}`);
  for(const section of ['friends','ranking','missions']){
   await page.locator(`[data-academy-page=${section}]`).click();await page.locator('[data-community-content] h2').waitFor();await capture(`${section}-${width}`);
  }
  await page.locator('[data-academy-page=profile]').click();
 }
 await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement.id),'account-open','Escape devuelve el foco al acceso del perfil');
 await page.locator('#account-open').click();await page.locator('#account-logout').click();await page.locator('#account-login').waitFor();await capture('login-360');
 await page.locator('#account-switch').click();await page.locator('#account-register').waitFor();
 assert.equal(await page.locator('#account-register input[name=password]').getAttribute('minlength'),'6');await capture('register-360');
 configFailure=true;await page.reload();await page.locator('#account-guest').waitFor();await capture('configuration-failure-360');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,geometry,scope:'Navegador real; SDK y HTTP de cuentas/comunidad simulados, sin Supabase remoto'},null,2));
 console.log(`PASS referencia perfil: ${checks.length} capturas; assets, XP0, alias conservado, Eterno, navegación, Escape y 1672/1440/390/360px.`);
}finally{await browser.close();}
