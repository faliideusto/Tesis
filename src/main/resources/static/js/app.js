import {api} from './api.js';
import {img, esc} from './dom.js';
import {board} from './board.js';
import {ideaCard, roleCard} from './cards.js';
import {studies, studyRow} from './players.js';
import {dialog, closeDialog, phaseDialog} from './dialogs.js';
import {notify, feedback, resetFeedback, captureTable} from './feedback.js';

let state = null, room = null, busy = false, selectedRole = null, pendingAction = null;
let timer, screen = 'home', generation = 0;
const app = document.getElementById('app');
const connection = document.createElement('div');
connection.className='network-status'; connection.setAttribute('role','status'); connection.hidden=true;
document.body.append(connection);
function connectionStatus(text='') { connection.textContent=text; connection.hidden=!text; }
function stopPolling() { clearTimeout(timer); generation++; }
function schedulePoll() {
  clearTimeout(timer);
  if (screen === 'home' || !api.identity()) return;
  const current = generation;
  timer = setTimeout(async () => {
    try {
      const next = await api.state();
      if (current === generation) { connectionStatus(); renderRoom(next); }
    } catch (error) { if (current === generation) handleError(error); }
    finally { if (current === generation) schedulePoll(); }
  },900);
}
function home() {
  stopPolling(); screen='home'; closeDialog(); resetFeedback(); connectionStatus();
  app.innerHTML = `<section class="home-screen"><nav class="home-nav"><span>UNA MESA. MUCHAS IDEAS.</span><button class="text-button" data-command="help">Cómo jugar</button></nav>
    <div class="home-copy">${img('Logo/logo_tesis.png','home-logo','Tesis')}<span class="eyebrow">EL CONOCIMIENTO DEJA HUELLA</span>
    <h1>Construye tu<br><em>legado académico.</em></h1><p>Reúne a tu academia. Cada persona juega desde su dispositivo, con su mano privada y una mesa compartida.</p>
    <div class="home-features"><span>8 personajes</span><span>7 tipos de idea</span><span>2–7 jugadores</span></div></div>
    <section class="setup-panel"><span class="eyebrow">LAS PUERTAS ESTÁN ABIERTAS</span><h2>Reúne a tu academia</h2><p>Solo necesitas tu nombre y un código de sala.</p>
      <form id="create-room" class="room-form"><label>Tu nombre<input name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Fali"></label><button class="gold-button" type="submit">Crear sala</button></form>
      <div class="room-divider">O ENTRA EN UNA SALA</div>
      <form id="join-room" class="room-form"><label>Código de sala<input name="codigo" maxlength="5" minlength="5" required autocomplete="off" placeholder="A7K3Q" class="code-input"></label><label>Tu nombre<input name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Jefe"></label><button class="gold-button" type="submit">Unirse a sala</button></form>
      ${api.identity() ? '<button class="text-button resume" data-command="resume">Volver a mi sala</button>' : ''}
    </section><div class="home-footer">INVESTIGAR <span>·</span> TRANSFORMAR <span>·</span> MEJORAR</div></section>`;
}
function lobby() {
  closeDialog();
  app.innerHTML = `<section class="home-screen lobby-screen"><div class="home-copy">${img('Logo/logo_tesis.png','home-logo','Tesis')}<span class="eyebrow">TU ACADEMIA TE ESPERA</span><h1>Una sala.<br><em>Muchas ideas.</em></h1><p>Comparte el código con los demás. Cada persona debe abrir esta misma web en su dispositivo.</p><button class="text-button" data-command="home">Volver al inicio</button></div>
    <section class="setup-panel lobby-panel"><span class="eyebrow">CÓDIGO DE SALA</span><h2 class="room-code">${esc(room.codigo)}</h2><p>Tu identidad: <strong>${esc(room.yo)}</strong></p><h3>Jugadores · ${room.jugadores.length} / 7</h3><ul class="lobby-players">${room.jugadores.map(n=>`<li>${n===room.anfitrion?'♛ ':''}${esc(n)}${n===room.yo?' · tú':''}<small>${n===room.anfitrion?'Anfitrión':''}</small></li>`).join('')}</ul>
    ${room.soyAnfitrion ? `<button class="gold-button" data-command="start-game" ${room.jugadores.length<2?'disabled':''}>Iniciar partida</button><p class="setup-note">${room.jugadores.length<2?'Esperando jugadores. Se necesitan al menos dos.':'Todo preparado. Puedes iniciar la partida.'}</p>` : `<p class="waiting-copy">Esperando a que ${esc(room.anfitrion)} inicie la partida…</p>`}</section></section>`;
}
function renderRoom(next, force=false) {
  if (!force && room?.codigo===next.codigo && room.revision===next.revision) return;
  const before=state;
  const positions=captureTable();
  const sameRoom=room?.codigo===next.codigo;
  if (!sameRoom) resetFeedback();
  room=next; screen=room.fase==='LOBBY'?'lobby':'game';
  if (screen==='lobby') { state=null; lobby(); return; }
  state={...room.partida, yo:room.yo};
  selectedRole=null; pendingAction=null;
  closeDialog();
  board(state); feedback(sameRoom ? before : null,state,positions);
}
function handleError(error) {
  if (error.status) connectionStatus();
  if ([401,404].includes(error.status) && screen !== 'home') {
    api.forget(); room=null; state=null; home();
    dialog('No podemos recuperar tu sala',`<p>${esc(error.message)}</p><p>Vuelve a crear una sala o introduce un código para unirte.</p>`); return;
  }
  if (!error.status) connectionStatus('Reconectando… conservamos tu identidad y volveremos a intentarlo.');
  else notify(error.message,'error');
}
async function run(task) {
  if (busy) return;
  stopPolling(); busy=true; document.body.classList.add('busy'); connectionStatus('Conectando con la sala…');
  try { renderRoom(await task(),true); connectionStatus(); }
  catch (error) {
    handleError(error);
    if (error.status===409 && api.identity()) {
      try { renderRoom(await api.state(),true); connectionStatus(); } catch (next) { handleError(next); }
    }
  } finally { busy=false; document.body.classList.remove('busy'); schedulePoll(); }
}
const act = (type, option = {}) => run(() => api.action(room.revision,type,option));

