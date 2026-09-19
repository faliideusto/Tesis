import {img, esc, update} from './dom.js';
import {ideaCard} from './cards.js';
import {rival, localPlayer, studies} from './players.js';

const icons = {COBRAR:'cobrar', PENSAR:'pensar', INICIAR:'iniciar_estudio', TRABAJAR:'trabajar', FIN_TURNO:'finalizar_turno'};
export function board(state) {
  if (!document.getElementById('board')) document.getElementById('app').innerHTML = `
    <section id="board" class="board" aria-label="Mesa de Tesis">
      <header class="board-header"><button class="brand" data-command="home" aria-label="Menú principal">${img('Logo/logo_tesis.png')}</button>
      <div id="turn-panel" class="turn-panel" aria-live="polite"></div><nav class="utility"><button data-command="history">Crónica</button><button data-command="help">Reglas</button></nav></header>
      <div id="rivals" class="rivals"></div><section id="decks" class="decks" aria-label="Mazos de la mesa"></section>
      <div id="phase-message" class="phase-message"></div>
      <section class="player-zone"><aside id="local" class="local-panel"></aside><section class="hand-zone" aria-label="Tu mano"><div class="zone-heading"><span>TUS IDEAS</span><span id="hand-count"></span></div><div id="hand" class="hand"></div></section><aside id="studies" class="studies-panel"></aside></section>
      <footer><p id="action-hint" class="action-hint"></p><div id="actions" class="actions"></div></footer>
    </section>`;
  const me = state.jugadores.find(p => p.nombre === state.yo);
  const others = state.jugadores.filter(p => p !== me);
  document.getElementById('board').dataset.players = state.jugadores.length;
  document.getElementById('board').classList.toggle('privacy', state.bloqueada);
  update('turn-panel', `<span>RONDA ${state.ronda}${state.ultimaRonda ? ' · ÚLTIMA' : ''}</span><strong>${state.fase === 'SELECCION_ROLES' ? 'ELIGE ' : state.fase === 'FIN_PARTIDA' ? 'PARTIDA FINALIZADA' : state.fase === 'FIN_RONDA' ? 'CIERRE DE RONDA' : 'TURNO DE '}${['SELECCION_ROLES','TURNO_JUGADOR'].includes(state.fase) ? esc(state.actual) : ''}</strong>`);
  document.getElementById('rivals').dataset.count = others.length;
  update('rivals', others.map(rival).join(''));
  if (!document.getElementById('activity-current')) update('decks', `<div class="deck character-deck">${img('ui/marco_mazo.png','deck-base')}${img('cartas/reverso_personaje.png','deck-back')}<b class="deck-count">${state.roles}</b><span>PERSONAJES</span></div>
    <section class="table-activity" aria-label="Actividad de la mesa"><span class="eyebrow">ÚLTIMOS MOVIMIENTOS</span><div id="activity-current" role="status" aria-live="polite"><p class="activity-idle">Cada idea deja huella.</p></div><button class="text-button" data-command="history">Ver crónica</button></section>
    <div class="deck idea-deck ${state.ideas === 0 ? 'exhausted' : ''}">${img('ui/marco_mazo.png','deck-base')}${img('cartas/reverso_idea.png','deck-back')}<b class="deck-count">${state.ideas}</b><span>IDEAS${state.ideas === 0 ? ' · AGOTADO' : ''}</span></div>`);
  document.querySelector('.character-deck .deck-count').textContent = state.roles;
  document.querySelector('.idea-deck .deck-count').textContent = state.ideas;
  update('local', localPlayer(me, state)); update('studies', studies(me));
  document.getElementById('studies').classList.toggle('no-studies', !me.estudios.length);
  document.getElementById('hand').style.setProperty('--hand-count', Math.max(1,state.mano.length));
  update('hand-count', `${state.mano.length} cartas`);
  update('hand', state.mano.map(c => ideaCard(c)).join('') || '<p class="empty-hand">Sin ideas en la mano<br><small>Consulta las acciones disponibles.</small></p>');
  let invitation = '';
  if (state.fase === 'SELECCION_ROLES') invitation = state.seleccion.length
    ? '<span>Tu academia elige personaje.</span><button class="gold-button" data-command="phase">Elegir personaje</button>'
    : `<span>${esc(state.actual)} está eligiendo personaje.</span>`;
  else if (state.fase === 'FIN_RONDA') invitation = `<span>Ronda ${state.ronda} terminada${state.ultimaRonda ? ' · última ronda' : ''}.</span>${state.acciones.some(a => a.id === 'SIGUIENTE_RONDA') ? `<button class="gold-button" data-command="next-round">${state.ultimaRonda ? 'Ver resultados' : 'Comenzar siguiente ronda'}</button>` : `<span>Esperando a ${esc(state.actual)}.</span>`}`;
  else if (state.fase === 'FIN_PARTIDA') invitation = '<span>La partida ha terminado.</span><button class="gold-button" data-command="phase">Ver resultados</button>';
  update('phase-message', `<div class="phase-invitation">${invitation}</div>${state.aviso ? `<div class="table-notice">${esc(state.aviso)}</div>` : state.habilidadPendiente ? '<div class="table-notice">Comité de Ética: debes nombrar un rol antes de actuar.</div>' : ''}<p class="table-recap">${esc(state.eventos.at(-1)?.texto || '')}</p>`);
  update('action-hint', state.actual !== state.yo && state.fase !== 'FIN_PARTIDA' ? `ESPERANDO A ${esc(state.actual)}` : state.fase === 'TURNO_JUGADOR' ? state.habilidadPendiente ? 'RESUELVE TU HABILIDAD INICIAL' : state.accionesRestantes ? 'ELIGE TU PRÓXIMO PASO' : 'ACCIONES AGOTADAS · PUEDES USAR TU HABILIDAD O TERMINAR' : 'INVESTIGA · PUBLICA · TRASCIENDE');
  update('actions', state.acciones.map(a => `<button class="action-button ${a.id === 'FIN_TURNO' ? 'end-turn' : ''} ${a.id === 'HABILIDAD' ? 'ability-action' : ''}" data-command="action" data-action="${a.id}" ${!a.disponible ? 'disabled' : ''} data-tip="${esc(a.disponible ? a.descripcion : a.motivo)}">
    <span class="action-content">${img(icons[a.id] ? `acciones/${icons[a.id]}.png` : a.id === 'HABILIDAD' ? 'recursos/prestigio.png' : 'acciones/finalizar_turno.png')}<span class="action-label">${esc(a.nombre)}</span></span></button>`).join(''));
}
