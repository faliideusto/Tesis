"""Real multiplayer role-reveal checks. Run with the Java server on TESIS_URL/8091."""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('TESIS_URL', 'http://localhost:8091')
out = Path('target/qa-role-reveal')
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    request = p.request.new_context(base_url=base, extra_http_headers={'X-Tesis': '1'})

    def post(path, data, account=None):
        response = request.post('/api/' + path, data=data,
                                headers={'Authorization': 'Bearer ' + account['playerToken']} if account else {})
        assert response.ok, response.text()
        return response.json()

    def state(account):
        response = request.get('/api/salas/' + account['codigo'] + '/estado',
                               headers={'Authorization': 'Bearer ' + account['playerToken']})
        assert response.ok
        return response.json()

    def act(account, kind, **options):
        return post('salas/' + account['codigo'] + '/accion',
                    {'revision': state(account)['revision'], 'tipo': kind, **options}, account)

    # Find a real random deal, then leave the final selection for the live clients.
    for _ in range(100):
        a = post('salas', {'nombre': 'Fali'})
        b = post('salas/' + a['codigo'] + '/unirse', {'nombre': 'Jefe'})
        c = post('salas/' + a['codigo'] + '/unirse', {'nombre': 'Ana'})
        post('salas/' + a['codigo'] + '/iniciar', {'revision': state(a)['revision']}, a)
        accounts = {'Fali': a, 'Jefe': b, 'Ana': c}
        active = accounts[state(a)['partida']['actual']]
        if not {1, 2, 6}.issubset({r['orden'] for r in state(active)['partida']['seleccion']}):
            continue
        for selection in range(3):
            name = state(a)['partida']['actual']
            active = accounts[name]
            order = {'Fali': 1, 'Jefe': 2, 'Ana': 6}[name]
            role = next(r for r in state(active)['partida']['seleccion'] if r['orden'] == order)
            if selection == 2:
                last, index = active, role['indice']
                break
            act(active, 'SELECCIONAR', indice=role['indice'])
        break
    else:
        raise AssertionError('No matching deal')

    pages, errors = [], []
    for account, size in zip((a, b, c), ((1440, 1000), (390, 844), (768, 1024))):
        context = browser.new_context(viewport={'width': size[0], 'height': size[1]})
        identity = json.dumps({'codigo': account['codigo'], 'playerToken': account['playerToken']})
        context.add_init_script('sessionStorage.setItem("tesis.sala",' + json.dumps(identity) + ')')
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(base)
        expect(page.locator('#board')).to_be_visible()
        page.evaluate("""() => {
          window.sequence=[]; window.overlap=false;
          const selector='.fx-banner, .fx-role-reveal, .fx-ethics-file';
          new MutationObserver(ms=>{
            for(const m of ms) for(const [kind, list] of [['start',m.addedNodes],['end',m.removedNodes]])
              for(const n of list) if(n.nodeType===1 && n.matches(selector))
                sequence.push({kind,cls:n.className,text:n.textContent,time:performance.now()});
            if(document.querySelectorAll(selector).length>1) overlap=true;
          }).observe(document.body,{childList:true});
        }""")
        pages.append(page)

    act(last, 'SELECCIONAR', indice=index)
    for page in pages:
        expect(page.locator('.fx-banner')).to_contain_text('Fali', timeout=5000)
        assert page.locator('.fx-role-reveal').count() == 0
    for page in pages:
        expect(page.locator('.fx-role-reveal .card-name')).to_have_text('Comité de Ética', timeout=6000)
    pages[0].wait_for_timeout(750)
    for i, page in enumerate(pages):
        card = page.locator('.fx-role-reveal .role-card')
        box = card.bounding_box()
        assert box and box['width'] >= 280
        assert box['x'] >= 0 and box['y'] >= 0
        assert box['x'] + box['width'] <= page.viewport_size['width']
        assert box['y'] + box['height'] <= page.viewport_size['height']
        assert card.locator('img').evaluate_all('(xs)=>xs.every(x=>x.complete && x.naturalWidth>0)')
        assert card.locator('.role-ability').inner_text()
        page.screenshot(path=str(out / f'reveal-{i}.png'))
    for page in pages:
        expect(page.locator('body')).not_to_have_class(re.compile('visual-busy'), timeout=12000)
        sequence = page.evaluate('sequence')
        banner_end = next(e for e in sequence if e['kind'] == 'end' and 'fx-banner' in e['cls'])
        card_start = next(e for e in sequence if e['kind'] == 'start' and 'fx-role-reveal' in e['cls'])
        card_end = next(e for e in sequence if e['kind'] == 'end' and 'fx-role-reveal' in e['cls'])
        assert card_start['time'] >= banner_end['time']
        assert card_end['time'] - card_start['time'] >= 3750
        assert not page.evaluate('overlap')

    # Private veto choice remains private; the next normal turn still reveals its card.
    act(a, 'HABILIDAD', objetivo='Estadístico')
    assert not any(e.get('rolPublico', {}).get('orden') == 2 for e in state(a)['partida']['eventos'])
    act(a, 'FIN_TURNO')
    for page in pages:
        expect(page.locator('.fx-banner')).to_contain_text('Jefe', timeout=6000)
    for page in pages:
        expect(page.locator('.ethics-verdict')).to_contain_text('Jefe', timeout=6000)
        assert page.locator('.fx-role-reveal').count() == 0
    for page in pages:
        expect(page.locator('.fx-role-reveal .card-name')).to_have_text('Pre-Doctoral', timeout=12000)
    for page in pages:
        expect(page.locator('body')).not_to_have_class(re.compile('visual-busy'), timeout=12000)
        starts = page.evaluate("sequence.filter(e=>e.kind==='start').map(e=>e.cls)")
        assert ['banner' if 'fx-banner' in x else 'card' if 'fx-role-reveal' in x else 'veto' for x in starts] == [
            'banner', 'card', 'banner', 'veto', 'banner', 'card']
        assert not page.evaluate('overlap')
    assert next(j for j in state(a)['partida']['jugadores'] if j['nombre'] == 'Jefe').get('rol') is None
    pages[0].wait_for_timeout(1800)
    for page in pages:
        assert len(page.evaluate("sequence.filter(e=>e.kind==='start')")) == 6
        page.reload()
        expect(page.locator('#board')).to_be_visible()
        assert page.locator('.fx-banner, .fx-role-reveal, .fx-ethics-file').count() == 0
    assert not errors, errors
    print('PASS: three clients, real cards, desktop/mobile/tablet, ordered turns, private veto, polling/reload')
    browser.close()