function help() {
  dialog('El conocimiento se convierte en prestigio', `<div class="rules-copy"><p><strong>1. Elige un personaje.</strong> Se descarta un rol al azar. Cada persona elige entre los restantes. Se juega en orden de personaje, de menor a mayor.</p>
    <p><strong>2. Decide cómo avanzar.</strong> En tu turno puedes realizar hasta dos acciones: cobrar 2 monedas, pensar para robar una idea, pagar una idea para iniciar un estudio o trabajar en un estudio propio.</p>
    <p><strong>3. Aprovecha tu habilidad.</strong> No consume acciones base. Las habilidades activas se usan una vez por turno, salvo Editorial, que puede comprar trabajo varias veces. El Comité debe nombrar un rol antes de actuar.</p>
    <p><strong>4. Publica y deja tu huella.</strong> Al completar el trabajo, publicas automáticamente y ganas el prestigio de la carta. Cuando alguien publica su tercer artículo, se termina la ronda. Gana quien tenga más prestigio; los empates comparten victoria.</p>
    <p><strong>Una sala, varios dispositivos.</strong> Comparte el código y juega desde tu navegador. Solo tú ves tu mano. Al recargar recuperas tu identidad en esta pestaña. Las salas caducan tras 24 horas sin consultas válidas y se pierden al reiniciar el servidor.</p>
    <p><strong>Mazo inagotable.</strong> Los siete tipos de idea permanecen siempre disponibles. Cada reparto y robo elige una carta al azar, con posibilidad de repetir un tipo. Las cartas no se acaban.</p></div>`, {wide:false});
}
function chooseAction(id) {
  const action = state.acciones.find(a => a.id === id);
  if (!action?.disponible) return;
  if (!action.opciones.length) { act(id); return; }
  pendingAction = action;
  let content;
  if (id === 'INICIAR') content = `<div class="idea-selection">${state.mano.map(c => ideaCard(c,{command:'start-choice',disabled:!action.opciones.some(o => o.indice === c.indice)})).join('')}</div>`;
  else if (id === 'TRABAJAR') {
    const player = state.jugadores.find(p => p.nombre === state.yo);
    const allowed = new Set(action.opciones.map(o => o.indice));
    content = `<div class="study-selector">${player.estudios.filter(e => allowed.has(e.indice)).map(e => studyRow(e, player.nombre, {selection:true})).join('')}</div>`;
  } else content = `<div class="target-list">${action.opciones.map((o,i) => `<button class="target-button" data-command="target" data-index="${i}">${esc(o.etiqueta)}<span>Seleccionar</span></button>`).join('')}</div>`;
  dialog(action.nombre, `<p class="decision-copy">${esc(action.descripcion)}</p>${content}`, {wide:id === 'INICIAR'});
}
function inspect(c, study = null, player = null) {
  const canStart = !study && state.acciones.find(a => a.id === 'INICIAR')?.opciones.some(o => o.indice === c.indice)
    && state.acciones.find(a => a.id === 'INICIAR')?.disponible;
  const canWork = study && player === state.yo && state.acciones.find(a => a.id === 'TRABAJAR')?.disponible
    && state.acciones.find(a => a.id === 'TRABAJAR')?.opciones.some(o => o.indice === study.indice);
  dialog(c.nombre, `<div class="card-detail">${ideaCard(c,{command:'noop'})}<div><span class="eyebrow">${study ? study.publicado ? 'ARTÍCULO PUBLICADO' : 'ESTUDIO EN DESARROLLO' : 'CARTA DE IDEA'}</span><h2>${esc(c.nombre)}</h2>
    <dl><div><dt>Coste de inicio</dt><dd>${c.coste} monedas</dd></div><div><dt>Trabajo requerido</dt><dd>${c.trabajo} puntos</dd></div><div><dt>Prestigio</dt><dd>${c.prestigio}${study?.prestigioExtra ? ` + ${study.prestigioExtra}` : ''}</dd></div></dl>
    ${study ? `<p>Progreso: ${study.trabajo} / ${c.trabajo}</p>` : ''}
    ${canStart ? `<button class="gold-button" data-command="start" data-index="${c.indice}">Iniciar estudio · ${c.coste} monedas</button>` : ''}
    ${canWork ? `<button class="gold-button" data-command="work" data-index="${study.indice}">Trabajar en este estudio</button>` : ''}
    ${!study && !canStart ? '<p class="muted">No puedes iniciar esta idea ahora. Consulta tus monedas y acciones disponibles.</p>' : ''}</div></div>`);
}

