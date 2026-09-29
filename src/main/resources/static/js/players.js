import {img, esc, resource} from './dom.js';
import {ideaCardContents, roleCard} from './cards.js';
import {preview} from './decisions.js';

function playerBadge(p, local = false) {
  const name = local ? `<h2>${esc(p.nombre)}</h2>` : `<strong>${esc(p.nombre)}</strong>`;
  return `<span class="rival-portrait">${img(p.rol?.arte || 'cartas/reverso_personaje.webp')}</span>
    <span class="rival-body">${name}<span class="rival-role">${p.rol ? esc(p.rol.nombre) : 'Personaje reservado'}</span>
    <span class="resources">${resource('moneda', p.monedas, 'Monedas')}${resource('prestigio', p.prestigio, 'Prestigio')}<span class="hand-count" aria-label="${p.cartas} ideas en mano">${img('cartas/reverso_idea.webp')} ${p.cartas}</span></span></span>`;
}
export function rival(p, state = {}) {
  return `<section class="rival-seat" aria-label="Academia de ${esc(p.nombre)}"><button class="rival ${p.activo ? 'active' : ''}" data-command="rival" data-player="${esc(p.nombre)}" aria-label="Ver estudios de ${esc(p.nombre)}">${playerBadge(p)}${actionBolts(p,state)}</button>${rolePreview(p)}${tableStudies(p)}</section>`;
}
// Shared tabletop presentation; modal lists retain their existing renderer below.
export function tableStudies(p, own = false) {
  const group = (published, label) => {
    const entries = p.estudios.filter(e => e.publicado === published);
    const emptySlots = Array.from({length:Math.max(0,3-entries.length)}, () =>
      '<div class="article-placeholder" aria-hidden="true"><span>+</span></div>').join('');
    return `<section class="article-group ${published ? 'publications' : 'development'}" aria-label="${label} de ${esc(p.nombre)}: ${entries.length}"><div class="article-support"><div class="article-heading"><h3>${label}<span class="sr-only">: ${entries.length}</span></h3></div><div class="article-scroll" tabindex="0" aria-label="${label}: ${entries.length} artículos${entries.length > 3 ? ', desplaza para ver todos' : ''}"><div class="article-track">${entries.map(e => `<div class="table-study-slot"><button class="game-card idea-card table-study ${published ? 'published' : ''}" data-command="${own ? 'study' : 'public-study'}" data-player="${esc(p.nombre)}" data-index="${e.indice}" aria-label="${esc(e.carta.nombre)}, ${published ? 'publicado' : `${e.trabajo} de ${e.carta.trabajo} trabajo`}">${ideaCardContents(e.carta)}</button><span class="table-study-status">${published ? `${e.carta.prestigio + (e.prestigioExtra || 0)} prestigio` : `${e.trabajo} / ${e.carta.trabajo}`}</span>${published ? '' : `<progress value="${e.trabajo}" max="${e.carta.trabajo}" aria-label="Trabajo de ${esc(e.carta.nombre)}"></progress>`}</div>`).join('')}${emptySlots}</div></div></div></section>`;
  };
  return `<div class="rival-studies academy-tray">${group(false, 'En desarrollo')}${group(true, 'Publicados')}</div>`;
}
export function rolePreview(p) {
  return p.rol ? `<div class="player-role-preview" aria-label="Personaje de ${esc(p.nombre)}">${roleCard(p.rol,{command:'noop'})}<p>${esc(p.rol.habilidad)}</p></div>` : '';
}
export function positionRolePreview(anchor) {
  const parent = anchor.parentElement;
  const preview = parent.querySelector('.player-role-preview');
  if (!preview) return;
  const frame = (anchor.matches('.local-role-button') ? parent : anchor).getBoundingClientRect(), bounds = parent.getBoundingClientRect();
  const width = preview.offsetWidth, height = preview.offsetHeight, gap = 8;
  if (!height) return;
  let x = frame.left + (frame.width - width) / 2, y = frame.bottom + gap;
  if (y + height > innerHeight - gap) {
    y = frame.top - height - gap;
    if (y < gap) {
      x = frame.right + gap + width <= innerWidth ? frame.right + gap : frame.left - width - gap;
      y = frame.top;
    }
  }
  x = Math.max(gap, Math.min(x, innerWidth - width - gap));
  y = Math.max(gap, Math.min(y, innerHeight - height - gap));
  // Position relative to the plaque's parent, never to the height of its article tray.
  preview.style.left = `${x - bounds.left}px`;
  preview.style.top = `${y - bounds.top}px`;
}
export function actionBolts(p, state) {
  const active = state.fase === 'TURNO_JUGADOR' && p.activo;
  const remaining = active ? state.accionesRestantes : 0;
  return `<span class="action-bolts" role="img" aria-label="${active ? `${remaining} acciones restantes` : 'Fuera de turno'}">${[1,2].map(n => `<svg class="action-bolt ${n <= remaining ? 'available' : 'spent'}" viewBox="0 0 20 28" aria-hidden="true"><path d="M11 2 3 15h6l-1 11 9-15h-6z"/></svg>`).join('')}</span>`;
}
export function localPlayer(p, state) {
  return `${playerBadge(p, true)}${actionBolts(p,state)}${rolePreview(p)}<span class="sr-only">Tu academia.</span>
    ${p.rol ? `<button class="local-role-button" data-command="ability-detail" aria-label="Ver personaje de ${esc(p.nombre)}: ${esc(p.rol.nombre)}"></button>` : ''}`;
}

