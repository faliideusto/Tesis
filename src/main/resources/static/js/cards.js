import {img, esc} from './dom.js';

export function ideaCard(c, {command = 'inspect', disabled = false, selected = false} = {}) {
  return `<button class="game-card idea-card ${selected ? 'selected' : ''}" data-command="${command}" data-index="${c.indice}" ${disabled ? 'disabled' : ''}
    aria-label="${esc(c.nombre)}. Coste ${c.coste}, trabajo ${c.trabajo}, prestigio ${c.prestigio}" data-tip="${esc(c.nombre)} · ${c.coste} monedas · ${c.trabajo} trabajo · ${c.prestigio} prestigio">
    ${img(c.marco, 'card-frame')}${img(c.arte, 'card-art')}
    <span class="card-name">${esc(c.nombre)}</span>
    <span class="card-numbers"><b>${c.coste}</b><b>${c.trabajo}</b><b>${c.prestigio}</b></span>
  </button>`;
}
export function roleCard(r, {command = 'role', selected = false} = {}) {
  return `<button class="game-card role-card ${selected ? 'selected' : ''}" data-command="${command}" data-index="${r.indice}" aria-label="${esc(r.nombre)}, orden ${r.orden}. ${esc(r.habilidad)}">
    ${img(r.arte, 'role-art')}${img('cartas/marco_personaje.png', 'card-frame')}
    <span class="role-order">${r.orden}</span><span class="card-name">${esc(r.nombre)}</span>
    <span class="role-ability">${esc(r.habilidad)}</span>
  </button>`;
}
