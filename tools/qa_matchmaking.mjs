// Servidor real local; TESIS_URL, TESIS_PLAYWRIGHT y TESIS_CHROME opcionales.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.TESIS_URL || 'http://localhost:8091',out='target/qa-matchmaking',errors=[],checks=[];
await mkdir(out,{recursive:true});
async function client(width=1440) {
  const context=await browser.newContext({viewport:{width,height:width<500?844:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/cuentas/config',route=>route.fulfill({json:{habilitado:false,url:'',publishableKey:''}}));
  await page.goto(base);await page.locator('[data-command="matchmaking"]').click();
  return {context,page};
}
async function search(page,size,name) {
  await page.locator('#match-name').fill(name);
  await page.locator(`input[name="jugadores"][value="${size}"]`).check();
  await page.locator('#match-search button').click();
  await page.locator('[data-match="cancel"]').waitFor();
}
async function geometry(page,label) {
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
    choices:[...document.querySelectorAll('.match-sizes label')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
  assert.equal(result.overflow,false,label);
  for(const choice of result.choices)assert(choice.width>=44&&choice.height>=44,label);
  await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
try {
  // Las colas de 3,4,5 coexisten sin mezclarse; recarga conserva búsqueda.
  const queues=[];
  for(const n of [3,4,5]) {
    const c=await client(n===3?390:1440);queues.push(c);
    await geometry(c.page,`selector-${n}`);
    await search(c.page,n,'Cola '+n);
  }
  await queues[0].page.reload();await queues[0].page.locator('[data-match="cancel"]').waitFor();
  for(const c of queues) {
    await c.page.waitForFunction(()=>document.querySelector('#match-count')?.textContent.startsWith('1/'));
    await c.page.locator('[data-match="cancel"]').click();
    await c.page.locator('[data-command="matchmaking"]').waitFor();await c.context.close();
  }
  checks.push('colas separadas, recarga y cancelación');
  for(const n of [3,4,5]) {
    const clients=[];
    for(let i=0;i<n;i++){const c=await client(i===0?390:1440);clients.push(c);await search(c.page,n,'Ana');}
    for(const c of clients)await c.page.locator('[data-match="ready"]').waitFor();
    await geometry(clients[0].page,`confirmacion-${n}`);
    for(const c of clients)await c.page.locator('[data-match="ready"]').click();
    for(const c of clients)await c.page.locator('#board').waitFor({timeout:15000});
    const identities=await Promise.all(clients.map(c=>c.page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')))));
    assert.equal(new Set(identities.map(i=>i.codigo)).size,1);
    assert.equal(new Set(identities.map(i=>i.playerToken)).size,n);
    await clients[0].page.reload();await clients[0].page.locator('#board').waitFor();
    assert.equal(await clients[0].page.evaluate(()=>sessionStorage.getItem('tesis.matchmaking')),null);
    checks.push(`mesa exacta ${n}, nombres repetidos, confirmación e inicio, recarga de partida`);
    for(const c of clients)await c.context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
