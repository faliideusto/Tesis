import {esc} from './dom.js';

// Un ciclo propio: nunca mezcla la búsqueda con el polling de una sala anterior.
export function createMatchmaking({api, panel, onRoom, onHome, status}) {
  let active=false, generation=0, timer, busy=false, view=null, signature='';
  const stop=()=>{clearTimeout(timer);generation++;};
  function render() {
    const host=panel();
    if (!host) return;
    const next=view ? `${view.fase}:${view.grupo || ''}:${view.listo}` : 'elegir';
    if (next!==signature) {
      signature=next;
      if (!view) {
        host.innerHTML=`<span class="eyebrow">ENCUENTRA TU ACADEMIA</span><h2 id="match-title" tabindex="-1">Buscar partida</h2><p>Elige cuántas personas jugaréis. Cada tamaño tiene su propia cola.</p>
          <form id="match-search" class="room-form"><label for="match-name">Tu nombre<input id="match-name" name="nombre" maxlength="24" required autocomplete="nickname"></label>
          <fieldset class="match-sizes"><legend>Tamaño de la mesa</legend>${[3,4,5].map(n=>`<label><input type="radio" name="jugadores" value="${n}" ${n===3?'checked':''}><span>${n}<small>personas</small></span></label>`).join('')}</fieldset>
          <button class="gold-button" type="submit">Buscar partida</button></form><button class="text-button match-back" data-match="back">Volver al inicio</button>`;
      } else {
        const confirming=view.fase==='CONFIRMACION';
        host.innerHTML=`<span class="eyebrow">LA ACADEMIA SE REÚNE</span><h2 id="match-title" tabindex="-1">${confirming?'¡Mesa encontrada!':'Buscando partida'}</h2>
          <p>Mesa de ${esc(view.jugadores)} personas</p><p id="match-count" class="match-count" role="status" aria-live="polite"></p>${confirming?'':'<span class="match-searching" aria-hidden="true"><i></i><i></i><i></i></span>'}
          ${confirming?`<p id="match-time"></p><button class="gold-button" data-match="ready" ${view.listo?'disabled':''}>${view.listo?'Listo · esperando al resto':'Estoy listo'}</button>`:`<p>La partida comenzará cuando todos confirméis. Puedes cancelar para cambiar el tamaño.</p>
          <div id="match-bots" class="match-bots" hidden><strong>¿No encuentras a nadie?</strong><span>Completamos tu mesa de ${esc(view.jugadores)} y empiezas ahora mismo. Es una partida de práctica: no suma experiencia.</span><button class="match-bots-button" data-match="bots">Jugar ahora</button></div>`}
          <p id="match-error" role="status" aria-live="polite"></p><button class="text-button match-back" data-match="cancel">Cancelar búsqueda</button>`;
      }
      host.querySelector('#match-title')?.focus();
    }
    if (view) {
      host.querySelector('#match-count').textContent=view.fase==='CONFIRMACION'
        ? `${view.confirmados}/${view.jugadores} jugadores listos` : `${view.reunidos}/${view.jugadores} jugadores`;
      // Se muestra sin volver a pintar el panel, para no mover el foco de quien espera.
      const bots=host.querySelector('#match-bots');
      if(bots) bots.hidden=!(view.fase==='BUSCANDO' && view.bots);
      const countdown=host.querySelector('#match-time');
      if(countdown) countdown.textContent=`Confirma antes de que termine el plazo: ${Math.max(0,Math.ceil((view.hasta-Date.now())/1000))} s`;
    }
    for(const button of host.querySelectorAll('button')) button.disabled=busy || (button.dataset.match==='ready' && view?.listo);
  }
  async function apply(next) {
    if (next.fase==='ASIGNADA') {
      stop(); active=false; status();
      await onRoom(api.matchAccept(next.acceso));
    } else if(next.fase==='CANCELADA') {
      stop(); active=false; api.matchForget(); status(); onHome();
    } else { view=next; render(); }
  }
  function failure(error) {
    if ([401,404].includes(error.status)) {
      api.matchForget(); view=null; signature=''; status(error.message); render(); return;
    }
    status(error.status?error.message:'No pudimos confirmar el resultado. Consultando el estado de tu búsqueda…');
    const node=panel()?.querySelector('#match-error');
    if(node) node.textContent=error.message;
  }
  function schedule() {
    clearTimeout(timer);
    if(!active || !api.matchIdentity()) return;
    const current=generation;
    timer=setTimeout(async()=>{
      try {const next=await api.matchState();if(active&&current===generation){status();await apply(next);}}
      catch(error){if(active&&current===generation)failure(error);}
      finally {if(active&&current===generation)schedule();}
    },900);
  }
  async function mutate(task) {
    if(busy) return;
    stop();busy=true;render();const current=generation;
    try {const next=await task();if(active&&current===generation){status();await apply(next);}}
    catch(error){if(active&&current===generation)failure(error);}
    finally {busy=false;if(active){render();schedule();}}
  }
  return {
    active:()=>active,
    open() {
      stop();active=true;view=null;signature='';
      const saved=api.matchIdentity();
      if(saved) view={fase:'BUSCANDO',jugadores:saved.jugadores,reunidos:0};
      render();
      if(saved) void mutate(()=>api.matchState());
    },
    submit(nombre,jugadores) {return mutate(()=>{
      const pending=api.matchSearch(nombre,jugadores);
      view={fase:'BUSCANDO',jugadores,reunidos:0};render();return pending;
    });},
    command(command) {
      if(command==='ready' && view?.grupo) return mutate(()=>api.matchConfirm(view.grupo));
      if(command==='bots' && view?.bots) return mutate(()=>api.matchBots());
      if(command==='cancel') return mutate(()=>api.matchCancel());
      if(command==='back' && !api.matchIdentity()) {stop();active=false;status();onHome();}
    }
  };
}
