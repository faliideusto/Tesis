"""QA de presentación con estados controlados; no modifica salas ni reglas.

Servidor en TESIS_URL (8091 por defecto), Chrome y playwright instalados.
Complementa qa_multiplayer.py con animaciones, privacidad y tamaños de mesa.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get('TESIS_URL', 'http://localhost:8091')
out = Path('target/qa-table-feedback')
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1600, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.evaluate("""async () => {
        window.boardModule = await import('/js/board.js');
        window.fx = await import('/js/feedback.js');
        const card = {indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,
            arte:'articulos/03_casos_controles.webp',marco:'cartas/marco_articulo_comun.webp'};
        const role = {indice:0,nombre:'Pre-Doctoral',orden:6,habilidad:'La acción de trabajar te aporta 2 puntos de trabajo durante toda la ronda.',arte:'personajes/07_pre_doctoral.webp'};
        window.initial = {yo:'Ana',fase:'TURNO_JUGADOR',ronda:1,actual:'Bruno',bloqueada:false,
            ideas:7,roles:5,accionesRestantes:0,habilidadPendiente:false,seleccion:[],eventos:[],ganadores:[],ultimaRonda:false,aviso:'',
            jugadores:[{nombre:'Ana',monedas:4,prestigio:0,cartas:2,publicados:0,rol:role,estudios:[],activo:false},
                {nombre:'Bruno',monedas:4,prestigio:0,cartas:2,publicados:0,rol:null,estudios:[],activo:true}],
            mano:[card,{...card,indice:1}],acciones:['COBRAR','PENSAR','INICIAR','TRABAJAR','HABILIDAD','FIN_TURNO'].map(id=>({id,nombre:id,disponible:false,motivo:'Turno de Bruno',opciones:[]}))};
        window.withStudy = structuredClone(initial);
        withStudy.jugadores[1].estudios.push({indice:0,carta:card,trabajo:0,prestigioExtra:0,publicado:false});
        withStudy.jugadores[1].monedas -= 2; withStudy.jugadores[1].cartas--;
        withStudy.eventos.push({numero:1,texto:'Bruno inicia «Casos y Controles».',publicacion:false});
        boardModule.board(initial);
        const positions = fx.captureTable();
        boardModule.board(withStudy); fx.feedback(initial,withStudy,positions);
    }""")
    expect(page.locator('.table-study')).to_have_count(1)
    expect(page.locator('.table-study')).to_have_accessible_name('Casos y Controles, 0 de 2 trabajo')
    expect(page.locator('#activity-current')).to_contain_text('Nuevo estudio')
    expect(page.locator('#activity-current')).to_contain_text('Bruno')
    expect(page.locator('.flying-card')).to_have_count(1)
    expect(page.locator('#modal')).not_to_be_visible()
    page.wait_for_timeout(850)
    expect(page.locator('.flying-card')).to_have_count(0)

    # Polling the same snapshot cannot restart the visual sequence or duplicate it.
    original = page.locator('#activity-current').inner_html()
    page.evaluate('boardModule.board(withStudy); fx.feedback(withStudy,withStudy,fx.captureTable())')
    assert page.locator('#activity-current').inner_html() == original

    # Rival draws are face down even though the idea deck count stays at seven.
    page.evaluate("""() => {
        fx.resetFeedback(); window.draw = structuredClone(withStudy); draw.jugadores[1].cartas++;
        draw.eventos.push({numero:2,tipo:'accion.pensar',actor:'Bruno',texto:'Bruno roba una idea.'});
        boardModule.board(draw); fx.feedback(withStudy,draw,fx.captureTable());
    }""")
    expect(page.locator('.flying-card img')).to_have_attribute('src', '/assets/Tesis-assets/cartas/reverso_idea.webp')
    expect(page.locator('#activity-current')).to_contain_text('+1 ideas')
    assert page.locator('.idea-deck, .character-deck').count() == 0
    assert page.locator('.rival-portrait img').get_attribute('src').endswith('reverso_personaje.webp')

    # Work, review and publication use the public study identity, including duplicates.
    results = page.evaluate("""() => {
        const working = structuredClone(withStudy); working.jugadores[1].estudios[0].trabajo=1;
        const work = fx.tableChanges(withStudy,working);
        const review = fx.tableChanges(working,withStudy);
        window.published = structuredClone(working);
        const rival = published.jugadores[1]; rival.estudios[0].trabajo=2;
        rival.estudios[0].publicado=true; rival.publicados=1; rival.prestigio=3;
        published.eventos.push({numero:2,texto:'Bruno publica «Casos y Controles».',publicacion:true});
        fx.resetFeedback(); boardModule.board(published); fx.feedback(working,published);
        const duplicate = structuredClone(published);
        duplicate.jugadores[1].estudios.push({...duplicate.jugadores[1].estudios[0],indice:1,trabajo:0,publicado:false});
        return {work:work[0].title,review:review[0].title,
            duplicate:fx.tableChanges(published,duplicate).map(c=>c.study?.indice),
            unchanged:fx.tableChanges(published,published).length};
    }""")
    assert results == {'work': 'Avanza el estudio', 'review': 'Revisión del estudio', 'duplicate': [1], 'unchanged': 0}
    expect(page.locator('.table-study.published')).to_have_count(1)
    expect(page.locator('#activity-current')).to_contain_text('Artículo publicado')
    expect(page.locator('#activity-current')).to_contain_text('+3 prestigio')
    page.wait_for_timeout(300)
    rival_box = page.locator('.rival-seat').first.bounding_box()
    activity_box = page.locator('.table-activity').bounding_box()
    assert rival_box['y'] + rival_box['height'] <= activity_box['y']
    page.screenshot(path=str(out / 'publicacion.png'), full_page=True)

    # A round transition leaves the last move visible, with an explicit invitation.
    page.evaluate("""() => {
        window.selection = structuredClone(published); selection.fase='SELECCION_ROLES';
        selection.actual='Ana'; selection.seleccion=[initial.jugadores[0].rol];
        boardModule.board(selection); fx.feedback(published,selection);
    }""")
    expect(page.locator('#modal')).not_to_be_visible()
    expect(page.locator('[data-command=phase]')).to_be_visible()
    expect(page.locator('#actions [data-command=phase]')).to_have_count(1)
    expect(page.locator('#phase-message button')).to_have_count(0)
    expect(page.locator('#hand-count, .zone-heading')).to_have_count(0)
    expect(page.locator('#turn-panel strong')).to_have_text('Elige Ana')
    expect(page.locator('#activity-current')).to_contain_text('Artículo publicado')

    page.evaluate("""() => {
        const end = structuredClone(selection); end.fase='FIN_RONDA'; end.seleccion=[];
        end.acciones=[{id:'SIGUIENTE_RONDA',nombre:'Siguiente ronda',disponible:true,descripcion:'Continuar'}];
        boardModule.board(end);
    }""")
    expect(page.locator('[data-command=next-round]')).to_have_count(1)
    expect(page.locator('#actions [data-command=next-round]')).to_be_visible()
    expect(page.locator('#phase-message button')).to_have_count(0)

    # Plagiador exchanges hands, including equal-size hands: never a deck draw.
    page.evaluate("""() => {
        fx.resetFeedback(); const swap=structuredClone(initial);
        swap.eventos.push({numero:1,tipo:'habilidad.plagiador',actor:'Ana',objetivo:'Bruno',texto:'Ana intercambia su mano con Bruno.'});
        boardModule.board(swap); fx.feedback(initial,swap,fx.captureTable());
    }""")
    expect(page.locator('.flying-card')).to_have_count(2)
    expect(page.locator('#activity-current')).to_contain_text('Mano intercambiada')

    # The local work meter reaches the exact authoritative value after animation.
    page.evaluate("""() => {
        fx.resetFeedback(); const before=structuredClone(initial);
        before.jugadores[0].estudios=[{...structuredClone(withStudy.jugadores[1].estudios[0])}];
        const after=structuredClone(before); after.jugadores[0].estudios[0].trabajo=1;
        boardModule.board(after); fx.feedback(before,after);
    }""")
    page.wait_for_function("() => document.querySelector('#studies progress').value === 1")
    expect(page.locator('#activity-current')).to_contain_text('0 → 1 / 2 trabajo')

    # No motion preference still delivers the same visual information.
    page.emulate_media(reduced_motion='reduce')
    page.evaluate('fx.resetFeedback(); boardModule.board(withStudy); fx.feedback(initial,withStudy,fx.captureTable())')
    expect(page.locator('.flying-card')).to_have_count(0)
    expect(page.locator('#activity-current')).to_contain_text('Nuevo estudio')
    page.evaluate('fx.feedback(null,withStudy)')
    expect(page.locator('#activity-current')).to_contain_text('La mesa está al día')
    expect(page.locator('.flying-card')).to_have_count(0)

    # Every supported table size, with public studies and narrow screens.
    for count, width, height in [(n,w,h) for n in range(3,6) for w,h in [(1920,1080),(1600,900),(1024,768),(390,844)]]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate("""count => {
            fx.resetFeedback(); const state=structuredClone(published);
            while(state.jugadores.length<count) state.jugadores.push({...structuredClone(state.jugadores[1]),nombre:`Academia ${state.jugadores.length+1}`,activo:false});
            for(const player of state.jugadores.slice(1)) player.estudios=Array.from({length:8},(_,indice)=>({...structuredClone(published.jugadores[1].estudios[0]),indice}));
            boardModule.board(state); fx.feedback(null,state);
        }""", count)
        page.wait_for_function("() => [...document.images].every(i=>i.complete && i.naturalWidth>0)")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (count,width,'overflow')
        assert page.locator('.table-study').count() == (count-1)*8
        seats = [seat.bounding_box() for seat in page.locator('.rival-seat').all()]
        for i, first in enumerate(seats):
            for second in seats[i+1:]:
                assert (first['x'] + first['width'] <= second['x'] + 1
                        or second['x'] + second['width'] <= first['x'] + 1
                        or first['y'] + first['height'] <= second['y'] + 1
                        or second['y'] + second['height'] <= first['y'] + 1), (count,width,'seat overlap',seats)
        if width >= 1000:
            assert page.evaluate('document.documentElement.scrollHeight <= innerHeight'), (count,width,'vertical scroll')
            if count == 4:
                assert seats[0]['y'] < seats[1]['y'] and seats[1]['y'] == seats[2]['y']
                centers = [s['x']+s['width']/2 for s in seats]
                assert abs(centers[0]-width/2) < 2 and centers[1] < width/3 and centers[2] > width*2/3
            if count == 6:
                assert len({round(s['y']) for s in seats[:3]}) == 1
                assert seats[3]['x'] == seats[0]['x'] and seats[4]['x'] == seats[2]['x']
            assert page.evaluate("""() => [...document.querySelectorAll('.rival,.table-study,.hand .game-card,#actions')].every(e=>{
                const r=e.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight+1 && r.left>=0 && r.right<=innerWidth+1;
            })"""), (count,width,'content outside viewport')
            activity=page.locator('.table-activity').bounding_box()
            for seat in seats:
                assert (seat['x']+seat['width']<=activity['x']+1 or activity['x']+activity['width']<=seat['x']+1
                        or seat['y']+seat['height']<=activity['y']+1 or activity['y']+activity['height']<=seat['y']+1), (count,width,'activity covers rival')
        else:
            boxes = [page.locator(sel).bounding_box() for sel in ['#rivals','#decks','#phase-message','.player-zone']]
            for first, second in zip(boxes, boxes[1:]):
                assert first['y']+first['height']<=second['y']+1, (count,width,'overlap')
        page.screenshot(path=str(out / f'mesa-{count}-{width}.jpg'),full_page=True,type='jpeg',quality=80)
    # At full HD, all phases keep the hand, deployed cards and controls in the viewport.
    page.set_viewport_size({'width':1920,'height':1080})
    for phase in ['SELECCION_ROLES','TURNO_JUGADOR','FIN_RONDA','FIN_PARTIDA']:
        page.evaluate("""phase => {
            const s=structuredClone(published); s.fase=phase; s.actual='Ana';
            while(s.jugadores.length<6) s.jugadores.push({...structuredClone(s.jugadores[1]),nombre:`Academia ${s.jugadores.length+1}`});
            s.mano=Array.from({length:10},(_,indice)=>({...s.mano[0],indice}));
            for(const player of s.jugadores) player.estudios=Array.from({length:8},(_,indice)=>({...structuredClone(published.jugadores[1].estudios[0]),indice}));
            s.seleccion=phase==='SELECCION_ROLES'?[initial.jugadores[0].rol]:[];
            s.acciones=phase==='FIN_RONDA'?[{id:'SIGUIENTE_RONDA',nombre:'Siguiente ronda',disponible:true}]:initial.acciones;
            boardModule.board(s); fx.feedback(null,s);
        }""",phase)
        assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth'), phase
        expect(page.locator('#actions')).to_be_in_viewport()
        expect(page.locator('#hand')).to_be_in_viewport()
    page.evaluate("""() => {
        const s=structuredClone(published); s.actual='Ana'; s.acciones=initial.acciones;
        while(s.jugadores.length<6) s.jugadores.push({...structuredClone(s.jugadores[1]),nombre:`Academia ${s.jugadores.length+1}`});
        const patente={indice:0,nombre:'Patente',coste:3,trabajo:5,prestigio:5,ingresoPorTurno:2,legendaria:true,
            arte:'cartas/patente_legendaria.webp',marco:'cartas/patente_legendaria.webp'};
        s.mano=[patente,...s.mano];
        for(const player of s.jugadores.slice(1)) player.estudios=Array.from({length:3},(_,indice)=>({indice,carta:indice===0?patente:s.mano[1],trabajo:indice===0?5:1,prestigioExtra:0,publicado:indice===0}));
        boardModule.board(s); fx.feedback(null,s);
    }""")
    page.wait_for_function("() => [...document.images].every(i=>i.complete && i.naturalWidth>0)")
    assert page.evaluate('document.documentElement.scrollHeight<=innerHeight')
    expect(page.locator('#hand .card-income')).to_have_text('+2 monedas / turno')
    page.screenshot(path=str(out/'mesa-6-1920-final.jpg'),full_page=True,type='jpeg',quality=85)
    assert not errors, errors
    (out / 'result.json').write_text(json.dumps({'errors':errors,'checks':['colocacion','robo privado con mazo inagotable','intercambio de manos del mismo tamaño','sin repeticion por polling','trabajo animado','revision','publicacion','duplicados','transicion sin modal','movimiento reducido','reconexion','2 a 6 jugadores: escritorio, tablet y movil']},ensure_ascii=False,indent=2),encoding='utf-8')
    print('QA visual: todas las comprobaciones correctas.', flush=True)
    browser.close()
