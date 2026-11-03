// El servidor fija el límite de cada turno; aquí solo se representa la cuenta atrás.
export const TURN_URGENT_SECONDS = 10;
// Igual que SalaJuego.LIMITE_TURNO_MS. La hora del servidor se estima con precisión de segundos,
// así que la cifra mostrada nunca supera el límite real.
export const TURN_LIMIT_SECONDS = 60;

export function turnSecondsLeft(end, now = Date.now()) {
  const fin = Number(end);
  if (!end || !Number.isFinite(fin)) return null;
  return Math.min(TURN_LIMIT_SECONDS, Math.max(0, Math.ceil((fin - now) / 1000)));
}

export function turnTimerText(seconds) {
  if (seconds === null) return '';
  return seconds ? `⏳ ${seconds} s` : '⏳ Pasando turno…';
}

/** Marca de la cuenta atrás; el texto lo rellena el intervalo para no reescribir el panel cada segundo. */
export function turnTimerMarkup(end, now = Date.now()) {
  const seconds = turnSecondsLeft(end, now);
  if (seconds === null) return '';
  return `<b class="turn-timer${seconds <= TURN_URGENT_SECONDS ? ' urgent' : ''}" data-turn-end="${Number(end)}" aria-hidden="true">${turnTimerText(seconds)}</b>`;
}

export function updateTurnTimers(root, now = Date.now()) {
  for (const node of root?.querySelectorAll?.('[data-turn-end]') || []) {
    const seconds = turnSecondsLeft(node.getAttribute('data-turn-end'), now);
    const text = turnTimerText(seconds);
    if (node.textContent !== text) node.textContent = text;
    node.classList?.toggle('urgent', seconds !== null && seconds <= TURN_URGENT_SECONDS);
  }
}

/** Un único intervalo para toda la página; {@code clock} devuelve la hora estimada del servidor. */
export function mountTurnTimers(root, clock = () => Date.now()) {
  const tick = () => updateTurnTimers(root, clock());
  tick();
  const timer = globalThis.setInterval?.(tick, 250);
  return {tick, destroy() { globalThis.clearInterval?.(timer); }};
}
