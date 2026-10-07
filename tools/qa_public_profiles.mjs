// UI y API de la demo local; no toca Supabase ni cuentas reales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8092',out='target/qa-public-profiles';
await mkdir(out,{recursive:true});
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],checks=[],requests=[],geometry=[];
let failProfile=false,delayProfile=0;
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).pathname.startsWith('/assets/'))errors.push(`Asset ${response.status()}: ${response.url()}`);});
await page.addInitScript(()=>{window.__qaCsp=[];document.addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
await page.route('**/api/perfil-publico?*',async route=>{
 const req=route.request();requests.push({url:req.url(),method:req.method()});assert.equal(req.headers().authorization,'Bearer demo-local');assert.equal(req.method(),'GET');
 if(delayProfile)await new Promise(resolve=>setTimeout(resolve,delayProfile));
 if(failProfile)return route.fulfill({status:503,json:{error:'QA perfil temporalmente no disponible'}});
 return route.continue();
});
const dialog=page.locator('.public-profile-dialog');
async function shot(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: desbordamiento horizontal`);
 assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${label}: desbordamiento diálogo`);
 assert.deepEqual(await dialog.locator('img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)),[]);
 assert.deepEqual(await page.evaluate(()=>window.__qaCsp),[]);
 if(await dialog.locator('.public-researcher-card').count()){
  const badge=await dialog.locator('.public-researcher-card .profile-badge').boundingBox();
  const name=await dialog.locator('.public-researcher-card h3').boundingBox();
  assert(badge.height<=220&&badge.width<=220,`${label}: insignia desproporcionada`);
  assert(name.y>=badge.y+badge.height,`${label}: nombre solapado con insignia`);
  if(page.viewportSize().width>650)assert(await dialog.evaluate(el=>el.scrollHeight<=el.clientHeight+1),`${label}: perfil desktop necesita scroll`);
 }
 geometry.push({label,viewport:page.viewportSize(),dialog:await dialog.boundingBox()});await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
async function openPerson(button,expected){
 const code=await button.getAttribute('data-public-profile');await button.click();await dialog.locator('.public-researcher-card h3').waitFor();
 const result=await context.request.get(`${base}/api/perfil-publico?codigo=${code}`,{headers:{Authorization:'Bearer demo-local'}});assert.equal(result.status(),200);const profile=await result.json();
 assert.equal(await dialog.locator('.public-researcher-card h3').innerText(),expected||profile.nombre);
 assert.equal(await dialog.locator('.public-profile-code strong').innerText(),code);
 assert.deepEqual(await dialog.locator('.public-profile-stats dd').allInnerTexts(),[profile.partidasTerminadas.toLocaleString('es-ES'),profile.victorias.toLocaleString('es-ES'),`${Math.round(profile.victorias/profile.partidasTerminadas*100)}%`]);
 assert.equal(await dialog.locator('#account-edit,#account-logout,input,form').count(),0,'Perfil público no tiene controles de cuenta');
 assert((await dialog.innerText()).includes(profile.presenciaDisponible?(profile.enLinea?'En línea':'Desconectado'):'Presencia no disponible'));
 return code;
}
async function closeAndFocus(button){await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('#account-panel').isVisible(),true);assert.equal(await button.evaluate(node=>node===document.activeElement),true);assert.equal(new URL(page.url()).hash,'#amigos');}
try{
 await page.goto(`${base}/?escenario=completo#amigos`);await page.locator('#friend-search').waitFor();
 await page.locator('#friend-code').fill('BORRADOR-PRIVADO');await page.locator('#friend-search').fill('Bruno');
 const friend=page.locator('.friend-list-friends [data-public-profile]').last();await openPerson(friend,'Bruno');await shot('public-friend-1672');await closeAndFocus(friend);
 assert.equal(await page.locator('#friend-search').inputValue(),'Bruno');assert.equal(await page.locator('#friend-code').inputValue(),'BORRADOR-PRIVADO');
 await page.locator('#friend-search').fill('');
 for(const [section,label] of [['.friend-list-received','received'],['.friend-list-sent','sent'],['.friend-suggestion-grid','suggested']]){
  const button=page.locator(`${section} [data-public-profile]`).first();await openPerson(button);await shot(`public-${label}-1672`);await closeAndFocus(button);
 }
 await page.setViewportSize({width:390,height:844});const mobileFriend=page.locator('.friend-list-friends [data-public-profile]').first();await openPerson(mobileFriend);await shot('public-friend-390');await closeAndFocus(mobileFriend);
 await page.setViewportSize({width:1672,height:941});
 failProfile=true;const retryFriend=page.locator('.friend-list-friends [data-public-profile]').first();await retryFriend.click();await dialog.locator('[data-public-profile-retry]').waitFor();assert((await dialog.innerText()).includes('QA perfil temporalmente'));await shot('public-error-1672');failProfile=false;await dialog.locator('[data-public-profile-retry]').click();await dialog.locator('.public-researcher-card h3').waitFor();await closeAndFocus(retryFriend);
 await page.locator('[data-academy-page=ranking]').click();const rankingPerson=page.locator('.ranking-table [data-public-profile]').first();await openPerson(rankingPerson);await shot('public-ranking-1672');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(new URL(page.url()).hash,'#ranking');assert(await rankingPerson.evaluate(node=>node===document.activeElement));
 await page.locator('[data-academy-page=friends]').click();await page.locator('#friend-search').waitFor();
 delayProfile=700;await page.locator('.friend-list-friends [data-public-profile]').first().click();await dialog.locator('.public-profile-status').waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForTimeout(850);assert.equal(await dialog.isVisible(),false,'GET tardío no reabre diálogo');delayProfile=0;
 delayProfile=700;await page.locator('.friend-list-friends [data-public-profile]').first().click();await dialog.locator('.public-profile-status').waitFor();await page.evaluate(()=>location.hash='#ranking');await dialog.waitFor({state:'detached'});await page.waitForTimeout(850);assert.equal(await page.locator('.public-profile-dialog').count(),0,'Destruir vista elimina diálogo pendiente');delayProfile=0;
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,requests,geometry,scope:'Chrome real contra demo local Auth/API/datos ficticios; fallos y latencia perfil interceptados; sin Supabase remoto'},null,2));
 console.log(`PASS perfiles públicos: ${checks.length} capturas; amigos, solicitudes, sugerencias, ranking, filtro, foco, Escape, retry y GET tardío.`);
}finally{await browser.close();}
