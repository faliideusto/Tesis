import {api} from './api.js';
import {accounts} from './auth.js';
import {initAccountPanel, progressText} from './account-panel.js';
import {img, esc} from './dom.js';
import {board} from './board.js';
import {ideaCard, roleCard} from './cards.js';
import {studies, articleChoices} from './players.js';
import {dialog, closeDialog, phaseDialog, reconcileDialog, informationalDialogOpen} from './dialogs.js';
import {endTurnWarning, preview, ideaUnavailableReason, highlightTargets, clearTargets} from './decisions.js';
import {notify, feedback, resetFeedback} from './feedback.js';
import {transition, settled, resetEffects, chooseRole, chooseVeto, victory} from './effects.js';

let visualBusy = false;
let renderQueue=Promise.resolve(), latestRoom=null;
let state = null, room = null, busy = false, selectedRole = null, pendingAction = null, selectedTarget = null;
let timer, screen = 'home', generation = 0;
const app = document.getElementById('app');
const connection = document.createElement('div');
const homeMessage = 'Reúne a tu academia. Cada persona juega desde su dispositivo, con su mano privada y una mesa compartida.';
const academyIntro = () => `<div class="academy-brand">${img('Logo/logo_tesis.webp','home-logo','Tesis')}<span>EL JUEGO DE LA INVESTIGACIÓN</span></div><span class="eyebrow"><i aria-hidden="true"></i> La diferencia está en la ciencia</span>
    <h1>Construye tu<br><em>legado científico.</em></h1><p>${homeMessage}</p>
    <div class="home-features"><span><strong>3–5</strong> jugadores</span><span><strong>Una</strong> mesa compartida</span><span><strong>Tu</strong> mano privada</span></div>
    <div class="academy-showcase" aria-label="Personajes de Tesis"><div class="showcase-cards" aria-hidden="true">${img('personajes/02_estadistico.webp','showcase-card showcase-card-one')}${img('personajes/04_investigador_principal.webp','showcase-card showcase-card-two')}${img('personajes/05_decana.webp','showcase-card showcase-card-three')}</div><div class="showcase-caption"><span class="eyebrow">CADA PERSONAJE, UNA ESTRATEGIA</span><p>Una academia.<br>Muchas ambiciones.</p><span class="showcase-rule" aria-hidden="true"></span></div></div>`;
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
      if (current === generation) { connectionStatus(); void renderRoom(next).catch(handleError); }
    } catch (error) { if (current === generation) handleError(error); }
    finally { if (current === generation) schedulePoll(); }
  },900);
}
function home() {
  stopPolling(); resetEffects(); screen='home'; closeDialog(); resetFeedback(); connectionStatus();
  state=null; room=null;
  const accountOpener=document.getElementById('account-open');
  const progress=document.getElementById('account-progress');
  accountOpener.classList.remove('in-board');document.body.append(accountOpener,progress);
  progress.hidden=true;
  app.innerHTML = `<section class="home-screen"><div class="academy-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div><nav class="home-nav" aria-label="Navegación principal"><span class="home-nav-wordmark">TESIS <small>· EDICIÓN 2.1.0</small></span><div class="home-nav-actions"><button class="text-button" data-command="help">Cómo jugar <span aria-hidden="true">↗</span></button><div class="home-account-slot"></div></div></nav>
    <div class="home-copy">${academyIntro()}</div>
    <section class="setup-panel" aria-labelledby="academy-access-title"><div class="setup-heading"><span class="eyebrow">LAS PUERTAS ESTÁN ABIERTAS</span><span class="setup-seal" aria-hidden="true">T</span></div><h2 id="academy-access-title">Tu próxima gran<br>idea empieza aquí.</h2><p>Crea una mesa e invita a tu academia,<br>o entra con el código de tus amigos.</p>
      <form id="create-room" class="room-form"><label for="create-name">Tu nombre<input id="create-name" name="nombre" maxlength="24" required autocomplete="nickname" placeholder="¿Cómo te llamas?"></label><button class="gold-button" type="submit">Crear una sala <span aria-hidden="true">→</span></button></form>
      <div class="room-divider"><span>¿YA TIENES UNA INVITACIÓN?</span></div>
      <form id="join-room" class="room-form"><label for="join-code">Código de sala<input id="join-code" name="codigo" maxlength="5" minlength="5" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="A7K3Q" class="code-input"></label><label for="join-name">Tu nombre<input id="join-name" name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Tu nombre en la mesa"></label><button class="gold-button join-button" type="submit">Entrar en la academia <span aria-hidden="true">↗</span></button></form>
      ${api.identity() ? '<button class="text-button resume" data-command="resume">Volver a mi sala</button>' : ''}
      <p class="access-note"><span aria-hidden="true">◇</span> Cada persona juega desde su dispositivo.</p>
    </section><div class="home-footer"><span class="footer-motto">INVESTIGAR. TRANSFORMAR. MEJORAR.</span><span class="footer-edition">UNA MESA. MUCHAS IDEAS.</span></div></section>`;
  document.querySelector?.('.home-account-slot')?.append(accountOpener);
}
function lobby() {
  const accountOpener=document.getElementById('account-open'),progress=document.getElementById('account-progress');
  accountOpener.classList.remove('in-board');document.body.append(accountOpener,progress);
  app.innerHTML = `<section class="home-screen lobby-screen"><div class="academy-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div><nav class="home-nav" aria-label="Navegación principal"><span class="home-nav-wordmark">TESIS <small>· EDICIÓN 2.1.0</small></span><div class="home-nav-actions"><button class="text-button" data-command="help">Cómo jugar <span aria-hidden="true">↗</span></button><div class="home-account-slot"></div></div></nav><div class="home-copy">${academyIntro()}<button class="text-button lobby-back" data-command="home">← Volver al inicio</button></div>
    <section class="setup-panel lobby-panel" aria-labelledby="lobby-title"><div class="setup-heading"><span class="eyebrow">LA ACADEMIA SE REÚNE</span><span class="lobby-live"><i aria-hidden="true"></i> Sala abierta</span></div><h2 id="lobby-title">Tu mesa está lista.</h2><div class="room-code-box"><span class="eyebrow">COMPARTE ESTE CÓDIGO</span><h2 class="room-code">${esc(room.codigo)}</h2><p>Tu identidad: <strong>${esc(room.yo)}</strong></p></div><div class="lobby-roster-heading"><h3>La academia</h3><span>${room.jugadores.length} / 5 jugadores</span></div><ul class="lobby-players">${room.jugadores.map((n,i)=>`<li><span class="lobby-avatar" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="lobby-player-name">${esc(n)}${n===room.yo?'<span class="lobby-you">tú</span>':''}<small>${n===room.anfitrion?'Anfitrión':'Investigador'}</small></div><span class="lobby-player-status" aria-label="En la sala">${n===room.anfitrion?'♛':'✓'}</span></li>`).join('')}</ul>
    ${room.soyAnfitrion ? `<button class="gold-button" data-command="start-game" ${(room.jugadores.length<3 || room.jugadores.length>5)?'disabled':''}>Iniciar partida</button><p class="setup-note">${(room.jugadores.length<3 || room.jugadores.length>5)?'Esperando jugadores. Se necesitan entre 3 y 5.':'Todo preparado. Puedes iniciar la partida.'}</p>` : `<p class="waiting-copy">Esperando a que ${esc(room.anfitrion)} inicie la partida…</p>`}</section></section>`;
  document.querySelector?.('.home-account-slot')?.append(accountOpener);
  document.querySelector?.('.lobby-panel')?.append(progress);
}
function renderRoom(next, force=false) {
  const requestedGeneration=generation;
  latestRoom=next;
  const result=renderQueue.then(()=>{
    if(requestedGeneration!==generation || (latestRoom.codigo===next.codigo && latestRoom.revision>next.revision)) return;
    return applyRoom(next,force);
  });
  renderQueue=result.catch(()=>{});
  return result;
}
async function applyRoom(next, force=false) {
  // La persistencia cambia independientemente de la revisión del juego.
  if (!room || (room.codigo===next.codigo && next.revision>=room.revision) || (force && room.codigo!==next.codigo)) {
    const progress=document.getElementById('account-progress');
    const message=progressText(next.progreso);
    if(progress.textContent!==message) {
      progress.textContent=message;
      if(next.progreso?.estado==='CONFIRMADA' && accounts.signedIn()) void accounts.refreshProfile().catch(()=>{});
    }
    progress.hidden=!message || Boolean(next.partida && next.partida.fase!=='FIN_PARTIDA');
    if(room?.codigo===next.codigo) room={...room,progreso:next.progreso};
  }
  if (room?.codigo===next.codigo && room.revision>=next.revision && screen==='game') return;
  if (!force && room?.codigo===next.codigo && room.revision===next.revision) return;
  const before=state, current=generation;
  const sameRoom=room?.codigo===next.codigo;
  if (!sameRoom) { resetFeedback(); resetEffects(); }
  const after=next.partida ? {...next.partida, yo:next.yo} : null;
  visualBusy=true; document.body.classList.add('visual-busy');
  try {
    const roleConfirmation=sameRoom && before && after?.eventos.some(e=>e.numero>(before.eventos.at(-1)?.numero || 0) && e.tipo==='accion.seleccionar_personaje' && e.actor===after.yo);
    const turnOpening=sameRoom && before && after?.eventos.some(e=>e.numero>(before.eventos.at(-1)?.numero || 0)
      && ['fase.turno','turno.vetado'].includes(e.tipo));
    if (!roleConfirmation || turnOpening) reconcileDialog(sameRoom);
    if (after) {
      try { await transition(sameRoom ? before : null,after); }
      catch (error) { console.error('No se pudo representar el efecto visual',error); resetEffects(); }
    }
    if (current!==generation) return;
    room=next; screen=room.fase==='LOBBY'?'lobby':'game';
    if (screen==='lobby') { state=null; lobby(); return; }
    state=after; selectedRole=null; pendingAction=null; selectedTarget=null; clearTargets(); reconcileDialog(sameRoom);
    const accountOpener=document.getElementById('account-open'),progress=document.getElementById('account-progress');
    document.body.append(accountOpener,progress);
    board(state); feedback(sameRoom ? before : null,state); settled(sameRoom ? before : null,state);
    accountOpener.classList.add('in-board');document.querySelector('#board .utility').append(accountOpener,progress);
    const accountPageOpen=!document.getElementById('account-panel').hidden;
    if (!accountPageOpen && state.fase==='SELECCION_ROLES' && state.seleccion.length && (!before || before.fase!=='SELECCION_ROLES' || before.actual!==state.actual) && !document.getElementById('modal').open) phaseDialog(state);
    if (!accountPageOpen && state.fase==='FIN_RONDA' && (!before || before.fase!=='FIN_RONDA')) phaseDialog(state);
    if (!accountPageOpen && state.fase==='FIN_PARTIDA' && (!before || before.fase!=='FIN_PARTIDA') && !informationalDialogOpen()) { phaseDialog(state); if(before) victory(); }
  } finally {visualBusy=false; document.body.classList.remove('visual-busy');}
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
  stopPolling(); busy=true; document.body.classList.add('busy');
  try {
    const next=await task();
    connectionStatus();
    await renderRoom(next,true);
  }
  catch (error) {
    handleError(error);
    if (error.status===409 && api.identity()) {
      try {
        const next=await api.state();
        connectionStatus();
        await renderRoom(next,true);
      } catch (next) { handleError(next); }
    }
  } finally { busy=false; document.body.classList.remove('busy'); schedulePoll(); }
}
const act = (type, option = {}) => run(() => api.action(room.revision,type,option));

