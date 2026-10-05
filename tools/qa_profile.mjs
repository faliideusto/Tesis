// QA visual local: perfiles simulados, sin escribir XP ni llamar a Supabase.
// TESIS_PLAYWRIGHT puede apuntar al módulo instalado; TESIS_CHROME al ejecutable.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL || 'http://localhost:8091',dir='target/qa-profile';
await mkdir(dir,{recursive:true});const errors=[];
async function open(viewport,{level=1,guest=false,failure=false}={}) {
 const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(({level,guest})=>{globalThis.__profile={nombre:'Fali03',nivel:level,xp:(level-1)*500+350,partidasTerminadas:84,victorias:37};globalThis.__session=guest?null:{access_token:'qa-token',user:{id:'qa-user'}};},{level,guest});
 await page.route('**/js/vendor/supabase-*.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__emit=fn},getSession:async()=>({data:{session:window.__session}}),signOut:async()=>{window.__session=null;window.__emit('SIGNED_OUT',null);return {}},signInWithPassword:async()=>({data:{session:window.__session}})}})};`}));
 await page.route('**/api/cuentas/config',route=>failure?route.fulfill({status:503,json:{error:'QA indisponible'}}):route.fulfill({json:{habilitado:true,url:'https://qa.invalid',publishableKey:'qa-public'}}));
 await page.route('https://qa.invalid/**',route=>route.abort());
 await page.route('**/api/perfil',async route=>{
   const value=await page.evaluate(()=>globalThis.__profile);
   if(route.request().method()==='POST'){value.nombre=route.request().postDataJSON().nombre;await page.evaluate(p=>globalThis.__profile=p,value);}
   await route.fulfill({json:value});
 });
 await page.goto(base);await page.locator('.home-account-slot #account-open').waitFor({state:'visible'});
 return {page,context};
}
async function noOverflow(page){assert.equal(await page.locator('#account-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'El modal no debe desbordar horizontalmente');}
try {
 const loading=await open({width:390,height:844});
 await loading.page.route('**/api/perfil',route=>route.fulfill({status:503,json:{error:'Perfil temporalmente indisponible'}}));
 await loading.page.evaluate(async()=>{const {accounts}=await import('/js/auth.js');await accounts.logout();window.__session={access_token:'qa-token',user:{id:'qa-user'}};window.__emit('SIGNED_IN',window.__session);});
 await loading.page.locator('#account-open').click();await loading.page.locator('#account-refresh').waitFor();
 await loading.page.locator('#account-message').filter({hasText:'Perfil temporalmente indisponible'}).waitFor();await noOverflow(loading.page);
 await loading.page.screenshot({path:dir+'/profile-unavailable-mobile.png'});
 const desktop=await open({width:1440,height:1000});const page=desktop.page;
 await page.locator('#account-open.has-profile').waitFor();await page.screenshot({path:dir+'/home-desktop.png'});
 await page.locator('#account-open').click();await page.locator('.profile-shell').waitFor();await noOverflow(page);
 assert.equal(await page.locator('[role=progressbar]').getAttribute('aria-valuenow'),'350');
 await page.screenshot({path:dir+'/profile-madera-desktop.png'});
 await page.locator('#account-edit').click();await page.locator('#account-rename input').fill('Mi borrador');
 await page.evaluate(async()=>{window.__emit('TOKEN_REFRESHED',window.__session);const {accounts}=await import('/js/auth.js');window.__profile={...window.__profile,xp:450};await accounts.refreshProfile();});
 assert.equal(await page.locator('#account-rename input').inputValue(),'Mi borrador');
 await page.locator('#account-rename button').click();await page.locator('.profile-identity h3').filter({hasText:'Mi borrador'}).waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.locator('#account-panel').evaluate(el=>el.open),false);
 assert.equal(await page.locator('#account-open').evaluate(el=>el===document.activeElement),true,'Escape devuelve el foco');
 await page.evaluate(async()=>{window.__profile={...window.__profile,nombre:'Fali03',nivel:78,xp:38850};const {accounts}=await import('/js/auth.js');await accounts.refreshProfile();});
 await page.locator('#account-open').click();await page.locator('.profile-shell.tier-eterno').waitFor();await page.screenshot({path:dir+'/profile-eterno-desktop.png'});
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});await noOverflow(page);
  await page.screenshot({path:dir+`/profile-eterno-${width}.png`,fullPage:true});
  await page.locator('#account-edit').click();await page.locator('#account-rename input').fill('Investigador móvil');
  await page.locator('#account-rename button').click();await page.locator('.profile-identity h3').filter({hasText:'Investigador móvil'}).waitFor();
 }
 await page.locator('#account-logout').click();await page.locator('#account-login').waitFor();await noOverflow(page);
 await page.screenshot({path:dir+'/login-mobile.png',fullPage:true});await page.locator('#account-switch').click();
 assert.equal(await page.locator('#account-register input[name=password]').getAttribute('minlength'),'6');await noOverflow(page);
 await page.screenshot({path:dir+'/register-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:dir+'/register-desktop.png'});
 const players=[];
 for(const name of ['Ana','Bruno','Clara']){
  const entry=await open({width:1440,height:1000},{guest:true});players.push(entry);
  if(name==='Ana'){await entry.page.locator('#create-room input').fill(name);await entry.page.locator('#create-room button').click();}
  else{const code=await players[0].page.locator('.room-code').innerText();await entry.page.locator('#join-room input[name=codigo]').fill(code);await entry.page.locator('#join-room input[name=nombre]').fill(name);await entry.page.locator('#join-room button').click();}
  await entry.page.locator('.lobby-panel').waitFor();await entry.page.locator('.home-account-slot #account-open').waitFor();
 }
 await players[0].page.locator('.lobby-players li').filter({hasText:'Clara'}).waitFor();
 await players[0].page.locator('[data-command=home]').click();await players[0].page.locator('.home-account-slot #account-open').waitFor();
 await players[0].page.locator('[data-command=resume]').click();await players[0].page.locator('.lobby-panel #account-progress').waitFor();
 await players[0].page.screenshot({path:dir+'/lobby-desktop.png'});
 await players[0].page.locator('#account-open').click();await players[0].page.locator('#account-login input[name=email]').fill('draft@example.com');
 await players[0].page.waitForTimeout(1200);assert.equal(await players[0].page.locator('#account-login input[name=email]').inputValue(),'draft@example.com');
 await players[0].page.keyboard.press('Escape');await players[0].page.locator('[data-command=start-game]').click();
 await players[0].page.locator('#board .utility #account-open').waitFor();
 if(await players[0].page.locator('#modal').evaluate(el=>el.open))await players[0].page.keyboard.press('Escape');
 await players[0].page.locator('#account-open').click();await players[0].page.locator('#account-login').waitFor();await players[0].page.keyboard.press('Escape');
 await players[0].page.screenshot({path:dir+'/board-desktop.png'});
 const mobile=await open({width:360,height:800},{guest:true});
 assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const nav=await mobile.page.locator('.home-nav').evaluate(el=>{const a=el.children[0].getBoundingClientRect(),b=el.children[1].getBoundingClientRect();return a.right<=b.left});assert.equal(nav,true,'Cabecera móvil sin solapamiento');
 await mobile.page.screenshot({path:dir+'/home-mobile.png',fullPage:true});
 const failed=await open({width:390,height:844},{failure:true,guest:true});await failed.page.locator('#account-open').click();await failed.page.locator('#account-guest').waitFor();await noOverflow(failed.page);await failed.page.screenshot({path:dir+'/error-mobile.png'});
 assert.deepEqual(errors,[]);console.log('QA perfil: escritorio, 390/360px, Eterno, XP accesible, alias conservado/guardado, Escape/foco, login/registro min6, fallo configuración, 3 invitados lobby/polling/tablero. Sin Supabase real.');
}finally{await browser.close();}
