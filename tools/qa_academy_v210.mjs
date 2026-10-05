// Local visual QA. Enabled accounts/profile scenarios are explicitly mocked;
// no real credentials, backend configuration changes or external requests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-v210/academy';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[],external=[];
async function shot(page,name){await page.mouse.move(0,350);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:`${out}/${name}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} horizontal overflow`);checks.push(name);}
function observe(page){page.on('pageerror',e=>errors.push(e.message));}
const sdkStub=`(()=>{let session=null,callback=()=>{};const auth={onAuthStateChange(fn){callback=fn},async getSession(){return{data:{session}}},async signInWithPassword(){window.qaLoginCalls=(window.qaLoginCalls||0)+1;session={access_token:'qa-local-placeholder',user:{id:'qa-demo'}};callback('SIGNED_IN',session);return{data:{session}}},async signUp(){window.qaRegisterCalls=(window.qaRegisterCalls||0)+1;session={access_token:'qa-local-placeholder',user:{id:'qa-demo'}};callback('SIGNED_IN',session);return{data:{session}}},async signOut(){session=null;callback('SIGNED_OUT',null);return{}}};window.supabase={createClient:()=>({auth})};})();`;
try{
  const real=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});observe(real);
  const response=await real.request.get(`${base}/api/cuentas/config`);assert(response.ok());const config=await response.json();
  const enabled=Boolean(config.habilitado); // Deliberately record no URLs or keys.
  await real.goto(base);await real.locator('#account-open').waitFor({state:'visible'});await shot(real,'01-home-profile-access-desktop');
  for(const width of [390,360]){await real.setViewportSize({width,height:844});await shot(real,`02-home-profile-access-${width}`);const boxes=await real.evaluate(()=>{const a=document.querySelector('#account-open').getBoundingClientRect(),h=document.querySelector('.home-copy').getBoundingClientRect();return{openerBottom:a.bottom,heroTop:h.top}});assert(boxes.openerBottom<=boxes.heroTop,'profile access overlaps hero');}
  await real.setViewportSize({width:1440,height:960});await real.locator('#account-open').click();await real.locator('#account-panel:not([hidden])').waitFor();assert.equal(new URL(real.url()).hash,'#perfil');
  if(!enabled){await real.locator('#account-panel[data-view=unavailable]').waitFor();assert.equal(await real.locator('#account-login,#account-register').count(),0,'disabled backend must not offer working auth form');}
  await shot(real,'03-profile-backend-unavailable-real');await real.keyboard.press('Escape');await real.locator('#account-panel').waitFor({state:'hidden'});assert.equal(await real.evaluate(()=>document.activeElement.id),'account-open');
  await real.goto(`${base}/#perfil`);await real.locator('#account-panel:not([hidden])').waitFor();await real.locator('.account-close').click();await real.locator('#account-panel').waitFor({state:'hidden'});

  let demo={nombre:'Ana · Demo QA',nivel:1,xp:320,partidasTerminadas:12,victorias:4};
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});const mock=await context.newPage();observe(mock);
  await mock.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!==new URL(base).origin){external.push(url.origin);await route.abort();return;}
    if(url.pathname==='/api/cuentas/config')await route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-placeholder'}});
    else if(url.pathname==='/js/vendor/supabase-2.57.4.js')await route.fulfill({body:sdkStub,contentType:'text/javascript'});
    else if(url.pathname==='/api/perfil')await route.fulfill({json:demo});else await route.continue();});
  await mock.goto(base);await mock.locator('#account-open').waitFor({state:'visible'});await mock.locator('#account-open').click();await mock.locator('#account-login').waitFor();await shot(mock,'04-login-enabled-mock-desktop');
  await mock.setViewportSize({width:390,height:844});await shot(mock,'05-login-enabled-mock-mobile');
  await mock.locator('[data-auth-mode=register]').click();await mock.locator('#account-register').waitFor();await shot(mock,'06-register-enabled-mock-mobile');
  await mock.setViewportSize({width:1440,height:960});await shot(mock,'07-register-enabled-mock-desktop');
  await mock.locator('[data-auth-mode=login]').click();await mock.locator('#account-login [name=email]').fill('qa@example.invalid');await mock.locator('#account-login [name=password]').fill('qa-local-example');await mock.locator('#account-login button[type=submit],#account-login button:not([type])').click();await mock.locator('.profile-shell').waitFor();assert.equal(await mock.evaluate(()=>window.qaLoginCalls),1);
  for(const [rank,level,xp] of [['madera',1,320],['oro',20,9820],['eterno',75,37320]]){
    demo={...demo,nivel:level,xp};await mock.locator('#account-refresh').click();await mock.locator(`.profile-shell.tier-${rank}`).waitFor();await mock.waitForFunction(expected=>document.querySelector('.profile-identity .emblem-level b')?.textContent===String(expected),level);
    await mock.setViewportSize({width:1440,height:960});await shot(mock,`08-profile-${rank}-demo-desktop`);await mock.setViewportSize({width:390,height:844});await shot(mock,`09-profile-${rank}-demo-mobile`);
  }
  await mock.keyboard.press('Escape');await mock.locator('#account-panel').waitFor({state:'hidden'});assert.equal(await mock.evaluate(()=>document.activeElement.id),'account-open');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(`${out}/results.json`,JSON.stringify({realBackendEnabled:enabled,checks,errors,externalRequests:external,enabledAuth:'mock SDK and configuration only; no real credentials or external submissions',profiles:'mock endpoint data rendered by production profileView: madera/oro/eterno'},null,2));
  await writeFile(`${out}/report.html`,`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi perfil · Tesis2.1</title><style>body{background:#081522;color:#f2e5d0;font:16px system-ui;padding:30px}h1,h2{color:#e8bd86;font-family:Georgia}img{width:100%;max-width:1440px;height:auto}section{margin:40px 0}</style><h1>Mi perfil · Tesis 2.1.0</h1><p>Acceso de portada y estado no disponible: servidor local real. Pantallas de acceso habilitado: SDK y configuración simulados, sin credenciales ni llamadas externas. Rangos y progreso: datos de ejemplo rendidos por la página real.</p>${checks.map(name=>`<section><h2>${name.replaceAll('-',' ')}</h2><a href="${name}.png"><img loading="lazy" src="${name}.png" alt="${name}"></a></section>`).join('')}</html>`);
  console.log(`PASS: ${checks.length} academy captures; real backend enabled=${enabled}; mocked auth/profile; keyboard return; no page errors or external requests.`);
}finally{await browser.close();}
