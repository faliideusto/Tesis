"""Real Chromium checks for private choice and numbered public veto events.
Run against the Java server: py tools/qa_ethics.py
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('TESIS_URL','http://localhost:8091')
out=Path('target/qa-ethics');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    request=p.request.new_context(base_url=base,extra_http_headers={'X-Tesis':'1'})
    def post(path,data,token=None):
        r=request.post('/api/'+path,data=data,headers={'Authorization':'Bearer '+token} if token else {})
        assert r.ok,r.text()
        return r.json()
    def state(a):
        return request.get('/api/salas/'+a['codigo']+'/estado',headers={'Authorization':'Bearer '+a['playerToken']}).json()
    def act(a,kind,**kw):
        return post('salas/'+a['codigo']+'/accion',{'revision':state(a)['revision'],'tipo':kind,**kw},a['playerToken'])
    for attempt in range(100):
        a=post('salas',{'nombre':'Fali'})
        b=post('salas/'+a['codigo']+'/unirse',{'nombre':'Jefe'})
        c=post('salas/'+a['codigo']+'/unirse',{'nombre':'Ana'})
        post('salas/'+a['codigo']+'/iniciar',{'revision':state(a)['revision']},a['playerToken'])
        accounts={'Fali':a,'Jefe':b,'Ana':c}
        active=accounts[state(a)['partida']['actual']]
        available=state(active)['partida']['seleccion']
        if not {1,2,6}.issubset({r['orden'] for r in available}):continue
        while state(a)['partida']['fase']=='SELECCION_ROLES':
            active=accounts[state(a)['partida']['actual']]
            required={'Fali':1,'Jefe':2,'Ana':6}[state(a)['partida']['actual']]
            role=next(r for r in state(active)['partida']['seleccion'] if r['orden']==required)
            act(active,'SELECCIONAR',indice=role['indice'])
        break
    pages=[];errors=[]
    for account in (a,b,c):
        context=browser.new_context(viewport={'width':1440,'height':1000})
        context.add_init_script('sessionStorage.setItem("tesis.sala",'+json.dumps(json.dumps({'codigo':account['codigo'],'playerToken':account['playerToken']}))+')')
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base)
        expect(page.locator('#board')).to_be_visible()
        page.evaluate("""window.vetoSeen=[]; new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1 && n.matches('.fx-ethics-file'))window.vetoSeen.push(performance.now())}).observe(document.body,{childList:true});""")
        pages.append(page)
    page=pages[0]
    page.locator('[data-action=HABILIDAD]').click()
    cards=page.locator('.ethics-grid .role-card');expect(cards).to_have_count(5)
    assert not cards.filter(has_text='Decana').count()
    for _ in range(50):
        if cards.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)'): break
        page.wait_for_timeout(100)
    options=next(x for x in state(a)['partida']['acciones'] if x['id']=='HABILIDAD')['opciones']
    for i,o in enumerate(options):
        assert o['rol']['habilidad'] in cards.nth(i).get_attribute('aria-label')
    for width in (1920,1366,768,390):
        page.set_viewport_size({'width':width,'height':1000 if width>600 else 844})
        assert cards.first.bounding_box()['width']>=200
        assert cards.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
        assert page.locator('#modal').evaluate('(x)=>x.scrollWidth<=x.clientWidth+1')
        page.screenshot(path=str(out/f'selection-{width}.png'))
    page.set_viewport_size({'width':1440,'height':1000})
    cards.first.hover();page.wait_for_timeout(300)
    assert cards.first.evaluate('(x)=>getComputedStyle(x).transform')!='none'
    target=next(i for i,o in enumerate(options) if o['rol']['orden']==2)
    cards.nth(target).click()
    expect(page.locator('.veto-selected .ethics-stamp')).to_have_text('VETADO')
    page.screenshot(path=str(out/'private-stamp.png'))
    expect(page.locator('#modal')).not_to_be_visible(timeout=8000)
    events=state(b)['partida']['eventos']
    assert not any('Estad' in e['texto'] for e in events)
    assert all(pg.locator('.ethics-selection').count()==0 for pg in pages[1:])
    # Simulate visibility lifecycle deterministically in the third browser.
    pages[2].evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
    page.locator('[data-action=FIN_TURNO]').click()
    page.wait_for_timeout(1200)
    assert pages[2].evaluate('window.vetoSeen.length')==0
    pages[2].evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
    for pg in pages:
        expect(pg.locator('.fx-ethics-file')).to_be_visible(timeout=10000)
    expect(page.locator('.ethics-verdict')).to_contain_text('Jefe')
    page.screenshot(path=str(out/'public-verdict.png'))
    for pg in pages:
        expect(pg.locator('.fx-ethics-file')).not_to_be_visible(timeout=8000)
        assert pg.evaluate('window.vetoSeen.length')==1
    assert state(a)['partida']['actual']=='Ana'
    page.wait_for_timeout(2100)
    assert all(pg.evaluate('window.vetoSeen.length')==1 for pg in pages)
    for pg in pages:
        pg.reload();expect(pg.locator('#board')).to_be_visible()
        assert pg.locator('.fx-ethics-file').count()==0
    assert not errors,errors
    print('PASS: full cards, 4 viewports, hover, private stamp, 3 clients, player identity, next turn, polling and reload')
    browser.close()
