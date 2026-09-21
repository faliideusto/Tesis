"""Current status UI checks with controlled public states, no room mutations."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('target/qa-activity');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('TESIS_URL','http://localhost:8092'))
    page.evaluate("""async()=>{
      window.boardModule=await import('/js/board.js');window.fx=await import('/js/feedback.js');
      window.current={yo:'Ana',actual:'Bruno',fase:'SELECCION_ROLES',ronda:1,ideas:8,roles:5,accionesRestantes:0,
        seleccion:[],eventos:[{numero:1,texto:'OLD_EVENT_PRIVATE_MARKER'}],ganadores:[],acciones:[],mano:[],
        jugadores:['Ana','Bruno'].map(nombre=>({nombre,monedas:2,prestigio:0,cartas:2,publicados:0,rol:null,estudios:[],activo:nombre==='Bruno'}))};
      window.draw=()=>{boardModule.board(current);fx.feedback(null,current)};draw();
    }""")
    expect(page.locator('#activity-current')).to_contain_text('eligiendo personaje')
    assert 'OLD_EVENT_PRIVATE_MARKER' not in page.locator('#board').inner_text()
    for width in (1440,768,390):
        page.set_viewport_size({'width':width,'height':1000 if width>600 else 844})
        panel=page.locator('.table-activity');expect(panel).to_be_visible()
        assert panel.evaluate('(x)=>x.scrollWidth<=x.clientWidth+1')
        page.screenshot(path=str(out/f'live-{width}.png'),full_page=True)
    page.evaluate("current.fase='TURNO_JUGADOR';draw()")
    expect(page.locator('#activity-current')).to_contain_text('jugando su turno')
    page.evaluate("current.actual='Ana';current.accionesRestantes=1;draw()")
    expect(page.locator('#activity-current')).to_contain_text('Es tu turno')
    page.evaluate("current.accionesRestantes=0;draw()")
    expect(page.locator('#activity-current')).to_contain_text('Sin acciones base')
    page.evaluate("current.habilidadPendiente=true;draw()")
    expect(page.locator('#activity-current')).to_contain_text('en privado')
    page.evaluate("current.fase='FIN_RONDA';current.actual='Bruno';draw()")
    expect(page.locator('#activity-current')).to_contain_text('Esperando a Bruno')
    page.wait_for_timeout(2600)
    expect(page.locator('#activity-current')).to_contain_text('Esperando a Bruno')
    assert page.locator('.table-activity [data-command=history]').count()==1
    assert not errors,errors
    browser.close()
    print('PASS: live phases, no old events or timers, desktop/tablet/mobile, history retained')
