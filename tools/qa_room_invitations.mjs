// Dos contextos aislados Chrome, SDK/API ficticios; nunca envía invitaciones reales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL||'http://localhost:8091',out='target/qa-room-invitations';await mkdir(out,{recursive:true});
const roomCode='A7K3Q',guestCode='1111222233334444',offlineCode='5555666677778888',hostCode='61F6F7E9EFE94792';
const calls=[],errors=[],checks=[];let members=['Ana'],revision=1,invites=[],serial=0,failInvite=false,failAccept=false,delayAccept=0;
const room=actor=>({codigo:roomCode,revision,fase:'LOBBY',yo:actor==='host'?'Ana':'Bruno',anfitrion:'Ana',soyAnfitrion:actor==='host',jugadores:members,partida:null,progreso:{estado:'SIN_PARTIDA',cuenta:true,xp:null,partidaId:null}});
const access=actor=>({codigo:roomCode,playerToken:`room-${actor}`,sala:room(actor)});
async function setup(actor){
 const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'}),page=await context.newPage();await page.clock.install();
 page.on('pageerror',e=>errors.push(`${actor}: ${e.message}`));
 await page.addInitScript(()=>{window.__qaCsp=[];document.addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
 const sdk=`window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.__qaAuth=fn},getSession:async()=>({data:{session:{access_token:'qa-${actor}',user:{id:'qa-${actor}'}}}}),signOut:async()=>({})}})};`;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(base).origin)return route.abort();
  if(url.pathname.startsWith('/js/vendor/supabase-'))return route.fulfill({contentType:'text/javascript',body:sdk});
  if(url.pathname==='/api/cuentas/config')return route.fulfill({json:{habilitado:true,url:base,publishableKey:'qa-placeholder'}});
  if(!url.pathname.startsWith('/api/'))return route.continue();
  calls.push({actor,path:url.pathname,method:req.method(),body:req.postDataJSON(),auth:req.headers().authorization,account:req.headers()['x-tesis-account-authorization']});
  if(url.pathname==='/api/perfil')return route.fulfill({json:{nombre:actor==='host'?'Ana':'Bruno',nivel:20,xp:9500,partidasTerminadas:30,victorias:10}});
  if(url.pathname==='/api/comunidad')return route.fulfill({json:{codigo:actor==='host'?hostCode:guestCode,presenciaDisponible:true,amigos:actor==='host'?[{codigo:guestCode,nombre:'Bruno',nivel:10,enLinea:true},{codigo:offlineCode,nombre:'Clara',nivel:35,enLinea:false}]:[{codigo:hostCode,nombre:'Ana',nivel:20,enLinea:true}],recibidas:[],enviadas:[],sugerencias:[]}});
  if(url.pathname==='/api/presencia')return route.fulfill({json:{activa:true}});
  if(url.pathname==='/api/invitaciones'){
   assert.equal(req.headers().authorization,`Bearer qa-${actor}`);return route.fulfill({json:{invitaciones:actor==='guest'?invites:[]}});
  }
  if(url.pathname==='/api/salas'&&req.method()==='POST'){
   assert.equal(req.headers()['x-tesis-account-authorization'],'Bearer qa-host');return route.fulfill({json:access(actor)});
  }
  if(url.pathname===`/api/salas/${roomCode}/estado`)return route.fulfill({json:room(actor)});
  if(url.pathname===`/api/salas/${roomCode}/invitar`){
   assert.equal(req.headers().authorization,'Bearer room-host');assert.equal(req.headers()['x-tesis-account-authorization'],'Bearer qa-host');assert.deepEqual(req.postDataJSON(),{codigo:guestCode});
   if(failInvite)return route.abort('failed');
   const id=`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;invites=[{id,codigoSala:roomCode,nombreAnfitrion:'Ana'}];return route.fulfill({json:{id,enviada:true}});
  }
  if(url.pathname.startsWith('/api/invitaciones/')&&req.method()==='POST'){
   const id=url.pathname.split('/')[3];assert.equal(req.headers().authorization,'Bearer qa-guest');assert.deepEqual(req.postDataJSON(),{});
   if(url.pathname.endsWith('/rechazar')){invites=invites.filter(i=>i.id!==id);return route.fulfill({json:{}});}
   if(delayAccept)await new Promise(resolve=>setTimeout(resolve,delayAccept));if(failAccept)return route.abort('failed');
   members=['Ana','Bruno'];revision++;invites=invites.filter(i=>i.id!==id);return route.fulfill({json:access(actor)});
  }
  return route.fulfill({status:404,json:{error:'QA ruta no preparada'}});
 });
 return {context,page};
}
async function capture(page,label){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' desbordamiento');assert.deepEqual(await page.evaluate(()=>window.__qaCsp),[]);await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);}
// Selectores estables del componente de invitaciones; confirmar con su propietario.
const hostButton='[data-room-invite-send]',acceptButton='[data-room-invitation-accept]',rejectButton='[data-room-invitation-reject]',banner='.room-invitation-inbox';
async function checkFriendGeometry(page){
 const sizes=await page.locator('.room-invite-body li').evaluateAll(items=>items.map(el=>({height:el.getBoundingClientRect().height,badge:el.querySelector('.profile-badge').getBoundingClientRect().height,name:el.querySelector('strong').getBoundingClientRect().width})));
 assert(sizes.every(item=>item.height<150&&item.badge<=60&&item.name>45),'Tarjetas y rangos del lobby proporcionados');
}
try{
 const host=await setup('host'),guest=await setup('guest');
 await Promise.all([host.page.goto(base),guest.page.goto(base)]);await host.page.locator('#account-open.has-profile').waitFor();await guest.page.locator('#account-open.has-profile').waitFor();
 await guest.page.locator('[data-command=private-join]').click();await guest.page.locator('#join-code').fill(roomCode);assert.equal(await guest.page.locator('#join-code').inputValue(),roomCode,'Entrada manual por código sigue disponible');await guest.page.locator('[data-command=home]').first().click();
 await host.page.locator('[data-command=private-create]').click();await host.page.locator('#create-name').fill('Ana');await host.page.locator('#create-room button').click();await host.page.locator('.room-code').waitFor();assert.equal(await host.page.locator('.room-code').innerText(),roomCode);
 await host.page.locator('[data-room-invite-toggle]').click();await host.page.locator(hostButton).waitFor();assert.equal(await host.page.locator(`${hostButton}:not(:disabled)`).count(),1,'Sólo amigo online invitable');await capture(host.page,'host-lobby-1672');
 await checkFriendGeometry(host.page);
 await host.page.locator(`${hostButton}:not(:disabled)`).focus();await host.page.keyboard.press('Enter');assert.equal(invites.length,1);await guest.page.clock.fastForward(31000);await guest.page.locator(acceptButton).waitFor();await capture(guest.page,'recipient-home-1672');
 assert.equal(JSON.stringify(invites).includes('playerToken'),false);await guest.page.locator('#account-open').click();await guest.page.locator('[data-academy-page=friends]').click();await guest.page.locator('#friend-own-code').waitFor();assert(await guest.page.locator(banner).isVisible());
 await guest.page.setViewportSize({width:390,height:844});await capture(guest.page,'recipient-friends-390');
 await guest.page.locator(rejectButton).focus();await guest.page.keyboard.press('Enter');await guest.page.locator(acceptButton).waitFor({state:'detached'});assert.equal(invites.length,0);
 failInvite=true;const beforeFail=calls.filter(c=>c.path.endsWith('/invitar')).length;await host.page.locator(`${hostButton}:not(:disabled)`).click();await host.page.clock.fastForward(61000);assert.equal(calls.filter(c=>c.path.endsWith('/invitar')).length-beforeFail,1,'Envío ambiguo no se reintenta');failInvite=false;
 await host.page.locator(`${hostButton}:not(:disabled)`).click();await guest.page.clock.fastForward(31000);await guest.page.locator(acceptButton).waitFor();
 failAccept=true;const beforeAccept=calls.filter(c=>c.path.endsWith('/aceptar')).length;await guest.page.locator(acceptButton).click();await guest.page.clock.fastForward(61000);assert.equal(calls.filter(c=>c.path.endsWith('/aceptar')).length-beforeAccept,1,'Aceptación ambigua no se reintenta');failAccept=false;
 delayAccept=350;await guest.page.locator(acceptButton).click();assert(await guest.page.locator(acceptButton).isDisabled(),'Aceptación bloquea doble clic');await guest.page.locator('.room-code').waitFor();assert.equal(await guest.page.locator('.room-code').innerText(),roomCode);assert.equal(await guest.page.locator('#account-panel').isVisible(),false);assert.equal(await guest.page.locator('.lobby-players li').count(),2);assert.equal(await guest.page.locator('[data-command=start-game]').count(),0,'Destinatario no se convierte anfitrión');
 assert.equal(await guest.page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')).playerToken),'room-guest');await capture(guest.page,'recipient-joined-390');
 await host.page.clock.fastForward(1000);assert.equal(await host.page.locator('.lobby-players li').count(),2);assert.equal(await host.page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')).playerToken),'room-host');
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({checks,errors,calls,scope:'Chrome real con dos contextos; Auth/API simulados; backend HTTP/SQL verificados por propietario'},null,2));console.log(`PASS invitaciones salas: ${checks.length} capturas, host/recipient, rechazar, aceptar, tokens y errores sin retry.`);
}finally{await browser.close();}
