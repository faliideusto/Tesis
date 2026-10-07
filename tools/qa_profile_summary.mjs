// Local fixtures only; validates the summary without changing real accounts.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startCustomizationPreview} from './preview_customization.mjs';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'file:///C:/Users/radeu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const server=await startCustomizationPreview(8130),base='http://127.0.0.1:8130';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));await mkdir('target/qa-profile-summary',{recursive:true});
try {
 await page.goto(`${base}/#perfil`);await page.locator('[data-customize]').waitFor();
 assert.equal(await page.locator('#account-customize').count(),0);
 assert.equal(await page.locator('.customization-view-tabs [aria-current="page"]').innerText(),'Resumen');
 for(const [width,height] of [[1920,1080],[1672,941],[1440,900],[1366,768],[1280,720],[1280,650],[1024,600],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  assert.equal(await page.locator('.profile-identity .customization-art').count(),0);
  assert.equal(await page.locator('.profile-emblem>.profile-badge').count(),1);
  const geometry=await page.evaluate(()=>({height:innerHeight,width:innerWidth,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,shell:document.querySelector('.profile-shell').getBoundingClientRect().toJSON(),footer:document.querySelector('.profile-footer').getBoundingClientRect().bottom,panels:[...document.querySelectorAll('.profile-identity,.profile-record,.rank-journey')].map(node=>({class:node.className,height:node.clientHeight,scroll:node.scrollHeight,children:[...node.children].filter(c=>getComputedStyle(c).position!=='absolute').map(c=>({class:c.className,top:c.getBoundingClientRect().top-node.getBoundingClientRect().top,bottom:c.getBoundingClientRect().bottom-node.getBoundingClientRect().top,height:c.getBoundingClientRect().height}))}))}));
  assert.equal(Math.round(geometry.shell.width),width,'Full-width backdrop without side strips');
  assert(geometry.scrollWidth<=width+1,JSON.stringify(geometry));
  if(width>900){assert(geometry.scrollHeight<=height+1,`No page scroll: ${JSON.stringify(geometry)}`);assert(geometry.footer<=height,JSON.stringify(geometry));assert(geometry.panels.every(p=>p.scroll<=p.height+1),`No internal clipping/scroll: ${JSON.stringify(geometry)}`);}
  {
   const summaryTabs=await page.locator('.profile-main>.customization-view-tabs').boundingBox();
   await page.locator('[data-customize]').click();await page.locator('.customization-grid [data-select]').first().waitFor();
   const customizationTabs=await page.locator('.customization-root .customization-view-tabs').boundingBox();
   for(const key of ['x','y','width','height'])assert(Math.abs(summaryTabs[key]-customizationTabs[key])<=1,`Same selector ${key} at ${width}×${height}: ${JSON.stringify({summaryTabs,customizationTabs})}`);
   await page.screenshot({path:`target/qa-profile-summary/customization-${width}-${height}.png`,fullPage:true});
   await page.locator('[data-summary]').click();await page.locator('.profile-emblem>.profile-badge').waitFor();
  }
  await page.screenshot({path:`target/qa-profile-summary/profile-${width}-${height}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});await page.locator('#account-edit').click();assert(await page.locator('#account-rename').isVisible());await page.locator('#account-edit').click();
 await page.locator('[data-customize]').click();await page.locator('.customization-grid [data-select]').first().waitFor();assert.equal(new URL(page.url()).hash,'#personalizacion');
 assert((await page.locator('.customization-root .customization-view-tabs [aria-current="page"]').innerText()).includes('Personalización'));
 await page.locator('[data-summary]').click();await page.locator('.profile-emblem>.profile-badge').waitFor();assert.equal(new URL(page.url()).hash,'#perfil');assert.equal(await page.locator('.profile-identity .customization-art').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: rank summary without cosmetic extras; desktop/laptop no page/internal scroll at seven sizes, mobile, rename, customization/return and identical desktop selector size/position.');
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
