import {api} from './api.js';
import {img, esc} from './dom.js';
import {board} from './board.js';
import {ideaCard, roleCard} from './cards.js';
import {studies, studyRow} from './players.js';
import {dialog, closeDialog, phaseDialog} from './dialogs.js';
import {notify, feedback} from './feedback.js';

let state = null, config, busy = false, selectedRole = null, pendingAction = null;
const app = document.getElementById('app');

function home() {
  closeDialog();
  app.innerHTML = `<section class="home-screen"><nav class="home-nav"><span>UNA MESA. MUCHAS IDEAS.</span><button class="text-button" data-command="help">Cómo jugar</button></nav>
    <div class="home-copy">${img('Logo/logo_ciudadela_academica.png','home-logo','Ciudadela Académica')}<span class="eyebrow">EL CONOCIMIENTO DEJA HUELLA</span>
    <h1>Construye tu<br><em>legado académico.</em></h1><p>Reúne ideas, asume un personaje y convierte tus estudios en publicaciones. La academia recordará a quien alcance el mayor prestigio.</p>
    <div class="home-features"><span>8 personajes</span><span>10 ideas</span><span>Una mesa compartida</span></div></div>
    <section class="setup-panel"><span class="eyebrow">LAS PUERTAS ESTÁN ABIERTAS</span><h2>Reúne a tu academia</h2><p>Partida local · pasa el control en cada turno</p>
      <form id="setup"><label for="player-count">Personas en la mesa</label><select id="player-count" name="count">${Array.from({length:config.capacidadTablero},(_,i) => `<option value="${i+1}" ${i+1 === 2 ? 'selected' : ''} ${i+1 > config.maximo ? 'disabled' : ''}>${i+1 === 1 ? '1 · práctica individual' : `${i+1} jugadores`}${i+1 > config.maximo ? ' · mazo insuficiente' : ''}</option>`).join('')}</select>
      <div id="player-names"></div><p class="setup-note">${esc(config.limitacion)}</p><button type="submit" class="gold-button">Abrir la mesa</button></form>
      ${state ? '<button class="text-button resume" data-command="resume">Volver a la partida en curso</button>' : ''}
    </section><div class="home-footer">INVESTIGAR <span>·</span> TRANSFORMAR <span>·</span> MEJORAR</div></section>`;
  names(2);
}
function names(count) {
  const old = [...document.querySelectorAll('[name="player"]')].map(input => input.value);
  document.getElementById('player-names').innerHTML = Array.from({length:count},(_,i) => `<label class="name-field"><span>${String(i+1).padStart(2,'0')}</span><input name="player" aria-label="Nombre del jugador ${i+1}" value="${esc(old[i] || `Jugador ${i+1}`)}" maxlength="24" required autocomplete="off"></label>`).join('');
}
async function run(task, {transition = true} = {}) {
  if (busy) return;
  busy = true; document.body.classList.add('busy');
  try {
    const before = state; const next = await task();
    if (next) { state = next; board(state); feedback(before, state); if (transition) phaseDialog(state); }
  } catch (error) {
    notify(error instanceof TypeError ? 'No hay conexión con la mesa. Comprueba que el servidor siga abierto y vuelve a intentarlo.' : error.message, 'error');
    if (error.status === 409) {
      try { state = await api.state(); if (state) { board(state); phaseDialog(state); } }
      catch { notify('No se ha podido actualizar la mesa. Recarga cuando vuelva la conexión.', 'error'); }
    }
  } finally { busy = false; document.body.classList.remove('busy'); }
}
const act = (type, option = {}) => run(() => api.action(state.revision, type, option));

