"""Main table layout regression checks. Run against TESIS_URL (default :8091)."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out = Path('target/qa-table-layout')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1672, 'height': 941})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(os.environ.get('TESIS_URL', 'http://localhost:8091'))
    page.evaluate("""async () => {
      window.boardModule = await import('/js/board.js');
      window.fx = await import('/js/feedback.js');
      const card={indice:0,nombre:'Casos y Controles',coste:2,trabajo:2,prestigio:3,
        arte:'articulos/03_casos_controles.webp',marco:'cartas/marco_articulo_comun.webp'};
      const role={nombre:'Investigador Principal',habilidad:'Recibe una idea extra.',arte:'personajes/04_investigador_principal.webp'};
      window.fixture={bloqueada:false,yo:'Ana',actual:'Bruno',fase:'TURNO_JUGADOR',ronda:2,ideas:8,roles:5,
        accionesRestantes:0,seleccion:[],eventos:[],ganadores:[],acciones:[],
        mano:[card,{...card,indice:1,nombre:'Revisión Sistemática',arte:'articulos/05_revision_sistematica.webp',marco:'cartas/marco_articulo_epico.webp'}],
        jugadores:['Ana','Bruno','Clara','Diego','Elena','Félix'].map((nombre,i)=>({nombre,monedas:3,prestigio:3,cartas:2,publicados:1,
          rol:i%2?null:role,activo:nombre==='Bruno',estudios:[{indice:0,carta:card,trabajo:1,prestigioExtra:0,publicado:false},
          {indice:1,carta:{...card,nombre:'Revisión Sistemática',arte:'articulos/05_revision_sistematica.webp',marco:'cartas/marco_articulo_epico.webp'},trabajo:0,prestigioExtra:0,publicado:false},
          {indice:2,carta:{...card,nombre:'Artículo Transversal',arte:'articulos/02_transversal.webp'},trabajo:2,prestigioExtra:0,publicado:true}]}))};
      window.draw=(count, crowded=false)=>{window.current=structuredClone(fixture);current.jugadores=current.jugadores.slice(0,count);
        if(crowded){current.mano=Array.from({length:12},(_,indice)=>({...fixture.mano[indice%2],indice}));
          current.jugadores.forEach(p=>p.estudios=Array.from({length:10},(_,indice)=>({...p.estudios[indice%2 ? 2 : 0],indice})));}
        boardModule.board(current);fx.feedback(null,current);};draw(5);
    }""")
    page.wait_for_function('() => Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
    page.screenshot(path=str(out/'mesa-5.png'))
    # The raised card remains fully visible and lifts above its decorative lip.
    study = page.locator('#studies .table-study').first
    rest = study.bounding_box()
    study.hover()
    page.wait_for_timeout(250)
    raised = study.bounding_box()
    assert raised['y'] < rest['y'] - 5 and raised['width'] > rest['width']
    assert study.evaluate('''e => {
      const r=e.getBoundingClientRect();
      return [[.1,.1],[.9,.1],[.1,.9],[.9,.9]].every(([x,y]) =>
        e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)));
    }'''), 'raised article is clipped or covered'
    page.screenshot(path=str(out/'articulo-elevado.png'))
    page.mouse.move(0,0)
    hand = page.locator('#hand .game-card').first
    before = hand.bounding_box()
    hand.hover(position={'x':30,'y':20})
    page.wait_for_timeout(250)
    after = hand.bounding_box()
    assert after['y'] < before['y'] - 30
    assert after['width'] > before['width']
    assert after['y'] + after['height'] <= 941
    assert hand.evaluate('(e)=>{window.hoveredCard=e; return getComputedStyle(e).clipPath === "none"}')
    page.evaluate('boardModule.board(current)')
    assert hand.evaluate('(e)=>e===window.hoveredCard'), 'unchanged polling replaced the hovered card'
    page.screenshot(path=str(out/'mano-hover.png'))
    page.mouse.move(0,0)
    for count in range(3,6):
        for width,height in [(1920,1080),(1366,768),(1024,768),(768,1024),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('n=>draw(n,true)',count)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (count,width,'horizontal overflow')
            expect(page.locator('#studies .table-study')).to_have_count(10)
            expect(page.locator('#hand .game-card')).to_have_count(12)
            assert page.locator('#rivals .table-study').count() == (count-1)*10
            assert page.locator('.article-group h3').evaluate_all('(labels)=>labels.every(e=>e.scrollWidth<=e.clientWidth+1)'), (count,width,'heading clipped')
            assert page.locator('.rival-body').evaluate_all('''panels=>panels.every(p=>{
                const r=p.getBoundingClientRect(); const resources=p.querySelector('.resources').getBoundingClientRect();
                return resources.bottom<=r.bottom+1 && resources.right<=r.right+1;
            })'''), (count,width,'resources outside plaque')
            seats=[s.bounding_box() for s in page.locator('.rival-seat').all()]
            if width>=1000:
                assert page.evaluate('document.documentElement.scrollHeight<=innerHeight'),(count,width,'vertical overflow')
                local=page.locator('.local-academy').bounding_box()
                for a in seats:
                    for b in seats+[local]:
                        if a==b: continue
                        assert a['x']+a['width']<=b['x']+1 or b['x']+b['width']<=a['x']+1 or a['y']+a['height']<=b['y']+1 or b['y']+b['height']<=a['y']+1,(count,width,'seat overlap',a,b)
                assert local['y']+local['height']<height-70,(count,width,'local cards covered')
            # Both article lanes allow access to their last card, even in a crowded game.
            track=page.locator('#studies .article-scroll').first
            track.evaluate('(e)=>e.scrollLeft=e.scrollWidth')
            assert track.evaluate('(e)=>e.scrollLeft>0')
            if count==6:
                page.screenshot(path=str(out/f'mesa-6-{width}.png'),full_page=True)
    for count in (3,4,5):
        for width,height in [(1920,1080),(1366,768)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('n=>draw(n)',count)
            page.screenshot(path=str(out/f'mesa-{count}-{width}.png'))
            activity=page.locator('.table-activity').bounding_box()
            for panel in page.locator('.rival-seat,.local-academy').all():
                r=panel.bounding_box()
                assert r['x']+r['width']<=activity['x']+1 or activity['x']+activity['width']<=r['x']+1 or r['y']+r['height']<=activity['y']+1 or activity['y']+activity['height']<=r['y']+1,(count,width,'central notice overlaps academy',r,activity)
            page.evaluate('''() => {
                current.actual=current.yo; current.accionesRestantes=2;
                current.acciones=['COBRAR','PENSAR','INICIAR','TRABAJAR','HABILIDAD','FIN_TURNO'].map((id,i)=>({
                  id,nombre:['Cobrar','Pensar','Iniciar estudio','Trabajar','Habilidad','Fin de turno'][i],disponible:true,descripcion:'Acción disponible'}));
                boardModule.board(current); fx.feedback(null,current);
            }''')
            card=page.locator('#hand .game-card').first
            card.hover(position={'x':20,'y':20})
            page.wait_for_timeout(230)
            assert card.bounding_box()['y']+card.bounding_box()['height'] <= page.locator('footer').bounding_box()['y']+1,(count,width,'hover card covered by actions')
            assert page.locator('#actions button').evaluate_all('''buttons=>buttons.every(b=>{
                const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
            })'''),(count,width,'action blocked')
            page.screenshot(path=str(out/f'turno-{count}-{width}.png'))
            page.mouse.move(0,0)
    # Regression: the local identity must clear the notice on wide, short windows.
    for count in range(3,6):
        for width,height in [(1920,900),(1920,800),(1536,864),(1672,941),(1366,768)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('n=>draw(n)',count)
            notice=page.locator('.table-activity').bounding_box()
            identity=page.locator('.local-panel').bounding_box()
            assert identity['y']>=notice['y']+notice['height']+6, (count,width,height,'identity overlaps notice',identity,notice)
            if count==3 and width==1920 and height==900:
                page.mouse.move(0,0)
                page.screenshot(path=str(out/'aviso-sin-solape-1920-900.png'))
    page.set_viewport_size({'width':1366,'height':768})
    page.evaluate('draw(5)')
    page.evaluate("current.jugadores.forEach(p=>p.estudios=[]);boardModule.board(current)")
    expect(page.locator('.article-placeholder')).to_have_count(10)
    page.screenshot(path=str(out/'mesa-vacia.png'))
    page.emulate_media(reduced_motion='reduce')
    hand=page.locator('#hand .game-card').first
    hand.focus()
    assert hand.evaluate('(e)=>getComputedStyle(e).zIndex')=='20'
    assert not errors, errors
    (out/'result.json').write_text(json.dumps({'errors':errors,'checks':['3–5 players','desktop/tablet/mobile','crowded studies and hand','hover and keyboard','empty slots','reduced motion']},ensure_ascii=False,indent=2),encoding='utf-8')
    browser.close()
    print('PASS: table layout, hover, keyboard, responsive sizes, crowded states')
