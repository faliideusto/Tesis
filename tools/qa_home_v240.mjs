// QA v2.4.0: navegador real, HTTP/Auth simulados y geometría de todos los accesos.
// Ejecutar contra servidor local: TESIS_URL, TESIS_PLAYWRIGHT y TESIS_CHROME opcionales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-home-v240';
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
  if(url.pathname==='/api/comunidad'){await route.fulfill({json:{codigo:'AAAABBBBCCCCDDDD',amigos:Array.from({length:12},(_,i)=>({codigo:'FRIEND'+i,nombre:'Investigador '+i,nivel:3})),recibidas:[{codigo:'RECIBIDA',nombre:'Nueva colega',nivel:2}],enviadas:[{codigo:'ENVIADA',nombre:'Otro investigador',nivel:1}]}});return;}
  if(url.pathname==='/api/ranking'){await route.fulfill(rankingFailure?{status:503,json:{error:'Ranking temporalmente indisponible'}}:{json:{criterio:'xp',entradas:Array.from({length:50},(_,i)=>({posicion:i+1,nombre:'Academia '+i,nivel:3,xp:10000-i*50,victorias:8,partidas:20,yo:i===12})),propia:{posicion:13,nivel:3,xp:9400,victorias:8,partidas:20}}});return;}
  if(url.pathname==='/api/misiones'){await route.fulfill({json:{reinicioDiario:'2030-10-07T00:00:00Z',reinicioSemanal:'2030-10-14T00:00:00Z',diarias:Array.from({length:3},(_,i)=>({id:'D'+i,titulo:'Completa partidas con tu academia',objetivo:3,progreso:i,xp:50,completada:false,reclamada:false})),semanales:Array.from({length:3},(_,i)=>({id:'S'+i,titulo:'Publica tu legado científico',objetivo:5,progreso:i,xp:100,completada:false,reclamada:false}))}});return;}
  if(url.pathname==='/api/salas'||url.pathname==='/api/salas/QA123/unirse'){assert.equal(req.headers()['x-tesis-account-authorization'],'Bearer local-qa-token');await route.fulfill({json:{codigo:'QA123',playerToken:'qa-room-token',sala:room}});return;}
  if(url.pathname==='/api/salas/QA123/estado'){assert.equal(req.headers().authorization,'Bearer qa-room-token');await route.fulfill({json:room});return;}
  errors.push(`API inesperada ${url.pathname}`);await route.fulfill({status:404,json:{error:'QA ruta inesperada'}});
 });
 return {context,page};
}

