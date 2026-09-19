import {img, esc, resource} from './dom.js';

export function rival(p) {
  return `<button class="rival ${p.activo ? 'active' : ''}" data-command="rival" data-player="${esc(p.nombre)}" aria-label="Ver estudios de ${esc(p.nombre)}">
    <span class="rival-portrait">${img(p.rol?.arte || 'cartas/reverso_personaje.png')}</span>
    <span class="rival-body"><strong>${esc(p.nombre)}</strong><span class="rival-role">${p.rol ? esc(p.rol.nombre) : 'Personaje reservado'}</span>
    <span class="resources">${resource('moneda', p.monedas, 'Monedas')}${resource('prestigio', p.prestigio, 'Prestigio')}<span class="hand-count">${img('cartas/reverso_idea.png')} ${p.cartas}</span></span></span>
    <span class="published-count">${p.publicados} publicados</span>
  </button>`;
}
export function localPlayer(p, state) {
  return `<div class="local-identity">${img(p.rol?.arte || 'cartas/reverso_personaje.png', 'local-portrait')}
    <div><span class="eyebrow">TU ACADEMIA</span><h2>${esc(p.nombre)}</h2><p>${p.rol ? esc(p.rol.nombre) : 'Selección de personaje'}</p>
    <div class="resources">${resource('moneda', p.monedas, 'Monedas disponibles')}${resource('prestigio', p.prestigio, 'Prestigio total')}${resource('trabajo', p.publicados, 'Artículos publicados')}</div></div></div>
    <p class="ability-copy">${p.rol ? esc(p.rol.habilidad) : 'Elige quién representará a tu academia esta ronda.'}</p>
    <div class="local-footer">${p.rol ? `<button class="text-button" data-command="ability-detail">Ver personaje</button>` : ''}
    <span class="turn-pips" aria-label="${state.accionesRestantes} acciones restantes">${[0,1].map(i => `<i class="${i < state.accionesRestantes ? 'available' : ''}"></i>`).join('')} <span>${state.accionesRestantes} acciones</span></span></div>`;
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
