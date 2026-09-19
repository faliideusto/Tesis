"""Prueba opcional real de UI: pip install playwright; py tools/qa_multiplayer.py.
Requiere el servidor en TESIS_URL (por defecto http://localhost:8091).
Usa dos contextos aislados y solo controles de la UI para mutar la partida.
Los GET autenticados se usan como oráculo de prueba; nunca se imprimen tokens.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base=os.environ.get('TESIS_URL','http://localhost:8091')
out=Path('target/qa-multiplayer'); out.mkdir(parents=True,exist_ok=True)
report={'steps':0,'actions':[], 'reloads':[], 'errors':[]}

def view(page):
    identity=page.evaluate("JSON.parse(sessionStorage.getItem('tesis.sala'))")
    response=page.request.get(base+'/api/salas/'+identity['codigo']+'/estado',headers={'Authorization':'Bearer '+identity['playerToken']})
    assert response.ok
    return response.json()

def mutation(page, click):
    with page.expect_response(lambda r:'/api/salas/' in r.url and r.request.method=='POST') as pending:
        click()
    r=pending.value
    assert r.ok, r.text()
    return r.json()

def reload(page, phase):
    before=view(page)
    page.reload()
    expect(page.locator('.lobby-panel' if phase=='lobby' else '#board')).to_be_visible()
    assert view(page)==before
    assert page.locator('img').evaluate_all('(images) => images.every(i => i.complete && i.naturalWidth > 0)')
    report['reloads'].append(phase)

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    ca=browser.new_context(viewport={'width':1600,'height':900})
    cb=browser.new_context(viewport={'width':1600,'height':900})
    a=ca.new_page(); b=cb.new_page()
    for page in (a,b):
        page.on('pageerror',lambda error:report['errors'].append(str(error)))
        page.goto(base)
        expect(page).to_have_title('Tesis · La mesa del conocimiento')
        page.screenshot(path=str(out/('inicio.png')),full_page=True)
    a.locator('#create-room input').fill('Fali')
    a.get_by_role('button',name='Crear sala',exact=True).click()
    expect(a.locator('.room-code')).to_be_visible()
    code=a.locator('.room-code').inner_text()
    b.locator('#join-room [name=codigo]').fill(code.lower())
    b.locator('#join-room [name=nombre]').fill('Jefe')
    b.get_by_role('button',name='Unirse a sala',exact=True).click()
    expect(b.locator('.lobby-players')).to_contain_text('Fali')
    expect(a.locator('.lobby-players')).to_contain_text('Jefe')
    assert b.get_by_role('button',name='Iniciar partida',exact=True).count()==0
    a.screenshot(path=str(out/'lobby-fali.png'),full_page=True)
    b.screenshot(path=str(out/'lobby-jefe.png'),full_page=True)
    reload(a,'lobby'); reload(b,'lobby')
    mutation(a,lambda:a.get_by_role('button',name='Iniciar partida',exact=True).click())
    pages={'Fali':a,'Jefe':b}; used=set(); did_selection=False; did_turn=False; did_pending=False; stable=False
    for step in range(1000):
        room=view(a); state=room['partida']
        if room['fase']=='FINALIZADA': break
        page=pages[state['actual']]; own=view(page); state=own['partida']
        expect(page.locator('#board')).to_be_visible()
        if state['fase']=='SELECCION_ROLES':
            expect(page.locator('#modal')).not_to_be_visible()
            page.locator('[data-command=phase]').click()
            expect(page.locator('#modal-title')).to_have_text('Elige tu personaje')
            if not did_selection:
                reload(page,'seleccion'); did_selection=True
                expect(page.locator('#modal')).not_to_be_visible()
                page.locator('[data-command=phase]').click()
                page.screenshot(path=str(out/'personajes.png'),full_page=True)
            # Comité ejercita la decisión inicial; Pre-Doctoral agiliza después la partida.
            pref=[1,6,3,5,2,4,7] if state['ronda']==1 else [6,3,5,2,4,7,1]
            role=min(state['seleccion'],key=lambda r:pref.index(r['orden']))
            page.locator(f'.role-selection [data-index="{role["indice"]}"]').click()
            expect(page.locator('#modal-title')).to_have_text('Representa a tu academia')
            if not stable:
                page.wait_for_timeout(2100)
                expect(page.locator('#modal-title')).to_have_text('Representa a tu academia')
                stable=True; report['modal_stable_over_polls']=True
            mutation(page,lambda:page.locator('[data-command=confirm-role]').click())
            used.add('SELECCIONAR')
        elif state['fase']=='FIN_RONDA':
            expect(page.locator('#modal')).not_to_be_visible()
            mutation(page,lambda:page.locator('[data-command=next-round]').click())
            used.add('SIGUIENTE_RONDA')
        else:
            if not did_turn: reload(page,'turno'); did_turn=True
            if state['habilidadPendiente'] and not did_pending:
                reload(page,'comite_pendiente'); did_pending=True
                assert view(page)['partida']['habilidadPendiente']
            valid={x['id']:x for x in state['acciones'] if x['disponible']}
            if state['habilidadPendiente']: kind='HABILIDAD'
            elif 'PENSAR' not in used and 'PENSAR' in valid: kind='PENSAR'
            elif 'HABILIDAD' in valid and 'HABILIDAD' not in used: kind='HABILIDAD'
            else:
                order=['TRABAJAR','INICIAR','COBRAR','FIN_TURNO'] if state['mano'] else ['TRABAJAR','PENSAR','COBRAR','FIN_TURNO']
                kind=next(x for x in order if x in valid)
            button=page.locator(f'[data-command=action][data-action={kind}]')
            expect(button).to_be_enabled()
            options=valid[kind]['opciones']
            if not options:
                mutation(page,button.click)
            else:
                button.click(); option=options[0]
                if kind=='INICIAR':
                    page.locator(f'[data-command=start-choice][data-index="{option["indice"]}"]').click()
                    mutation(page,lambda:page.locator('[data-command=start]').click())
                elif kind=='TRABAJAR':
                    page.locator(f'.study-selector [data-index="{option["indice"]}"]').click()
                    mutation(page,lambda:page.locator('[data-command=work]').click())
                else:
                    # Nombrar Decana conserva la inmunidad y evita vetar al rival en esta prueba.
                    chosen=next((i for i,o in enumerate(options) if o.get('objetivo')=='Decana'),0) if state['habilidadPendiente'] else 0
                    mutation(page,lambda:page.locator(f'[data-command=target][data-index="{chosen}"]').click())
            used.add(kind)
        report['steps']=step+1
        if step%10==0: print(f'UI paso {step}, ronda {state["ronda"]}, fase {state["fase"]}',flush=True)
        if step==10:
            for name,page in pages.items():
                expect(page.locator('#local h2')).to_have_text(name)
                page.screenshot(path=str(out/('mesa-'+name.lower()+'.png')),full_page=True)
                (out/('estado-'+name.lower()+'.json')).write_text(json.dumps(view(page)['partida'],ensure_ascii=False),encoding='utf-8')
    else: raise AssertionError('La partida no terminó')
    final=view(a); assert final['fase']=='FINALIZADA'
    assert final['partida']['ronda']>1
    assert used.issuperset({'SELECCIONAR','COBRAR','PENSAR','INICIAR','TRABAJAR','FIN_TURNO','SIGUIENTE_RONDA'})
    for name,page in pages.items():
        # Only the person who explicitly asked to see results opens them immediately.
        if not page.locator('#modal').is_visible():
            page.locator('[data-command=phase]').click()
        expect(page.locator('.final-result')).to_be_visible()
        assert view(page)['partida']['ganadores']==final['partida']['ganadores']
        page.screenshot(path=str(out/('final-'+name.lower()+'.png')),full_page=True)
    # Corte temporal de red y recuperación sin borrar identidad ni partida.
    ca.set_offline(True); a.wait_for_timeout(2200)
    expect(a.locator('.network-status')).to_contain_text('Reconectando')
    ca.set_offline(False); expect(a.locator('.network-status')).to_be_hidden(timeout=16000)
    assert view(a)['fase']=='FINALIZADA'
    report.update(actions=sorted(used),rounds=final['partida']['ronda'],winners=final['partida']['ganadores'],network_recovered=True)
    assert not report['errors'],report['errors']
    (out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)
    browser.close()