function help() {
  dialog('El conocimiento se convierte en prestigio', `<div class="rules-copy"><p><strong>1. Elige un personaje.</strong> Se descartan dos roles al azar con 3 jugadores y uno con 4 o 5. Cada persona elige entre los restantes. Se juega en orden de personaje, de menor a mayor.</p>
    <p><strong>2. Decide cómo avanzar.</strong> En tu turno puedes realizar hasta dos acciones: cobrar 2 monedas, pensar para robar una idea, pagar una idea para iniciar un estudio o trabajar en un estudio propio.</p>
    <p><strong>3. Aprovecha tu habilidad.</strong> No consume acciones base. Las habilidades activas se usan una vez por turno. El Comité debe nombrar un rol antes de actuar. Editorial recibe una moneda por cada artículo publicado en la mesa al iniciar su turno.</p>
    <p><strong>Revisor 2.</strong> Puede pagar una moneda para retirar hasta dos puntos de trabajo de un artículo rival en desarrollo. Decana tiene inmunidad frente a habilidades rivales durante toda la ronda.</p>
    <p><strong>4. Publica y deja tu huella.</strong> Al completar el trabajo, publicas automáticamente y ganas el prestigio de la carta. Cuando alguien publica su tercer artículo, se termina la ronda. Gana quien tenga más prestigio; los empates comparten victoria.</p>
    <p><strong>Una sala, varios dispositivos.</strong> Comparte el código y juega desde tu navegador. Solo tú ves tu mano. Al recargar recuperas tu identidad en esta pestaña. Las salas caducan tras 24 horas sin consultas válidas y se pierden al reiniciar el servidor.</p>
    <p><strong>Mazo inagotable.</strong> Cada reparto y robo usa estas probabilidades, con reposición: Ecológico 20%, Transversal 20%, Casos y Controles 17%, Cohortes 13%, Revisión Sistemática 10%, Ensayo Clínico Aleatorizado 10%, Ensayo Comunitario 6% y Patente 4%.</p>
    <p><strong>Patente · Legendaria.</strong> Cuesta 4 monedas y 5 de trabajo; da 5 de prestigio. Mientras esté publicada, genera 2 monedas al inicio de tu turno.</p></div>`, {wide:false, kind:'info'});
}
function chooseAction(id) {
  const action = state.acciones.find(a => a.id === id);
  if (!action) return;
  if (!action.disponible) {
    dialog(action.nombre, `<p>${esc(action.motivo)}</p>`, {kind:'info', snapshot:true}); return;
  }
  if (id === 'FIN_TURNO' && endTurnWarning(state)) {
    dialog('¿Terminar el turno?', `<p>${esc(endTurnWarning(state))}</p><p>Si terminas ahora, renuncias a lo que queda de este turno.</p><div class="dialog-buttons"><button class="plain-button" data-command="close">Seguir jugando</button><button class="gold-button" data-command="confirm-end">Terminar turno</button></div>`);
    return;
  }
  if (!action.opciones.length) { act(id); return; }
  pendingAction = action;
  highlightTargets(action,state);
  let content;
  const ethics = id === 'HABILIDAD' && action.opciones.every(o => o.rol);
  if (ethics) content = `<section class="ethics-selection"><p class="ethics-classification">EXPEDIENTE RESERVADO · REVISIÓN ACADÉMICA</p><p>Elige el personaje que deseas vetar. Esta decisión solo la ves tú.</p><div class="ethics-grid">${action.opciones.map((o,i) => roleCard({...o.rol,indice:i},{command:'veto-choice'})).join('')}</div><p class="ethics-status" role="status">Selecciona una carta para registrar el veto.</p></section>`;
  else if (id === 'INICIAR') content = `<div class="idea-selection">${state.mano.map(c => `<div class="idea-option ${action.opciones.some(o => o.indice === c.indice) ? 'eligible-option' : ''}">${ideaCard(c,{command:'start-choice'})}${action.opciones.some(o => o.indice === c.indice) ? '<span>Objetivo válido</span>' : `<small>${esc(ideaUnavailableReason(state,c))}</small>`}</div>`).join('')}</div>`;
  else if (action.opciones.every(o => Number.isInteger(o.indice))) content = articleChoices(action,state);
  else content = `<div class="target-list">${action.opciones.map((o,i) => `<button class="target-button" data-command="target" data-index="${i}">${esc(o.etiqueta)}<span>Seleccionar</span></button>`).join('')}</div>`;
  dialog(ethics ? 'Comité de Ética' : action.nombre, `<p class="decision-copy">${esc(action.descripcion)}</p>${content}`, {wide:ethics || action.opciones.some(o => Number.isInteger(o.indice))});
}
function inspect(c, study = null, player = null) {
  if (!c) return;
  const canStart = !study && state.acciones.find(a => a.id === 'INICIAR')?.opciones.some(o => o.indice === c.indice)
    && state.acciones.find(a => a.id === 'INICIAR')?.disponible;
  const canWork = study && player === state.yo && state.acciones.find(a => a.id === 'TRABAJAR')?.disponible
    && state.acciones.find(a => a.id === 'TRABAJAR')?.opciones.some(o => o.indice === study.indice);
  dialog(c.nombre, `<div class="card-detail">${ideaCard(c,{command:'noop'})}<div><span class="eyebrow">${study ? study.publicado ? 'ARTÍCULO PUBLICADO' : 'ESTUDIO EN DESARROLLO' : 'CARTA DE IDEA'}</span><h2>${esc(c.nombre)}</h2>
    <dl><div><dt>Coste de inicio</dt><dd>${c.coste} monedas</dd></div><div><dt>Trabajo requerido</dt><dd>${c.trabajo} puntos</dd></div><div><dt>Prestigio</dt><dd>${c.prestigio}${study?.prestigioExtra ? ` + ${study.prestigioExtra}` : ''}</dd></div></dl>
    ${c.ingresoPorTurno ? `<p>Legendaria. Mientras esté publicada, recibes ${c.ingresoPorTurno} monedas al iniciar tu turno.</p>` : ''}
    ${study ? `<p>Progreso: ${study.trabajo} / ${c.trabajo}</p>` : ''}
    ${canStart ? `${preview(state.acciones.find(a=>a.id==='INICIAR').opciones.find(o=>o.indice===c.indice))}<button class="gold-button" data-command="start" data-index="${c.indice}">Iniciar estudio · ${c.coste} monedas</button>` : ''}
    ${canWork ? `${preview(state.acciones.find(a=>a.id==='TRABAJAR').opciones.find(o=>o.indice===study.indice))}<button class="gold-button" data-command="work" data-index="${study.indice}">Trabajar en este estudio</button>` : ''}
    ${!study && !canStart ? `<p class="muted">${esc(ideaUnavailableReason(state,c))}</p>` : ''}</div></div>`, {kind:canStart || canWork ? 'decision' : 'info', snapshot:true});
}