const routes={perfil:'profile',amigos:'friends',ranking:'ranking',misiones:'missions'};
const desktops=[[1920,1080],[1536,864],[1440,900],[1366,768],[1280,720],[1152,648],[1024,768],[1024,600]];
async function geometry(page,label,{desktop=true,controls=true}={}) {
 const result=await page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return !!(r.width&&r.height)&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]');};
  const all=[...document.querySelectorAll('#app button,#app a,#app input,#account-panel button,#account-panel input,#account-panel select')].filter(visible);
  const bounds=all.map(e=>{const r=e.getBoundingClientRect();let clipped=false;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1){clipped=true;break;}}return {id:e.id||e.textContent.trim().slice(0,35),x:r.x,y:r.y,right:r.right,bottom:r.bottom,clipped};});
  const boxes=[...document.querySelectorAll('.home-hub .home-nav,.home-hub .home-sidebar,.home-hub .home-copy,.home-hub .setup-panel,.home-hub .home-footer,#account-panel .profile-heading,#account-panel .profile-main,#account-panel .rank-journey,#account-panel .profile-footer')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {id:e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
  const overlaps=boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2).map(b=>[a.id,b.id]));
  return {vertical:document.documentElement.scrollHeight>innerHeight+1,horizontal:document.documentElement.scrollWidth>innerWidth+1,bounds,overlaps,width:innerWidth,height:innerHeight};
 });
 assert.equal(result.horizontal,false,`${label}: overflow horizontal`);
 if(desktop)assert.equal(result.vertical,false,`${label}: scroll de página ${JSON.stringify(result)}`);
 assert.deepEqual(result.overlaps,[],`${label}: paneles solapados`);
 if(desktop&&controls)for(const b of result.bounds.filter(b=>!b.clipped))assert(b.x>=-1&&b.y>=-1&&b.right<=result.width+1&&b.bottom<=result.height+1,`${label}: control fuera de viewport ${JSON.stringify(b)}`);
 checks.push(label);return result;
}
async function section(page,name) {
 await page.locator(`#account-panel[data-page="${name}"]`).waitFor();
 if(name==='friends')await page.locator('#friend-own-code').waitFor();
 if(name==='ranking')await page.locator('#ranking-criterion').waitFor();
 if(name==='missions')await page.locator('.mission-section').first().waitFor();
 if(name==='profile')await page.locator('.profile-identity').waitFor();
}
async function shot(page,label){await page.screenshot({path:`${out}/${label}.png`,fullPage:true});}
async function close(page){await page.keyboard.press('Escape');await page.locator('#account-panel').waitFor({state:'hidden'});}
async function reachableControls(page,label) {
 const failures=await page.evaluate(()=>{
  const failures=[];
  for(const e of document.querySelectorAll('#account-panel button,#account-panel input,#account-panel select')) {
   if(e.closest('[hidden]')||!e.getBoundingClientRect().width)continue;
   e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
   const r=e.getBoundingClientRect();let top=0,bottom=innerHeight,left=0,right=innerWidth;
   for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll|hidden/.test(s.overflowY)){const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}if(/auto|scroll|hidden/.test(s.overflowX)){const b=p.getBoundingClientRect();left=Math.max(left,b.left);right=Math.min(right,b.right);}}
   if(r.top<top-2||r.bottom>bottom+2||r.left<left-2||r.right>right+2)failures.push(e.id||e.textContent.trim().slice(0,45));
  }
  return failures;
 });
 assert.deepEqual(failures,[],`${label}: controles recortados incluso al desplazarse dentro del panel`);
}
try {
 const {context,page}=await setup();await page.goto(base);await page.locator('#account-open.has-profile').waitFor();
 assert.match(await page.locator('.home-copy').innerText(),/La diferencia está en la ciencia/);
 assert.match(await page.locator('h1').innerText(),/Construye tu\s+legado científico\./);
 for(const [width,height] of [...desktops,[390,844],[360,740]]) {
  await page.setViewportSize({width,height});
  await geometry(page,`home-${width}x${height}`,{desktop:width>=1024});
  assert.equal(await page.locator('#create-room,#join-room').count(),0,'Inicio distingue modos sin formularios mezclados');
  for(const mode of ['private-create','private-join']) {
   await page.locator(`[data-command="${mode}"]`).first().click();
   const form=mode==='private-create'?'#create-room':'#join-room';await page.locator(form).waitFor();
   assert.equal(await page.locator('#create-room,#join-room').count(),1);
   await geometry(page,`${mode}-${width}x${height}`,{desktop:width>=1024});
   await page.locator('.mode-back').click();
  }
  await page.locator('[data-command="matchmaking"]').click();await page.locator('#match-search').waitFor();
  await geometry(page,`matchmaking-${width}x${height}`,{desktop:width>=1024});
  await page.locator('[data-match="back"]').click();
  for(const [hash,name] of Object.entries(routes)) {
   const link=page.locator(`.home-community a[href="#${hash}"]`);await link.focus();await page.keyboard.press('Enter');await section(page,name);
   await geometry(page,`${hash}-${width}x${height}`,{desktop:width>=1024});
   if(width>=1024)await reachableControls(page,`${hash}-${width}`);
   if(width===1366||width===390)await shot(page,`${hash}-${width}`);
   await close(page);assert.equal(await link.evaluate(e=>document.activeElement===e),true,`${hash} devuelve foco`);
  }
  if(width===1366||width===1920||width===390||(width===1024&&height===600))await shot(page,`home-${width}`);
 }
 await page.setViewportSize({width:1024,height:600});
 await page.locator('a[href="#ranking"]').click();await section(page,'ranking');
 await page.goBack();await page.locator('#account-panel').waitFor({state:'hidden'});
 await page.goForward();await section(page,'ranking');
 await page.locator('[data-academy-page="missions"]').click();await section(page,'missions');
 assert.equal(new URL(page.url()).hash,'#misiones');await close(page);checks.push('history-back-forward-tabs');
 await page.locator('[data-command="help"]').first().click();await page.locator('dialog[open].rules-dialog').waitFor();
 assert(await page.locator('.rules-guide').innerText().then(t=>t.includes('prestigio')));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false,'Reglas no desplazan página');
 await shot(page,'rules-1024');await page.keyboard.press('Escape');
 await page.locator('[data-command="private-create"]').click();await page.locator('#create-name').fill('Borrador');
 await page.locator('a[href="#amigos"]').click();await section(page,'friends');await close(page);
 assert.equal(await page.locator('#create-name').inputValue(),'Borrador','Comunidad conserva borrador de sala');
 await page.locator('#create-name').fill('Ana');await page.locator('#create-room button').click();await page.locator('.room-code').waitFor();
 await page.locator('[data-command="home"]').click();await page.locator('[data-command="resume"]').click();await page.locator('.room-code').waitFor();
 await page.locator('[data-command="home"]').click();await page.locator('[data-command="private-join"]').click();
 await page.locator('#join-name').fill('Ana');await page.locator('#join-code').fill('qa123');await page.locator('#join-room button').click();await page.locator('.room-code').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')).playerToken),'qa-room-token');checks.push('create-join-resume-draft-identity');
 await context.close();
 for(const [hash,name] of Object.entries(routes)) {
  const guest=await setup({signedIn:false});await guest.page.setViewportSize({width:1024,height:600});await guest.page.goto(`${base}/#${hash}`);await guest.page.locator('#account-login').waitFor();
  await geometry(guest.page,`login-${hash}-1024`);await shot(guest.page,`login-${hash}`);
  await guest.page.setViewportSize({width:390,height:844});await geometry(guest.page,`login-${hash}-390`,{desktop:false});
  await guest.page.setViewportSize({width:1024,height:600});
  await guest.page.locator('[data-auth-mode="register"]').click();await guest.page.locator('#account-register').waitFor();await geometry(guest.page,`register-${hash}-1024`);
  await guest.page.setViewportSize({width:390,height:844});await geometry(guest.page,`register-${hash}-390`,{desktop:false});
  await guest.page.setViewportSize({width:1024,height:600});
  await guest.page.locator('[data-auth-mode="login"]').click();await guest.page.locator('[name="email"]').fill('qa@example.test');await guest.page.locator('[name="password"]').fill('password-qa');await guest.page.locator('#account-login button').click();await section(guest.page,name);
  assert.equal(new URL(guest.page.url()).hash,`#${hash}`);await guest.page.reload();await section(guest.page,name);checks.push(`login-destination-reload-${hash}`);await guest.context.close();
 }
 for(const config of [{enabled:false},{configFailure:true}]) {
  const c=await setup({signedIn:false,...config});await c.page.setViewportSize({width:1024,height:600});await c.page.goto(`${base}/#perfil`);
  await c.page.locator(config.enabled===false?'.account-availability':'.account-empty-shell').waitFor();
  await geometry(c.page,config.enabled===false?'disabled-1024':'disconnected-1024');await shot(c.page,config.enabled===false?'disabled':'disconnected');await c.context.close();
 }
 const failed=await setup({rankingFailure:true});await failed.page.goto(`${base}/#ranking`);await failed.page.locator('[data-community-message]').filter({hasText:'indisponible'}).waitFor();checks.push('ranking-error-feedback');await failed.context.close();
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,scope:'Navegador real + HTTP/Auth simulados. Sin Supabase remoto.'},null,2));
 console.log(`PASS v2.4.0: ${checks.length} comprobaciones de geometría/rutas/auth/salas/foco.`);
}finally{await browser.close();}
