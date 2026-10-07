const SUPPORTED=new Set(['archivo_lanzamiento_libro']);
const CURSOR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 13 11-6 1-3 6z"/><path d="m12 15 4 6"/></svg>';

// Cosmetic channel has its own cursor, timers and cancellation; it never queues a game action.
export function createRoomInteractions({api,accounts,getState,getRoom,play,document=globalThis.document,schedule=setTimeout,cancel=clearTimeout,now=Date.now,onError=()=>{}}) {
  let alive=true,key='',seat='',boundAccount=null,generation=0,timer=null,tick=null,reading=false,sending=false,recovering=false,selecting=false,cursor,own=null,offset=0,controller=null,lastServerTime=0,readSerial=0,recoveryAfter=0;
  const context=()=>{const room=getRoom(),identity=api.identity();return room&&getState()&&identity&&room.codigo===identity.codigo?`${identity.codigo}:${identity.playerToken}:${accounts.identity?.()||''}`:'';};
  const valid=(token,expected)=>alive&&token===generation&&key===expected&&context()===expected;
  const targets=()=>getState()?.jugadores?.filter(player=>player.nombre!==getState().yo).map(player=>player.nombre)||[];
  const remaining=()=>Math.max(0,Math.ceil(((own?.disponibleEn||0)-(now()+offset))/1000));
  const visible=()=>Boolean(key&&boundAccount&&accounts.identity?.()===boundAccount&&accounts.signedIn?.()&&SUPPORTED.has(own?.interactionId)&&getState()?.yo&&getState()?.fase!=='FIN_PARTIDA'&&!document.getElementById?.('app')?.hidden);
  function cancelSelection() {
    selecting=false;
    document.querySelectorAll?.('.room-interaction-target').forEach(node=>node.classList.remove('room-interaction-target'));
    document.querySelector?.('[data-room-interaction]')?.setAttribute('aria-pressed','false');
  }
  function paint() {
    const slot=document.querySelector?.('#local .room-interaction-slot');if(!slot)return;
    if(!visible()){slot.innerHTML='';cancelSelection();return;}
    if(!slot.querySelector('[data-room-interaction]'))slot.innerHTML=`<button type="button" class="room-interaction-control" data-room-interaction aria-label="Usar interacción" title="Usar interacción" aria-pressed="false">${CURSOR}<span class="room-interaction-count" aria-hidden="true"></span></button><span class="room-interaction-message sr-only" role="status"></span>`;
    const button=slot.querySelector('[data-room-interaction]'),seconds=remaining();
    button.disabled=sending||recovering||seconds>0;
    const text=sending?'Enviando interacción…':recovering?'Comprobando disponibilidad…':seconds?`Interacción disponible en ${seconds} segundos`:'Usar interacción';
    button.title=text;button.setAttribute('aria-label',text);button.setAttribute('aria-pressed',String(selecting));
    slot.querySelector('.room-interaction-count').textContent=seconds?String(seconds):'';
    if(button.disabled)cancelSelection();
    if(selecting)document.querySelectorAll?.('.rival[data-player]').forEach(node=>node.classList.toggle('room-interaction-target',targets().includes(node.dataset.player)));
  }
  function reset() {
    ++generation;cancel(timer);cancel(tick);timer=tick=null;controller?.abort();controller=null;reading=sending=recovering=false;cursor=undefined;own=null;offset=0;lastServerTime=readSerial=recoveryAfter=0;cancelSelection();
    document.querySelector?.('#local .room-interaction-slot')?.replaceChildren();
  }
  function sync() {
    const nextSeat=context()?`${api.identity().codigo}:${api.identity().playerToken}`:'';
    if(nextSeat!==seat){seat=nextSeat;boundAccount=accounts.identity?.()||null;}
    const next=context();if(next!==key){reset();key=next;if(key){controller=new AbortController();void read();heartbeat();}}
    paint();
  }
  function heartbeat(){cancel(tick);if(!alive||!key)return;const token=generation;tick=schedule(()=>{if(token!==generation)return;sync();if(token===generation)heartbeat();},250);}
  function consume(channel) {
    if(Number.isFinite(channel.ahora)&&channel.ahora>=lastServerTime){offset=channel.ahora-now();lastServerTime=channel.ahora;own=channel.propia||null;}
    const baseline=cursor===undefined;
    const events=(channel.eventos||[]).filter(event=>Number.isSafeInteger(event.numero)&&event.numero>(cursor??Infinity)).sort((a,b)=>a.numero-b.numero);
    if(!baseline)for(const event of events){if(!SUPPORTED.has(event.interactionId))continue;void Promise.resolve(play(event,{state:getState(),signal:controller.signal})).catch(()=>{});}
    if(Number.isSafeInteger(channel.ultimo))cursor=Math.max(cursor??0,channel.ultimo);
    paint();
  }
  async function read() {
    if(!alive||!key||reading)return;reading=true;const token=generation,expected=key,serial=++readSerial;
    try{const channel=await api.interacciones(cursor);if(valid(token,expected)){if(serial>recoveryAfter)recovering=false;consume(channel);}}
    catch(error){if(valid(token,expected)&&[401,404].includes(error.status)){own=null;cancelSelection();paint();}}
    finally{if(valid(token,expected)){reading=false;cancel(timer);timer=schedule(()=>{sync();void read();},900);}}
  }
  async function send(target) {
    if(!visible()||sending||recovering||remaining()||!targets().includes(target))return;
    const token=generation,expected=key,interactionId=own.interactionId;sending=true;recoveryAfter=readSerial;cancelSelection();paint();
    try{const channel=await api.interactuar(interactionId,target);if(valid(token,expected))consume(channel);}
    catch(error){if(valid(token,expected)){recovering=true;onError(error.message||'No se pudo enviar la interacción.');/* Ambiguous writes are never repeated; read authoritative cooldown next. */}}
    finally{if(valid(token,expected)){sending=false;own={...own,disponibleEn:Math.max(own?.disponibleEn||0,now()+offset+1000)};paint();void read();}}
  }
  function click(event) {
    sync();const button=event.target.closest?.('[data-room-interaction]');
    if(button){if(!button.disabled&&visible()&&!sending&&!recovering&&!remaining()){selecting=!selecting;paint();}return;}
    if(!selecting)return;
    const target=event.target.closest?.('.rival[data-player]');
    if(target&&targets().includes(target.dataset.player)){event.preventDefault();event.stopImmediatePropagation();void send(target.dataset.player);return;}
    cancelSelection();paint();
  }
  function keydown(event){if(selecting&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancelSelection();paint();}}
  document.addEventListener('click',click,true);document.addEventListener('keydown',keydown,true);
  const unsubscribe=accounts.onChange?.(()=>sync());
  return {update:sync,reset(){reset();key=seat='';boundAccount=null;},destroy(){alive=false;reset();key=seat='';boundAccount=null;document.removeEventListener('click',click,true);document.removeEventListener('keydown',keydown,true);if(typeof unsubscribe==='function')unsubscribe();}};
}