function confirmTarget(index) {
  const option = pendingAction?.opciones[index];
  if (!option || !pendingAction.disponible) return;
  selectedTarget = index;
  const owner = state.jugadores.find(p=>p.nombre===(option.objetivo || state.yo));
  const study = owner?.estudios.find(s=>s.indice===option.indice);
  dialog(pendingAction.nombre, `<div class="target-confirm">${study ? ideaCard(study.carta,{command:'noop'}) : ''}<h2>${esc(option.etiqueta)}</h2>${study ? `<p>Academia de ${esc(owner.nombre)}</p>` : ''}${preview(option)}<div class="dialog-buttons"><button class="plain-button" data-command="back-targets">Volver a los objetivos</button><button class="gold-button" data-command="confirm-target">Confirmar ${esc(pendingAction.nombre.toLowerCase())}</button></div></div>`);
}

for (const event of ['pointerover','focusin']) document.addEventListener(event, e=>{
  const button=e.target.closest?.('[data-command="action"]');
  if (button && state) highlightTargets(state.acciones.find(a=>a.id===button.dataset.action),state);
});
for (const event of ['pointerout','focusout']) document.addEventListener(event, e=>{
  if (e.target.closest?.('[data-command="action"]') && !document.getElementById('modal').open) clearTargets();
});
document.getElementById('modal').addEventListener('close',clearTargets);

