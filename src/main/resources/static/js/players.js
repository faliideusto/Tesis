import {img, esc, resource} from './dom.js';
import {ideaCardContents} from './cards.js';

function playerBadge(p, local = false) {
  const name = local ? `<h2>${esc(p.nombre)}</h2>` : `<strong>${esc(p.nombre)}</strong>`;
  return `<span class="rival-portrait">${img(p.rol?.arte || 'cartas/reverso_personaje.png')}</span>
    <span class="rival-body">${name}<span class="rival-role">${p.rol ? esc(p.rol.nombre) : 'Personaje reservado'}</span>
    <span class="resources">${resource('moneda', p.monedas, 'Monedas')}${resource('prestigio', p.prestigio, 'Prestigio')}<span class="hand-count" aria-label="${p.cartas} ideas en mano">${img('cartas/reverso_idea.png')} ${p.cartas}</span></span></span>`;
}
export function rival(p) {
  return `<section class="rival-seat" aria-label="Academia de ${esc(p.nombre)}"><button class="rival ${p.activo ? 'active' : ''}" data-command="rival" data-player="${esc(p.nombre)}" aria-label="Ver estudios de ${esc(p.nombre)}">${playerBadge(p)}</button>${tableStudies(p)}</section>`;
}
// Shared tabletop presentation; modal lists retain their existing renderer below.
export function tableStudies(p, own = false) {
  const group = (published, label) => {
    const entries = p.estudios.filter(e => e.publicado === published);
    return `<section class="article-group ${published ? 'publications' : 'development'}" aria-label="${label} de ${esc(p.nombre)}"><h3>${label}<span>${entries.length}</span></h3><div class="article-track" tabindex="0" aria-label="${label}: desplaza para ver todos los artículos">${entries.map(e => `<div class="table-study-slot"><button class="game-card idea-card table-study ${published ? 'published' : ''}" data-command="${own ? 'study' : 'public-study'}" data-player="${esc(p.nombre)}" data-index="${e.indice}" aria-label="${esc(e.carta.nombre)}, ${published ? 'publicado' : `${e.trabajo} de ${e.carta.trabajo} trabajo`}">${ideaCardContents(e.carta)}</button><span class="table-study-status">${published ? `◆ ${e.carta.prestigio + (e.prestigioExtra || 0)}` : `${e.trabajo} / ${e.carta.trabajo}`}</span>${published ? '' : `<progress value="${e.trabajo}" max="${e.carta.trabajo}" aria-label="Trabajo de ${esc(e.carta.nombre)}"></progress>`}</div>`).join('') || `<div class="article-placeholder" aria-label="Sin artículos ${published ? 'publicados' : 'en desarrollo'}"><span aria-hidden="true">${published ? '♧' : '✧'}</span><small>${published ? 'Por publicar' : 'Nueva investigación'}</small></div>`}</div></section>`;
  };
  return `<div class="rival-studies academy-tray">${group(false, 'En desarrollo')}${group(true, 'Publicados')}<div class="academy-hand" aria-label="${p.cartas} ideas en mano">${img('cartas/reverso_mesa.png')}<span>${p.cartas} ${p.cartas === 1 ? 'idea' : 'ideas'}</span></div></div>`;
}
export function localPlayer(p, state) {
  return `${playerBadge(p, true)}<span class="sr-only">Tu academia. ${state.accionesRestantes} acciones restantes.</span>
    ${p.rol ? `<button class="local-role-button" data-command="ability-detail" aria-label="Ver personaje de ${esc(p.nombre)}: ${esc(p.rol.nombre)}"></button>` : ''}`;
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
    ${e.publicado ? img('recursos/prestigio.png', 'study-medal') : ''}${selection ? '<span class="study-choice-label">Ver estudio →</span>' : ''}</button>`;
}
