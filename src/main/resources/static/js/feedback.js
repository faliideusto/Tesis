export function notify(message, kind = '') {
  const item = document.createElement('div'); item.className = `toast ${kind}`; item.textContent = message;
  document.getElementById('notifications').append(item);
  setTimeout(() => item.remove(), 5500);
}
export function feedback(before, after) {
  if (!before) return;
  const last = before.eventos.at(-1)?.numero || 0;
  after.eventos.filter(e => e.numero > last).slice(-3).forEach(e => notify(e.texto, e.publicacion ? 'publication' : ''));
  const old = before.jugadores.find(p => p.nombre === after.actual), current = after.jugadores.find(p => p.nombre === after.actual);
  if (old && current && !matchMedia('(prefers-reduced-motion: reduce)').matches && (old.monedas !== current.monedas || old.prestigio !== current.prestigio)) {
    document.getElementById('local')?.animate([{filter:'brightness(1.8)'},{filter:'brightness(1)'}], {duration:500});
  }
  if (after.ideas < before.ideas && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelector('.idea-deck')?.animate([{transform:'translateY(0)'},{transform:'translateY(-14px) rotate(3deg)'},{transform:'translateY(0)'}], {duration:400});
  }
}
const tooltip = document.getElementById('tooltip');
function show(target) {
  const item = target.closest?.('[data-tip]');
  if (!item || document.getElementById('modal').open) { tooltip.hidden = true; return; }
  tooltip.textContent = item.dataset.tip; tooltip.hidden = false;
  const rect = item.getBoundingClientRect();
  const {width, height} = tooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
  const above = rect.top - height - 10;
  const top = above >= 8 ? above : Math.max(8, Math.min(rect.bottom + 10, innerHeight - height - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
document.addEventListener('pointerover', e => show(e.target));
document.addEventListener('focusin', e => show(e.target));
document.addEventListener('pointerout', () => tooltip.hidden = true);
document.addEventListener('focusout', () => tooltip.hidden = true);
document.addEventListener('click', () => tooltip.hidden = true);
document.addEventListener('scroll', () => tooltip.hidden = true, true);
window.addEventListener('resize', () => tooltip.hidden = true);
