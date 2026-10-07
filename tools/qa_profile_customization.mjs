// All account/catalog responses are local simulated fixtures. No production mutations.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.TESIS_PLAYWRIGHT||'file:///C:/Users/radeu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.TESIS_URL||'http://localhost:8093',out='target/qa-profile-customization',visualOnly=process.env.TESIS_VISUAL_ONLY==='1';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.TESIS_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1672,height:941},reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],checks=[],mutations=[],geometry=[];let failEquip=false,delayEquip=0,failCollection=false,delayCollection=0;
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).pathname.startsWith('/assets/'))errors.push(`Asset ${response.status()}: ${response.url()}`);});
await page.route('**/api/cosmeticos**',async route=>{
 const request=route.request(),url=new URL(request.url());assert.equal(request.headers().authorization,'Bearer custom-demo');
 if(url.pathname.endsWith('/equipar')){mutations.push(request.postDataJSON());assert.equal(request.headers()['x-tesis'],'1');if(delayEquip)await new Promise(resolve=>setTimeout(resolve,delayEquip));if(failEquip)return route.fulfill({status:503,json:{error:'QA no se pudo guardar el cosmético'}});}
 else {if(delayCollection)await new Promise(resolve=>setTimeout(resolve,delayCollection));if(failCollection)return route.fulfill({status:503,json:{error:'QA colección temporalmente no disponible'}});}
 return route.continue();
});
const cards=()=>page.locator('.customization-grid .customization-cosmetic');
const status=()=>page.locator('.customization-status');
async function ready(){await cards().first().waitFor();}
async function shot(label){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
 const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('#account-panel *')].filter(node=>{const r=node.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0;}).map(node=>({tag:node.tagName,class:node.className,right:node.getBoundingClientRect().right,width:node.getBoundingClientRect().width})).slice(0,15)}));
 assert(overflow.scrollWidth<=overflow.width+1,`${label}: desbordamiento horizontal ${JSON.stringify(overflow)}`);
 assert.deepEqual(await page.locator('#account-panel img').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)),[],`${label}: assets rotos`);
 geometry.push({label,viewport:page.viewportSize(),boxes:await page.locator('.customization-layout,.customization-preview,.customization-content,.customization-grid,.customization-detail').evaluateAll(nodes=>nodes.map(node=>({class:node.className,x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})))});
 await page.screenshot({path:`${out}/${label}.png`,fullPage:true});checks.push(label);
}
try{
 await context.request.get(`${base}/api/demo/reset`);
 await page.goto(`${base}/#perfil`);await page.locator('[data-customize]').click();await ready();assert.equal(new URL(page.url()).hash,'#personalizacion');assert.equal(await cards().count(),19);assert.equal(await page.locator('.customization-slot').count(),7);
 for(const width of [1672,1280,768,390]){await page.setViewportSize({width,height:width===390?844:941});await shot(`customization-${width}`);}
 await page.setViewportSize({width:1672,height:941});
 for(const [category,count] of [['avatar',3],['marco',4],['titulo',3],['insignia',3],['placa',2],['reverso',2],['interaccion',2]]){await page.locator(`[data-category=${category}]`).click();assert.equal(await cards().count(),count);}
 assert.equal(await page.locator('.customization-slot-interaccion').isDisabled(),false);assert.equal(await page.locator('.customization-empty').count(),0);await shot('customization-interactions-locked');
 await page.locator('[data-category=avatar]').focus();await page.keyboard.press('Enter');assert.equal(await cards().count(),3);assert.equal(await page.locator('[data-category=avatar]').getAttribute('aria-pressed'),'true');
 await page.locator('#customization-search').focus();await page.keyboard.type('Erudito');assert.equal(await cards().count(),1);assert.equal(await page.locator('#customization-search').evaluate(node=>node===document.activeElement),true);await page.locator('#customization-search').fill('');
 if(!visualOnly){
 await page.locator('[data-category=todos]').click();await page.locator('[data-filter=bloqueados]').click();assert.equal(await cards().count(),9);await page.locator('[data-filter=desbloqueados]').click();assert.equal(await cards().count(),10);await page.locator('[data-filter=equipados]').click();assert.equal(await cards().count(),7);await page.locator('[data-filter=todos]').click();
 await page.locator('#customization-search').fill('Maestro');assert.equal(await cards().count(),2);await page.locator('#customization-search').fill('no existe');assert.equal(await cards().count(),0);await page.locator('#customization-search').fill('');
 await page.locator('#customization-sort').selectOption('nivel');assert.equal(await cards().first().getAttribute('data-select'),'default:avatar');await page.locator('#customization-sort').selectOption('rareza');assert((await cards().first().getAttribute('data-select')).startsWith('archivo_maestro'));
 await page.locator('.customization-grid [data-select=archivo_maestro_marco]').click();assert(await page.locator('[data-equip]').isDisabled());assert((await page.locator('.customization-detail').innerText()).includes('Nivel 10'));await shot('customization-locked');
 await page.locator('.customization-grid [data-select=academia_titulo]').click();await page.locator('[data-equip]').click();await status().filter({hasText:'Equipamiento actualizado'}).waitFor();assert.deepEqual(mutations.at(-1),{tipo:'titulo',id:'academia_titulo'});assert((await page.locator('.customization-preview').innerText()).includes('Custodio de Manuscritos'));await shot('customization-equipped');
 await page.locator('[data-unequip]').click();await status().filter({hasText:'desequipado'}).waitFor();assert.deepEqual(mutations.at(-1),{tipo:'titulo',id:null});
 failEquip=true;const before=mutations.length;await page.locator('[data-equip]').click();await status().filter({hasText:'QA no se pudo guardar'}).waitFor();assert.equal(mutations.length,before+1);assert(await page.locator('[data-unequip]').isDisabled());await page.waitForTimeout(300);assert.equal(mutations.length,before+1,'Mutación ambigua no se reintenta');await shot('customization-save-error');failEquip=false;await page.locator('[data-reload]').click();await ready();
 delayEquip=700;await page.locator('[data-equip]').click();assert(await page.locator('[data-equip]').isDisabled());await page.locator('[data-summary]').click();await page.waitForTimeout(850);assert.equal(new URL(page.url()).hash,'#perfil');assert.equal(await page.locator('.customization-layout').count(),0,'Respuesta de página abandonada descartada');delayEquip=0;
 failCollection=true;await page.locator('[data-customize]').click();await page.locator('[data-reload]').waitFor();assert((await status().innerText()).includes('QA colección'));failCollection=false;await page.locator('[data-reload]').click();await ready();
 assert.equal(await page.locator('.customization-archive,.customization-back-preview,.customization-preview>header').count(),0);
 await page.locator('[data-summary]').click();delayCollection=600;await page.locator('[data-customize]').click();await page.evaluate(()=>{window.__customSignedOut=true;window.__customAuth('SIGNED_OUT',null);});await page.waitForTimeout(750);assert.equal(await page.locator('.customization-layout').count(),0,'Logout invalida la respuesta privada tardía');delayCollection=0;
 }
 await context.request.get(`${base}/api/demo/unlock`);await page.goto(`${base}/#personalizacion`);await page.reload();await ready();
 for(const [tipo,id] of [['avatar','archivo_erudito'],['marco','archivo_maestro_marco'],['titulo','archivo_cronista'],['insignia','archivo_maestro_insignia'],['placa','archivo_placa'],['reverso','academia_reverso'],['interaccion','archivo_lanzamiento_libro']]){await page.locator(`.customization-grid [data-select="${id}"]`).click();await page.locator('[data-equip]').click();await status().filter({hasText:'Equipamiento actualizado'}).waitFor();assert.deepEqual(mutations.at(-1),{tipo,id});}
 for(const width of [1672,390]){await page.setViewportSize({width,height:width===390?844:941});await shot(`customization-real-equipped-${width}`);}
 await page.locator('[data-summary]').click();await page.locator('.profile-emblem>.profile-badge').waitFor();assert.equal(await page.locator('.profile-identity .customization-art').count(),0);
 for(const width of [1672,390]){await page.setViewportSize({width,height:width===390?844:941});await shot(`profile-real-equipped-${width}`);}
 await page.locator('[data-customize]').click();await ready();
 for(const tipo of ['avatar','marco','titulo','insignia','placa','reverso','interaccion']){await page.locator(`.customization-grid [data-select="default:${tipo}"]`).click();await page.locator('[data-equip]').click();await status().filter({hasText:'Equipamiento actualizado'}).waitFor();assert.deepEqual(mutations.at(-1),{tipo,id:null});assert.equal(await page.locator(`.customization-grid [data-select="default:${tipo}"]`).evaluate(node=>node===document.activeElement),true);}
 assert.equal(await page.locator('.customization-preview .customization-frame-overlay').count(),0);assert.equal(await page.locator('.customization-preview img[src$="user-icon.svg"]').count(),1);await shot('customization-original-restored');
 await page.locator('[data-summary]').click();await page.locator('.profile-emblem>.profile-badge').waitFor();assert.equal(await page.locator('.profile-identity .customization-art').count(),0);await shot('profile-original-restored');
 for(const file of ['libro','hoja-01','hoja-02','impacto']){const response=await context.request.get(`${base}/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/${file}.png`);assert(response.ok());}
 assert.deepEqual(errors,[]);await writeFile(`${out}/${visualOnly?'visual-result':'result'}.json`,JSON.stringify({checks,mutations,geometry,errors},null,2));console.log(`Personalización: ${checks.length} capturas, categorías/defaults/assets/equipamiento/errores/generaciones PASS`);
} finally {await browser.close();}
