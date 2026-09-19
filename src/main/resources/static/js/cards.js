import {img, esc} from './dom.js';

export function ideaCard(c, {command = 'inspect', disabled = false, selected = false} = {}) {
  return `<button class="game-card idea-card ${selected ? 'selected' : ''}" data-command="${command}" data-index="${c.indice}" ${disabled ? 'disabled' : ''}
    aria-label="${esc(c.nombre)}. Coste ${c.coste}, trabajo ${c.trabajo}, prestigio ${c.prestigio}" data-tip="${esc(c.nombre)} · ${c.coste} monedas · ${c.trabajo} trabajo · ${c.prestigio} prestigio">
    ${ideaCardContents(c)}
  </button>`;
}
export function ideaCardContents(c) {
  return `${img(c.marco, 'card-frame')}${c.legendaria ? '' : img(c.arte, 'card-art')}
    <span class="card-name">${esc(c.nombre)}</span>
    <span class="card-stats" aria-hidden="true">${[c.coste,c.trabajo,c.prestigio].map(value => `<span class="card-stat"><b>${value}</b></span>`).join('')}</span>
    ${c.ingresoPorTurno ? `<span class="card-income">+${c.ingresoPorTurno} monedas / turno</span>` : ''}`;
}
export function roleCard(r, {command = 'role', selected = false} = {}) {
  const cadence = r.habilidad.match(/(?:Una vez por turno\.|Automática\.|sin límite de usos\.)$/i)?.[0] || '';
  const ability = r.habilidad.replace(/\s*(Una vez por turno\.|Automática\.)$/i, '').replace(/, sin límite de usos\.$/i, '.');
  return `<button class="game-card role-card ${selected ? 'selected' : ''}" data-command="${command}" data-index="${r.indice}" aria-label="${esc(r.nombre)}, orden ${r.orden}. ${esc(r.habilidad)}">
    ${img(r.arte, 'role-art')}${img('cartas/marco_personaje.png', 'card-frame')}
    <span class="role-order"><b>${r.orden}</b></span><span class="card-name">${esc(r.nombre)}</span>
    <span class="role-ability">${esc(ability)}</span><span class="role-cadence">${esc(cadence)}</span>
  </button>`;
}
