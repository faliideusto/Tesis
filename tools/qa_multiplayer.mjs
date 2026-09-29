// Optional: install Playwright and Chrome, then node tools/qa_multiplayer.mjs.
// TESIS_URL, PLAYWRIGHT_MODULE, TESIS_PLAYERS=3,4,5, TESIS_FAST_QA=1 are optional.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.TESIS_URL || 'http://localhost:8091';
const sizes=(process.env.TESIS_PLAYERS || '3,4,5').split(',').map(Number);
assert(sizes.every(n=>[3,4,5].includes(n)));
const out='target/qa-multiplayer'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
async function view(page) {
  const identity=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tesis.sala')));
  const response=await page.request.get(`${base}/api/salas/${identity.codigo}/estado`,{headers:{Authorization:`Bearer ${identity.playerToken}`}});
  assert(response.ok()); return response.json();
}
async function ready(page) {
  await page.waitForFunction(()=>document.getElementById('board') && !document.body.matches('.busy,.visual-busy'),null,{timeout:45000});
}
async function mutate(page, click) {
  const response=page.waitForResponse(r=>r.url().includes('/api/salas/') && r.request().method()==='POST');
  await click(); const result=await response; assert(result.ok(),await result.text());
  await ready(page); return result.json();
}
try {
  for(const count of sizes) {
    const errors=[], pages=new Map(), contexts=[];
    const names=['Ana','Bruno','Clara','Diego','Elena'].slice(0,count);
    for(const name of names) {
      const context=await browser.newContext({viewport:{width:count===5?390:1440,height:count===5?844:900}});
      contexts.push(context);
      // Speed up only this optional test process; production timings remain unchanged.
      if(process.env.TESIS_FAST_QA==='1') await context.addInitScript(()=>{
        const original=Element.prototype.animate;
        Element.prototype.animate=function(frames,options){return original.call(this,frames,typeof options==='number'?1:{...options,duration:1,delay:0});};
      });
      const page=await context.newPage(); pages.set(name,page);
      page.on('pageerror',e=>errors.push(e.message)); await page.goto(base);
    }
    const host=pages.get(names[0]);
    await host.locator('#create-room input').fill(names[0]);
    await host.getByRole('button',{name:'Crear sala',exact:true}).click();
    const code=await host.locator('.room-code').innerText();
    for(const name of names.slice(1)) {
      const page=pages.get(name);
      await page.locator('#join-room [name=codigo]').fill(code.toLowerCase());
      await page.locator('#join-room [name=nombre]').fill(name);
      await page.getByRole('button',{name:'Unirse a sala',exact:true}).click();
      await page.locator('.lobby-panel').waitFor();
      assert.equal(await page.locator('[data-command=start-game]').count(),0);
    }
    await host.waitForFunction(n=>document.querySelectorAll('.lobby-players li').length===n,count);
    const identityBefore=await host.evaluate(()=>sessionStorage.getItem('tesis.sala'));
    await host.reload(); await host.locator('.lobby-panel').waitFor();
    assert.equal(await host.evaluate(()=>sessionStorage.getItem('tesis.sala')),identityBefore);
    await mutate(host,()=>host.locator('[data-command=start-game]').click());
    const used=new Set(); let infoSurvived=false, warned=false, snapshotStable=false, unavailableExplained=false, previewCaptured=false;
    for(let step=0;step<1000;step++) {
      const latest=await view(host); if(latest.fase==='FINALIZADA') break;
      const page=pages.get(latest.partida.actual); await ready(page);
      // Polling may not have integrated the new snapshot yet.
      await page.waitForFunction(({name,phase})=>document.querySelector('#turn-panel strong')?.textContent === (phase==='SELECCION_ROLES'?'Elige '+name:phase==='TURNO_JUGADOR'?'Turno de '+name:'Cierre de ronda'),{name:latest.partida.actual,phase:latest.partida.fase});
      await ready(page);
      const own=await view(page), state=own.partida;
      const observer=[...pages.values()].find(p=>p!==page); await ready(observer);
      const observerState=await view(observer);
      assert.equal(observerState.partida.acciones.length,0);
      assert.equal(observerState.partida.seleccion.length,0);
      if(!infoSurvived) {await observer.locator('[data-command=help]').click(); await observer.locator('#modal-title').waitFor();}
      if(state.fase==='SELECCION_ROLES') {
        await page.locator('[data-command=phase]').click();
        const pref=state.ronda===1?[1,6,3,5,2,4,7]:[6,3,5,2,4,7,1];
        const role=[...state.seleccion].sort((a,b)=>pref.indexOf(a.orden)-pref.indexOf(b.orden))[0];
        await page.locator(`.role-selection [data-index="${role.indice}"]`).click();
        await page.locator('[data-command=confirm-role]').waitFor();
        if(!snapshotStable){await page.waitForTimeout(1100); assert.equal(await page.locator('[data-command=confirm-role]').count(),1);snapshotStable=true;}
        await mutate(page,()=>page.locator('[data-command=confirm-role]').click()); used.add('SELECCIONAR');
      } else if(state.fase==='FIN_RONDA') {
        await mutate(page,()=>page.locator('[data-command=next-round]').click());used.add('SIGUIENTE_RONDA');
      } else {
        const valid=state.acciones.filter(a=>a.disponible);
        const unavailable=state.acciones.find(a=>!a.disponible);
        if(!unavailableExplained && unavailable) {
          const button=page.locator(`[data-command=action][data-action=${unavailable.id}]`);
          await button.focus();await button.press('Enter');
          assert.equal(await page.locator('.dialog-body').innerText(),unavailable.motivo);
          assert.equal((await view(page)).revision,own.revision);
          await page.locator('[data-command=close]').click();unavailableExplained=true;
        }
        // Exercise warning without consuming a turn.
        if(!warned && !state.habilidadPendiente && state.accionesRestantes>0) {
          await page.locator('[data-action=FIN_TURNO]').click();
          await page.locator('[data-command=confirm-end]').waitFor();
          assert.equal((await view(page)).revision,own.revision);
          await page.getByRole('button',{name:'Seguir jugando',exact:true}).click(); warned=true;
        }
        let action=state.habilidadPendiente?valid.find(a=>a.id==='HABILIDAD'):null;
        if(!action && !used.has('PENSAR')) action=valid.find(a=>a.id==='PENSAR');
        if(!action) action=valid.find(a=>a.id==='HABILIDAD');
        if(!action) action=(state.mano.length?['TRABAJAR','INICIAR','COBRAR','FIN_TURNO']:['TRABAJAR','PENSAR','COBRAR','FIN_TURNO']).map(id=>valid.find(a=>a.id===id)).find(Boolean);
        assert(action);
        const button=page.locator(`[data-command=action][data-action=${action.id}]`);
        if(!action.opciones.length) {
          if(action.id==='FIN_TURNO' && (state.accionesRestantes || valid.some(a=>a.id==='HABILIDAD'))) {
            await button.click();await mutate(page,()=>page.locator('[data-command=confirm-end]').click());
          } else await mutate(page,()=>button.click());
        } else {
          await button.click();const option=action.opciones[0];
          if(action.id==='INICIAR') {
            await page.locator(`[data-command=start-choice][data-index="${option.indice}"]`).click();
            assert((await page.locator('.action-preview').innerText()).includes('monedas'));
            await mutate(page,()=>page.locator('[data-command=start]').click());
          } else if(option.rol) {
            assert(action.opciones.every(o=>o.objetivo!=='Decana'));
            await mutate(page,()=>page.locator('[data-command=veto-choice][data-index="0"]').click());
          } else {
            await page.locator('[data-command=target][data-index="0"]').click();
            assert.equal(await page.locator('.action-preview').innerText(),option.previsualizacion);
            assert.equal((await view(page)).revision,own.revision);
            if(!previewCaptured) {
              await page.screenshot({path:`${out}/previsualizacion-${count}.png`});previewCaptured=true;
            }
            await mutate(page,()=>page.locator('[data-command=confirm-target]').click());
          }
        }
        used.add(action.id);
      }
      if(!infoSurvived) {
        await observer.waitForTimeout(1200); await ready(observer);
        assert.equal(await observer.locator('#modal-title').innerText(),'El conocimiento se convierte en prestigio');
        await observer.locator('[data-command=close]').click(); infoSurvived=true;
      }
      if(step===10) {
        const before=await view(page); await page.reload(); await ready(page);
        assert.deepEqual(await view(page),before);
        await page.screenshot({path:`${out}/mesa-${count}.png`,fullPage:true});
      }
      if(step===999) throw Error('La partida no terminó');
    }
    const final=await view(host); assert.equal(final.fase,'FINALIZADA');
    for(const page of pages.values()) {
      await page.waitForFunction(()=>document.querySelector('#turn-panel strong')?.textContent==='Partida finalizada');
      await ready(page);assert.deepEqual((await view(page)).partida.ganadores,final.partida.ganadores);
    }
    await contexts[0].setOffline(true);
    await host.locator('.network-status:not([hidden])').waitFor({timeout:20000});
    await contexts[0].setOffline(false);await host.locator('.network-status').waitFor({state:'hidden',timeout:20000});
    assert.equal((await view(host)).fase,'FINALIZADA');
    assert.deepEqual(errors,[]);assert(warned && infoSurvived && snapshotStable && unavailableExplained && previewCaptured);
    for(const required of ['SELECCIONAR','PENSAR','INICIAR','TRABAJAR','FIN_TURNO','SIGUIENTE_RONDA']) assert(used.has(required),required);
    reports.push({players:count,rounds:final.partida.ronda,actions:[...used],infoSurvived,warned,snapshotStable,unavailableExplained,previewCaptured,errors});
    console.log(JSON.stringify(reports.at(-1)));for(const context of contexts) await context.close();
  }
  await writeFile(`${out}/result.json`,JSON.stringify(reports,null,2));
} finally {await browser.close();}