function help() {
  dialog('El conocimiento se convierte en prestigio', `<div class="rules-copy"><p><strong>1. Elige un personaje.</strong> Se descarta un rol al azar. Cada persona elige entre los restantes. Se juega en orden de personaje, de menor a mayor.</p>
    <p><strong>2. Decide cómo avanzar.</strong> En tu turno puedes realizar hasta dos acciones: cobrar 2 monedas, pensar para robar una idea, pagar una idea para iniciar un estudio o trabajar en un estudio propio.</p>
    <p><strong>3. Aprovecha tu habilidad.</strong> No consume acciones base. Las habilidades activas se usan una vez por turno, salvo Editorial, que puede comprar trabajo varias veces. El Comité debe nombrar un rol antes de actuar.</p>
    <p><strong>4. Publica y deja tu huella.</strong> Al completar el trabajo, publicas automáticamente y ganas el prestigio de la carta. Cuando alguien publica su tercer artículo, se termina la ronda. Gana quien tenga más prestigio; los empates comparten victoria.</p>
    <p><strong>Mesa compartida.</strong> Al cambiar de jugador, entrega el control antes de mostrar su mano. Las partidas se conservan al recargar en este navegador mientras el servidor siga abierto, hasta 24 horas sin actividad.</p>
    <p><strong>Mazo finito.</strong> Las diez ideas no se reciclan. Especialmente con cinco personas, puede agotarse sin que nadie alcance tres publicaciones. No existe una regla de desempate o cierre para ese bloqueo.</p></div>`, {wide:false});
}
function chooseAction(id) {
  const action = state.acciones.find(a => a.id === id);
  if (!action?.disponible) return;
  if (!action.opciones.length) { act(id); return; }
  pendingAction = action;
  let content;
  if (id === 'INICIAR') content = `<div class="idea-selection">${state.mano.map(c => ideaCard(c,{command:'start-choice',disabled:!action.opciones.some(o => o.indice === c.indice)})).join('')}</div>`;
  else if (id === 'TRABAJAR') {
    const player = state.jugadores.find(p => p.nombre === state.actual);
    const allowed = new Set(action.opciones.map(o => o.indice));
    content = `<div class="study-selector">${player.estudios.filter(e => allowed.has(e.indice)).map(e => studyRow(e, player.nombre, {selection:true})).join('')}</div>`;
  } else content = `<div class="target-list">${action.opciones.map((o,i) => `<button class="target-button" data-command="target" data-index="${i}">${esc(o.etiqueta)}<span>Seleccionar</span></button>`).join('')}</div>`;
  dialog(action.nombre, `<p class="decision-copy">${esc(action.descripcion)}</p>${content}`, {wide:id === 'INICIAR'});
}
function inspect(c, study = null, player = null) {
  const canStart = !study && state.acciones.find(a => a.id === 'INICIAR')?.opciones.some(o => o.indice === c.indice)
    && state.acciones.find(a => a.id === 'INICIAR')?.disponible;
  const canWork = study && player === state.actual && state.acciones.find(a => a.id === 'TRABAJAR')?.disponible
    && state.acciones.find(a => a.id === 'TRABAJAR')?.opciones.some(o => o.indice === study.indice);
  dialog(c.nombre, `<div class="card-detail">${ideaCard(c,{command:'noop'})}<div><span class="eyebrow">${study ? study.publicado ? 'ARTÍCULO PUBLICADO' : 'ESTUDIO EN DESARROLLO' : 'CARTA DE IDEA'}</span><h2>${esc(c.nombre)}</h2>
    <dl><div><dt>Coste de inicio</dt><dd>${c.coste} monedas</dd></div><div><dt>Trabajo requerido</dt><dd>${c.trabajo} puntos</dd></div><div><dt>Prestigio</dt><dd>${c.prestigio}${study?.prestigioExtra ? ` + ${study.prestigioExtra}` : ''}</dd></div></dl>
    ${study ? `<p>Progreso: ${study.trabajo} / ${c.trabajo}</p>` : ''}
    ${canStart ? `<button class="gold-button" data-command="start" data-index="${c.indice}">Iniciar estudio · ${c.coste} monedas</button>` : ''}
    ${canWork ? `<button class="gold-button" data-command="work" data-index="${study.indice}">Trabajar en este estudio</button>` : ''}
    ${!study && !canStart ? '<p class="muted">No puedes iniciar esta idea ahora. Consulta tus monedas y acciones disponibles.</p>' : ''}</div></div>`);
}

document.addEventListener('change', e => { if (e.target.id === 'player-count') names(Number(e.target.value)); });
document.addEventListener('submit', e => {
  if (e.target.id !== 'setup') return; e.preventDefault();
  const jugadores = [...e.target.querySelectorAll('[name="player"]')].map(input => input.value.trim());
  if (state && state.fase !== 'FIN_PARTIDA') {
    dialog('Abrir una nueva mesa', '<p>La partida en curso se sustituirá. Los nombres elegidos están preparados.</p><button class="gold-button" data-command="confirm-new">Empezar nueva partida</button>');
    pendingAction = {nombres:jugadores};
  } else run(() => api.create(jugadores));
});
document.addEventListener('click', e => {
  const button = e.target.closest('[data-command]'); if (!button || button.disabled || busy) return;
  const index = Number(button.dataset.index);
  switch (button.dataset.command) {
    case 'home': home(); break;
    case 'resume': run(() => api.lock(state.revision)); break;
    case 'confirm-new': run(() => api.create(pendingAction.nombres)); break;
    case 'help': help(); break;
    case 'close': closeDialog(); break;
    case 'reveal': run(() => api.reveal(state.revision)); break;
    case 'lock': run(() => api.lock(state.revision)); break;
    case 'next-round': act('SIGUIENTE_RONDA'); break;
    case 'action': chooseAction(button.dataset.action); break;
    case 'role': {
      selectedRole = state.seleccion.find(r => r.indice === index);
      dialog('Representa a tu academia', `<div class="role-confirm">${roleCard(selectedRole,{command:'noop',selected:true})}<div><span class="eyebrow">ORDEN DE TURNO ${selectedRole.orden}</span><h2>${esc(selectedRole.nombre)}</h2><p>${esc(selectedRole.habilidad)}</p><div class="dialog-buttons"><button class="gold-button" data-command="confirm-role">Elegir personaje</button><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div></div>`, {locked:true});
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
      const r = state.jugadores.find(p => p.nombre === state.actual).rol;
      dialog(r.nombre, `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p></div></div>`); break;
    }
    case 'history': dialog('Crónica de la mesa', `<ol class="chronicle">${state.eventos.map(event => `<li class="${event.publicacion ? 'publication' : ''}">${esc(event.texto)}</li>`).join('') || '<li>La academia acaba de abrir sus puertas.</li>'}</ol>`); break;
  }
});

async function boot() {
  try {
    [config,state] = await Promise.all([api.config(), api.state()]);
    if (state) { state = await api.lock(state.revision); board(state); phaseDialog(state); } else home();
  } catch {
    app.innerHTML = '<div class="connection-error"><h1>No podemos abrir la academia</h1><p>Comprueba que el servidor esté iniciado y recarga esta página.</p><button class="gold-button" id="retry">Volver a intentar</button></div>';
    document.getElementById('retry').addEventListener('click', boot);
  }
}
boot();
