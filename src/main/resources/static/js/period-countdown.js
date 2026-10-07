// Dates come from the server; this formatter never chooses calendar boundaries.
export function remainingCountdown(fin,now=Date.now(),endedLabel='Periodo finalizado') {
  const end=fin?new Date(fin).getTime():NaN;
  if(!Number.isFinite(end))return 'Tiempo restante pendiente de confirmar';
  const remaining=Math.max(0,Math.ceil((end-now)/1000));
  if(!remaining)return endedLabel;
  const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
  return `${days?`${days} ${days===1?'día':'días'} · `:''}${hours} h · ${minutes} min · ${seconds} s restantes`;
}

export function updatePeriodCountdowns(root,now=Date.now()) {
  for(const node of root.querySelectorAll?.('[data-countdown-end]')||[]) {
    const text=remainingCountdown(node.getAttribute('data-countdown-end'),now,node.getAttribute('data-countdown-ended')||'Periodo finalizado');
    const label=node.getAttribute('data-countdown-label');
    node.textContent=label?`${label}: ${text}`:text;
  }
}

export function mountPeriodCountdown(root) {
  let alive=true;
  const tick=()=>{if(alive)updatePeriodCountdowns(root);};
  tick();const timer=globalThis.setInterval?.(tick,1000);
  const visibility=()=>{if(root.ownerDocument?.visibilityState!=='hidden')tick();};
  root.ownerDocument?.addEventListener?.('visibilitychange',visibility);
  return {destroy(){alive=false;globalThis.clearInterval?.(timer);root.ownerDocument?.removeEventListener?.('visibilitychange',visibility);}};
}