document.addEventListener('submit', e => {
  if (!['create-room','join-room'].includes(e.target.id)) return;
  e.preventDefault();
  const fields=new FormData(e.target); const name=String(fields.get('nombre')).trim();
  run(() => e.target.id==='create-room' ? api.create(name) : api.join(String(fields.get('codigo')),name));
});
document.addEventListener('click', e => {
  const button = e.target.closest('[data-command]'); if (!button || button.disabled || busy) return;
  const index = Number(button.dataset.index);
  switch (button.dataset.command) {
    case 'home': home(); break;
    case 'resume': screen='connecting'; run(() => api.state()); break;
    case 'start-game': run(() => api.start(room.revision)); break;
    case 'help': help(); break;
    case 'close': closeDialog(); break;
    case 'phase': phaseDialog(state); break;
    case 'next-round': {
      const showResults = state.ultimaRonda;
      act('SIGUIENTE_RONDA').then(() => {
        if (showResults && screen === 'game' && state.fase === 'FIN_PARTIDA') phaseDialog(state);
      });
      break;
    }
    case 'action': chooseAction(button.dataset.action); break;
    case 'role': {
      selectedRole = state.seleccion.find(r => r.indice === index);
      dialog('Representa a tu academia', `<div class="role-confirm">${roleCard(selectedRole,{command:'noop',selected:true})}<div><span class="eyebrow">ORDEN DE TURNO ${selectedRole.orden}</span><h2>${esc(selectedRole.nombre)}</h2><p>${esc(selectedRole.habilidad)}</p><div class="dialog-buttons"><button class="gold-button" data-command="confirm-role">Elegir personaje</button><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div></div>`);
      break;
    }
    case 'back-roles': phaseDialog(state); break;
    case 'confirm-role': act('SELECCIONAR',{indice:selectedRole.indice}); break;
    case 'target': {
      const option = pendingAction.opciones[index];
      const payload = {}; if (option.indice !== undefined) payload.indice = option.indice; if (option.objetivo !== undefined) payload.objetivo = option.objetivo;
      act(pendingAction.id,payload); break;
    }
    case 'inspect': inspect(state.mano.find(c => c.indice === index)); break;
    case 'start-choice': inspect(state.mano.find(c => c.indice === index)); break;
    case 'start': act('INICIAR',{indice:index}); break;
    case 'work': act('TRABAJAR',{indice:index}); break;
    case 'study': case 'public-study': {
      const p = state.jugadores.find(p => p.nombre === button.dataset.player);
      const study = p.estudios.find(s => s.indice === index); inspect(study.carta,study,p.nombre); break;
    }
    case 'rival': {
      const p = state.jugadores.find(p => p.nombre === button.dataset.player);
      dialog(`Academia de ${p.nombre}`, `<div class="rival-details"><p>${p.monedas} monedas · ${p.prestigio} prestigio · ${p.cartas} ideas en mano</p>${studies(p,false).replace('Mis estudios','Estudios públicos')}</div>`); break;
    }
    case 'ability-detail': {
      const r = state.jugadores.find(p => p.nombre === state.yo).rol;
      dialog(r.nombre, `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p></div></div>`); break;
    }
    case 'history': dialog('Crónica de la mesa', `<ol class="chronicle">${state.eventos.map(event => `<li class="${event.publicacion ? 'publication' : ''}">${esc(event.texto)}</li>`).join('') || '<li>La academia acaba de abrir sus puertas.</li>'}</ol>`); break;
  }
});

async function boot() {
  if (!api.identity()) { home(); return; }
  screen='connecting';
  try { renderRoom(await api.state(),true); connectionStatus(); }
  catch (error) {
    handleError(error);
    if (screen!=='home') app.innerHTML='<div class="connection-error"><h1>Recuperando tu academia</h1><p>Volveremos a conectar automáticamente.</p><button class="text-button" data-command="home">Volver al inicio</button></div>';
  } finally { schedulePoll(); }
}
boot();