// Public study data plus the option index preserve ownership even for duplicate cards.
export function studyChoice(e, owner, optionIndex, option) {
  return `<div class="article-choice eligible-option"><strong class="article-owner">${esc(owner)}</strong><button class="game-card idea-card" data-command="target" data-index="${optionIndex}" aria-label="Objetivo válido: ${esc(e.carta.nombre)} de ${esc(owner)}, ${e.trabajo} de ${e.carta.trabajo} trabajo">${ideaCardContents(e.carta)}</button><strong>${esc(e.carta.nombre)}</strong><span>${e.trabajo} / ${e.carta.trabajo} trabajo · ${e.carta.prestigio + (e.prestigioExtra || 0)} prestigio</span><progress value="${e.trabajo}" max="${e.carta.trabajo}" aria-label="Progreso de ${esc(e.carta.nombre)} de ${esc(owner)}"></progress><small>Objetivo válido · ${e.publicado ? 'Publicado' : 'En desarrollo'}</small>${preview(option)}</div>`;
}
export function articleChoices(action, state) {
  return `<div class="article-selector">${action.opciones.map((o,i) => {
    const owner = state.jugadores.find(p => p.nombre === (o.objetivo || state.yo));
    const study = owner?.estudios.find(e => e.indice === o.indice);
    return study ? studyChoice(study,owner.nombre,i,o) : '';
  }).join('')}</div>`;
}
export function studies(p, interactive = true) {
  const development = p.estudios.filter(e => !e.publicado), published = p.estudios.filter(e => e.publicado);
  const row = e => studyRow(e,p.nombre,{command:interactive ? 'study' : 'public-study'});
  return `<h2>Mis estudios <span>${p.estudios.length}</span></h2><div class="study-scroll"><h3>En desarrollo · ${development.length}</h3>
    ${development.map(row).join('') || '<p class="empty-copy">Toda publicación empieza con una idea.</p>'}
    <h3>Publicados · ${published.length}</h3>${published.map(row).join('') || '<p class="empty-copy">Tu legado está por escribir.</p>'}</div>`;
}

export function studyRow(e, player, {command = 'study', selection = false} = {}) {
  return `<button class="study-row ${selection ? 'study-choice' : ''} ${e.publicado ? 'published' : ''}" data-command="${command}" data-index="${e.indice}" data-player="${esc(player)}">
    ${img(e.carta.arte)}<span><strong>${esc(e.carta.nombre)}</strong><span class="study-status">${e.publicado ? `Publicado · ${e.carta.prestigio + e.prestigioExtra} prestigio` : `${e.trabajo} / ${e.carta.trabajo} trabajo`}</span>
    ${!e.publicado ? `<progress value="${e.trabajo}" max="${e.carta.trabajo}"></progress>` : ''}</span>
    ${e.publicado ? img('recursos/prestigio.webp', 'study-medal') : ''}${selection ? '<span class="study-choice-label">Ver estudio →</span>' : ''}</button>`;
}