document.addEventListener('submit', e => {
  if (!['create-room','join-room'].includes(e.target.id)) return;
  e.preventDefault();
  const fields=new FormData(e.target); const name=String(fields.get('nombre')).trim();
  run(() => e.target.id==='create-room' ? api.create(name) : api.join(String(fields.get('codigo')),name));
});
document.addEventListener('click', async e => {
  const button = e.target.closest('[data-command]'); if (!button || button.disabled || busy || visualBusy) return;
  const index = Number(button.dataset.index);
  switch (button.dataset.command) {
    case 'home': home(); break;
    case 'resume': screen='connecting'; run(() => api.state()); break;
    case 'start-game': run(() => api.start(room.revision)); break;
    case 'help': help(); break;
    case 'close': closeDialog(); clearTargets(); break;
    case 'confirm-end': if (state.acciones.some(a => a.id === 'FIN_TURNO' && a.disponible)) act('FIN_TURNO'); break;
    case 'phase': phaseDialog(state); break;
    case 'action': chooseAction(button.dataset.action); break;
    case 'unavailable-role': {
      const r = state.catalogoSeleccion.find(r => r.orden === Number(button.dataset.order));
      if (!r) break;
      dialog('No disponible', `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div>`);
      break;
    }
    case 'role': {
      const choosingState=state;
      stopPolling();
      visualBusy=true;
      try { await chooseRole(button); } finally { visualBusy=false; schedulePoll(); }
      if(state!==choosingState) break;
      selectedRole = state.seleccion.find(r => r.indice === index);
      dialog('Representa a tu academia', `<div class="role-confirm">${roleCard(selectedRole,{command:'noop',selected:true})}<div><span class="eyebrow">ORDEN DE TURNO ${selectedRole.orden}</span><h2>${esc(selectedRole.nombre)}</h2><p>${esc(selectedRole.habilidad)}</p><div class="dialog-buttons"><button class="gold-button" data-command="confirm-role">Confirmar elección</button><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div></div>`);
      break;
    }
    case 'back-roles': phaseDialog(state); break;
    case 'confirm-role': if (selectedRole && state.seleccion.some(r => r.indice === selectedRole.indice && r.nombre === selectedRole.nombre)) act('SELECCIONAR',{indice:selectedRole.indice}); break;
    case 'veto-choice': {
      const choosingState=state, option=pendingAction.opciones[index];
      stopPolling(); visualBusy=true;
      const modal=document.getElementById('modal'); modal.dataset.locked='true';
      try { await chooseVeto(button); }
      finally { visualBusy=false; modal.dataset.locked='false'; }
      if (state===choosingState) await act('HABILIDAD',{objetivo:option.objetivo});
      else schedulePoll();
      break;
    }
    case 'target': confirmTarget(index); break;
    case 'back-targets': if (pendingAction) chooseAction(pendingAction.id); break;
    case 'confirm-target': {
      const option = pendingAction?.opciones[selectedTarget];
      if (!option) break;
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
      dialog(`Academia de ${p.nombre}`, `<div class="rival-details"><p>${p.monedas} monedas · ${p.prestigio} prestigio · ${p.cartas} ideas en mano</p>${studies(p,false).replace('Mis estudios','Estudios públicos')}</div>`, {kind:'info',snapshot:true}); break;
    }
    case 'ability-detail': {
      const r = state.jugadores.find(p => p.nombre === state.yo).rol;
      dialog(r.nombre, `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p></div></div>`, {kind:'info',snapshot:true}); break;
    }
    case 'history': dialog('Crónica de la mesa', `<ol class="chronicle">${state.eventos.map(event => `<li class="${event.publicacion ? 'publication' : ''}">${esc(event.texto)}</li>`).join('') || '<li>La academia acaba de abrir sus puertas.</li>'}</ol>`, {kind:'info',snapshot:true}); break;
  }
});

async function boot() {
  if (!api.identity()) { home(); return; }
  screen='connecting';
  try {
    const next=await api.state();
    connectionStatus();
    await renderRoom(next,true);
  }
  catch (error) {
    handleError(error);
    if (screen!=='home') app.innerHTML='<div class="connection-error"><h1>Recuperando tu academia</h1><p>Volveremos a conectar automáticamente.</p><button class="text-button" data-command="home">Volver al inicio</button></div>';
  } finally { schedulePoll(); }
}
document.addEventListener('tesis:account-return',()=>{
  if(state && !document.getElementById('modal').open && ['SELECCION_ROLES','FIN_RONDA','FIN_PARTIDA'].includes(state.fase))phaseDialog(state);
});
initAccountPanel();
boot();
