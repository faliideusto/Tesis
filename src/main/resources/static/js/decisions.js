import {esc} from './dom.js';

export function endTurnWarning(state) {
  const remaining = state.accionesRestantes;
  const usefulAbility = state.acciones.some(a => a.id === 'HABILIDAD' && a.disponible);
  return [remaining > 0 ? `Te quedan ${remaining} ${remaining === 1 ? 'acción base' : 'acciones base'}.` : '',
    usefulAbility ? 'Todavía puedes usar tu habilidad.' : ''].filter(Boolean).join(' ');
}

export function preview(option) {
  return option?.previsualizacion ? `<p class="action-preview" role="status">${esc(option.previsualizacion)}</p>` : '';
}

export function ideaUnavailableReason(state, card) {
  const action = state.acciones.find(a => a.id === 'INICIAR');
  if (!action) return state.actual !== state.yo ? 'Espera a tu turno para iniciar esta idea.' : 'No puedes iniciar estudios en esta fase.';
  if (!action.disponible) return action.motivo;
  const me = state.jugadores.find(p => p.nombre === state.yo);
  return card.coste > me.monedas ? `Te faltan ${card.coste - me.monedas} monedas para iniciar esta idea.` : '';
}

export function clearTargets() {
  for (const card of document.querySelectorAll('#board .valid-target')) card.classList.remove('valid-target');
}

// Only the actor's server-provided options authorize a highlight. Never infer rival immunity or roles.
export function highlightTargets(action, state) {
  clearTargets();
  if (!action?.disponible) return;
  for (const card of document.querySelectorAll('#board [data-index]')) {
    const hand = !!card.closest('#hand');
    const owner = hand ? state.yo : card.dataset.player;
    const eligible = (action.id === 'INICIAR') === hand && action.opciones.some(o =>
      Number.isInteger(o.indice) && o.indice === Number(card.dataset.index) && (o.objetivo || state.yo) === owner);
    card.classList.toggle('valid-target', eligible);
  }
}
