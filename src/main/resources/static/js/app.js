import {api} from './api.js';
import {createMatchmaking} from './matchmaking.js';
import {accounts} from './auth.js';
import {startPresence} from './presence.js';
import {createRoomInvitations} from './room-invitations.js';
import {createRoomInteractions} from './room-interactions.js';
import {playInteraction} from './interaction-effects.js';
import {initAccountPanel, progressText} from './account-panel.js';
import {homeCommunity} from './home-community.js';
import {img, esc} from './dom.js';
import {board} from './board.js';
import {ideaCard, ideaCardContents, roleCard} from './cards.js';
import {studies, articleChoices} from './players.js';
import {dialog, closeDialog, phaseDialog, reconcileDialog, informationalDialogOpen} from './dialogs.js';
import {endTurnWarning, preview, ideaUnavailableReason, highlightTargets, clearTargets} from './decisions.js';
import {notify, feedback, resetFeedback} from './feedback.js';
import {transition, settled, resetEffects, chooseRole, chooseVeto, victory} from './effects.js';

let visualBusy = false;
let renderQueue=Promise.resolve(), latestRoom=null;
let state = null, room = null, busy = false, selectedRole = null, pendingAction = null, selectedTarget = null;
let timer, screen = 'home', generation = 0;
const app = document.getElementById('app');
const connection = document.createElement('div');
const homeMessage = 'Reúne a tu academia. Cada persona juega desde su dispositivo, con su mano privada y una mesa compartida.';
const academyIntro = (community=false) => `${community?'':`<div class="academy-brand">${img('Logo/logo_tesis.webp','home-logo','Tesis')}<span>EL JUEGO DE LA INVESTIGACIÓN</span></div>`}<span class="eyebrow"><i aria-hidden="true"></i> La diferencia está en la ciencia</span>
    <h1>Construye tu<br><em>legado científico.</em></h1><p>${homeMessage}</p>
    <div class="home-features"><span><strong>3–5</strong> jugadores</span><span><strong>Una</strong> mesa compartida</span><span><strong>Tu</strong> mano privada</span></div>
    <div class="academy-showcase" aria-label="Personajes de Tesis"><div class="showcase-cards" aria-hidden="true">${img('personajes/02_estadistico.webp','showcase-card showcase-card-one')}${img('personajes/04_investigador_principal.webp','showcase-card showcase-card-two')}${img('personajes/05_decana.webp','showcase-card showcase-card-three')}</div><div class="showcase-caption"><span class="eyebrow">CADA PERSONAJE, UNA ESTRATEGIA</span><p>Una academia.<br>Muchas ambiciones.</p><span class="showcase-rule" aria-hidden="true"></span></div></div>`;
connection.className='network-status'; connection.setAttribute('role','status'); connection.hidden=true;
document.body.append(connection);
function connectionStatus(text='') { connection.textContent=text; connection.hidden=!text; }
const matchmaking=createMatchmaking({api,panel:()=>document.querySelector('.setup-panel'),
  onRoom:next=>run(()=>next),onHome:()=>home('play',true),status:connectionStatus});
const roomInvitations=createRoomInvitations({accounts,api,getRoom:()=>room,onAccept:acceptRoomInvitation});
const roomInteractions=createRoomInteractions({accounts,api,getRoom:()=>room,getState:()=>state,play:playInteraction,onError:message=>notify(message,'error')});
async function acceptRoomInvitation(id) {
  if(busy||visualBusy)throw new Error('Espera a que termine la operación actual.');
  if(api.matchIdentity?.())throw new Error('Cancela tu búsqueda de partida antes de aceptar otra invitación.');
  if(api.identity()) {
    const current=await api.state();
    if(current.fase!=='LOBBY'&&current.partida?.fase!=='FIN_PARTIDA')throw new Error('Termina tu partida actual antes de entrar en otra sala.');
    if(current.fase==='LOBBY'&&!window.confirm('¿Entrar en la sala invitada? Tu asiento actual se conserva, pero esta pestaña pasará a la nueva sala.'))return false;
  }
  const actor=accounts.identity();
  if(!actor)throw new Error('Inicia sesión para aceptar la invitación.');
  stopPolling();busy=true;document.body.classList.add('busy');
  try {
    const next=await api.acceptInvitation(id);
    if(actor!==accounts.identity())return false;
    document.querySelector('.public-profile-dialog[open]')?.close();
    if(!document.getElementById('account-panel').hidden)window.location.hash='';
    closeDialog();connectionStatus();await renderRoom(next,true);return true;
  } finally {busy=false;document.body.classList.remove('busy');schedulePoll();}
}
function openMatchmaking() {
  home();screen='matchmaking';
  document.querySelector('.setup-panel')?.setAttribute('aria-labelledby','match-title');
  matchmaking.open();
}
function stopPolling() { clearTimeout(timer); generation++; }
function schedulePoll() {
  clearTimeout(timer);
  if (screen === 'home' || !api.identity()) return;
  const current = generation;
  timer = setTimeout(async () => {
    try {
      const next = await api.state();
      if (current === generation) { connectionStatus(); void renderRoom(next).catch(handleError); }
    } catch (error) { if (current === generation) handleError(error); }
    finally { if (current === generation) schedulePoll(); }
  },900);
}
function home(mode='play',restoreFocus=false) {
  roomInteractions.reset();
  stopPolling(); resetEffects(); screen='home'; closeDialog(); resetFeedback(); connectionStatus();
  state=null; room=null;
  const accountOpener=document.getElementById('account-open');
  const progress=document.getElementById('account-progress');
  accountOpener.classList.remove('in-board');document.body.append(accountOpener,progress);
  progress.hidden=true;
  app.innerHTML = `<section class="home-screen home-hub"><div class="academy-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div><nav class="home-nav" aria-label="Navegación principal"><button class="text-button home-header-help" data-command="help"><span aria-hidden="true">✧</span> Cómo jugar</button><span class="home-nav-wordmark">TESIS <small>LA ACADEMIA</small></span><div class="home-nav-actions"><div class="home-account-slot"></div></div></nav>
    <div class="home-layout"><aside class="home-sidebar">${homeCommunity()}</aside><div class="home-copy">${academyIntro(true)}</div>
    <section class="setup-panel ${mode==='play'?'play-menu':'private-panel'}" aria-labelledby="academy-access-title" data-home-mode="${mode}">${homeAccess(mode)}</section></div><div class="home-footer"><span class="footer-motto">INVESTIGAR. TRANSFORMAR. MEJORAR.</span><span class="footer-edition">UNA MESA. MUCHAS IDEAS.</span></div></section>`;
  document.querySelector?.('.home-account-slot')?.append(accountOpener);
  if(mode!=='play' || restoreFocus) document.getElementById('academy-access-title')?.focus({preventScroll:true});
  roomInvitations.refreshLobby();
}
function homeAccess(mode) {
  const resume=api.identity()?'<button class="text-button resume" data-command="resume">↪ Reanudar mi sala</button>':'';
  if(mode==='play') return `<div class="play-menu-heading"><span class="eyebrow">TU PRÓXIMA PARTIDA</span><h2 id="academy-access-title" tabindex="-1">Elige tu mesa.</h2><p>Un lugar para cada idea. Una forma de jugar para ti.</p></div>
    <div class="play-featured"><span class="play-featured-icon" aria-hidden="true">✦</span><span class="eyebrow">PARTIDA ONLINE</span><h3>Encuentra tu academia</h3><p>Conoce a otros investigadores en una mesa de 3, 4 o 5 personas.</p><button class="gold-button match-entry" data-command="matchmaking">Buscar partida <span aria-hidden="true">→</span></button></div>
    <div class="private-options"><div class="room-divider"><span>CON TUS AMIGOS</span></div><button class="plain-button private-option" data-command="private-create"><span><strong>Crear sala privada</strong><small>Invita con tu propio código</small></span><span aria-hidden="true">＋</span></button><button class="plain-button private-option" data-command="private-join"><span><strong>Tengo un código</strong><small>Únete a una sala privada</small></span><span aria-hidden="true">↗</span></button></div>${resume}<p class="access-note">Puedes jugar como invitado o iniciar sesión para guardar tu progreso.</p>`;
  const creating=mode==='private-create';
  return `<div class="setup-heading"><span class="eyebrow">SALA PRIVADA</span><button class="text-button mode-back" data-command="home" aria-label="Volver a elegir mesa">← Inicio</button></div><nav class="play-mode-tabs" aria-label="Opciones de sala privada"><button data-command="private-create" aria-pressed="${creating}">Crear sala</button><button data-command="private-join" aria-pressed="${!creating}">Tengo un código</button></nav>
    <h2 id="academy-access-title" tabindex="-1">${creating?'Reúne a tu academia.':'Tu mesa te espera.'}</h2><p>${creating?'Crea una sala y comparte el código con tus amigos. Cada persona entra desde su dispositivo.':'Introduce la invitación de tus amigos y el nombre que usarás en la mesa.'}</p>
    ${creating?'<form id="create-room" class="room-form"><label for="create-name">Tu nombre<input id="create-name" name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Tu nombre en la mesa"></label><button class="gold-button" type="submit">Crear sala privada <span aria-hidden="true">→</span></button></form>':'<form id="join-room" class="room-form"><label for="join-code">Código de sala<input id="join-code" name="codigo" maxlength="5" minlength="5" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="A7K3Q" class="code-input"></label><label for="join-name">Tu nombre<input id="join-name" name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Tu nombre en la mesa"></label><button class="gold-button join-button" type="submit">Entrar en la sala <span aria-hidden="true">→</span></button></form>'}
    ${resume}<p class="access-note">3–5 personas · Cada identidad y mano son privadas.</p>`;
}
function lobby() {
  const accountOpener=document.getElementById('account-open'),progress=document.getElementById('account-progress');
  accountOpener.classList.remove('in-board');document.body.append(accountOpener,progress);
  app.innerHTML = `<section class="home-screen lobby-screen"><div class="academy-atmosphere" aria-hidden="true"><span></span><span></span><span></span><span></span></div><nav class="home-nav" aria-label="Navegación principal"><button class="text-button home-header-help" data-command="help"><span aria-hidden="true">✧</span> Cómo jugar</button><span class="home-nav-wordmark">TESIS <small>LA ACADEMIA</small></span><div class="home-nav-actions"><div class="home-account-slot"></div></div></nav><div class="home-copy">${academyIntro()}<button class="text-button lobby-back" data-command="home">← Volver al inicio</button></div>
    <section class="setup-panel lobby-panel" aria-labelledby="lobby-title"><div class="setup-heading"><span class="eyebrow">LA ACADEMIA SE REÚNE</span><span class="lobby-live"><i aria-hidden="true"></i> Sala abierta</span></div><h2 id="lobby-title">Tu mesa está lista.</h2><div class="room-code-box"><span class="eyebrow">COMPARTE ESTE CÓDIGO</span><h2 class="room-code">${esc(room.codigo)}</h2><p>Tu identidad: <strong>${esc(room.yo)}</strong></p></div><div class="lobby-roster-heading"><h3>La academia</h3><span>${room.jugadores.length} / 5 jugadores</span></div><ul class="lobby-players">${room.jugadores.map((n,i)=>`<li><span class="lobby-avatar" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="lobby-player-name">${esc(n)}${n===room.yo?'<span class="lobby-you">tú</span>':''}<small>${n===room.anfitrion?'Anfitrión':'Investigador'}</small></div><span class="lobby-player-status" aria-label="En la sala">${n===room.anfitrion?'♛':'✓'}</span></li>`).join('')}</ul>
    ${room.soyAnfitrion ? `<button class="gold-button" data-command="start-game" ${(room.jugadores.length<3 || room.jugadores.length>5)?'disabled':''}>Iniciar partida</button><p class="setup-note">${(room.jugadores.length<3 || room.jugadores.length>5)?'Esperando jugadores. Se necesitan entre 3 y 5.':'Todo preparado. Puedes iniciar la partida.'}</p>` : `<p class="waiting-copy">Esperando a que ${esc(room.anfitrion)} inicie la partida…</p>`}</section></section>`;
  document.querySelector?.('.home-account-slot')?.append(accountOpener);
  document.querySelector?.('.lobby-panel')?.append(progress);
  const slot=document.createElement('div');slot.dataset.roomInvitations='';
  document.querySelector?.('.lobby-panel')?.append(slot);roomInvitations.refreshLobby();
}
function renderRoom(next, force=false) {
  const requestedGeneration=generation;
  latestRoom=next;
  const result=renderQueue.then(()=>{
    if(requestedGeneration!==generation || (latestRoom.codigo===next.codigo && latestRoom.revision>next.revision)) return;
    return applyRoom(next,force);
  });
  renderQueue=result.catch(()=>{});
  return result;
}
async function applyRoom(next, force=false) {
  // La persistencia cambia independientemente de la revisión del juego.
  if (!room || (room.codigo===next.codigo && next.revision>=room.revision) || (force && room.codigo!==next.codigo)) {
    const progress=document.getElementById('account-progress');
    const message=progressText(next.progreso);
    if(progress.textContent!==message) {
      progress.textContent=message;
      if(next.progreso?.estado==='CONFIRMADA' && accounts.signedIn()) void accounts.refreshProfile().catch(()=>{});
    }
    progress.hidden=!message || Boolean(next.partida && next.partida.fase!=='FIN_PARTIDA');
    if(room?.codigo===next.codigo) room={...room,progreso:next.progreso};
  }
  if (room?.codigo===next.codigo && room.revision>=next.revision && screen==='game') return;
  if (!force && room?.codigo===next.codigo && room.revision===next.revision) return;
  const before=state, current=generation;
  const sameRoom=room?.codigo===next.codigo;
  if (!sameRoom) { resetFeedback(); resetEffects();roomInteractions.reset(); }
  const after=next.partida ? {...next.partida, yo:next.yo} : null;
  visualBusy=true; document.body.classList.add('visual-busy');
  try {
    const roleConfirmation=sameRoom && before && after?.eventos.some(e=>e.numero>(before.eventos.at(-1)?.numero || 0) && e.tipo==='accion.seleccionar_personaje' && e.actor===after.yo);
    const turnOpening=sameRoom && before && after?.eventos.some(e=>e.numero>(before.eventos.at(-1)?.numero || 0)
      && ['fase.turno','turno.vetado'].includes(e.tipo));
    if (!roleConfirmation || turnOpening) reconcileDialog(sameRoom);
    if (after) {
      try { await transition(sameRoom ? before : null,after); }
      catch (error) { console.error('No se pudo representar el efecto visual',error); resetEffects(); }
    }
    if (current!==generation) return;
    room=next; screen=room.fase==='LOBBY'?'lobby':'game';
    if (screen==='lobby') { state=null;roomInteractions.reset(); lobby(); return; }
    state=after; selectedRole=null; pendingAction=null; selectedTarget=null; clearTargets(); reconcileDialog(sameRoom);
    roomInvitations.refreshLobby();
    const accountOpener=document.getElementById('account-open'),progress=document.getElementById('account-progress');
    document.body.append(accountOpener,progress);
    board(state); feedback(sameRoom ? before : null,state); settled(sameRoom ? before : null,state);
    roomInteractions.update();
    accountOpener.classList.add('in-board');document.querySelector('#board .utility').append(accountOpener,progress);
    const accountPageOpen=!document.getElementById('account-panel').hidden;
    if (!accountPageOpen && state.fase==='SELECCION_ROLES' && state.seleccion.length && (!before || before.fase!=='SELECCION_ROLES' || before.actual!==state.actual) && !document.getElementById('modal').open) phaseDialog(state);
    if (!accountPageOpen && state.fase==='FIN_RONDA' && (!before || before.fase!=='FIN_RONDA')) phaseDialog(state);
    if (!accountPageOpen && state.fase==='FIN_PARTIDA' && (!before || before.fase!=='FIN_PARTIDA') && !informationalDialogOpen()) { phaseDialog(state); if(before) victory(); }
  } finally {visualBusy=false; document.body.classList.remove('visual-busy');}
}
function handleError(error) {
  if (error.status) connectionStatus();
  if ([401,404].includes(error.status) && screen !== 'home') {
    api.forget(); room=null; state=null; home();
    dialog('No podemos recuperar tu sala',`<p>${esc(error.message)}</p><p>Vuelve a crear una sala o introduce un código para unirte.</p>`); return;
  }
  if (!error.status) connectionStatus('Reconectando… conservamos tu identidad y volveremos a intentarlo.');
  else notify(error.message,'error');
}
async function run(task) {
  if (busy) return;
  stopPolling(); busy=true; document.body.classList.add('busy');
  try {
    const next=await task();
    connectionStatus();
    await renderRoom(next,true);
  }
  catch (error) {
    handleError(error);
    if (error.status===409 && api.identity()) {
      try {
        const next=await api.state();
        connectionStatus();
        await renderRoom(next,true);
      } catch (next) { handleError(next); }
    }
  } finally { busy=false; document.body.classList.remove('busy'); schedulePoll(); }
}
const act = (type, option = {}) => run(() => api.action(room.revision,type,option));

function help() {
  const resourceGuide = (icon, title, text) => `<div>${img(`recursos/${icon}.webp`,'rules-resource-image')}<div><h3>${title}</h3><p>${text}</p></div></div>`;
  const ecological = `<div class="game-card idea-card rules-example-card" role="img" aria-label="Artículo Ecológico: coste 2 monedas, 1 de trabajo requerido y 1 de prestigio">${ideaCardContents({nombre:'Artículo Ecológico',coste:2,trabajo:1,prestigio:1,arte:'articulos/01_ecologico.webp',marco:'cartas/marco_articulo_comun.webp'})}</div>`;
  const publicationFlow = `<div class="rules-publication-flow" role="group" aria-label="Ejemplo visual: de idea a publicación"><figure>${ecological}<figcaption><span class="eyebrow">EN TU MANO</span><strong>Una idea</strong><span>Artículo Ecológico</span></figcaption></figure><span class="rules-flow-arrow" aria-hidden="true">→</span><figure>${ecological}<figcaption><span class="eyebrow">1. INICIAR</span><strong>Un estudio</strong><span>Pagas 2 monedas · 0 / 1 trabajo</span></figcaption></figure><span class="rules-flow-arrow" aria-hidden="true">→</span><figure class="rules-flow-published">${ecological}<figcaption><span class="eyebrow">2. TRABAJAR</span><strong>¡Publicado!</strong><span>1 / 1 trabajo · +1 prestigio</span></figcaption></figure></div>`;
  dialog('Cómo jugar a Tesis', `<article class="rules-guide">
    <div class="rules-overview">${img('recursos/prestigio.webp','rules-overview-medal')}<span class="eyebrow">TU OBJETIVO</span><h2>Termina con más prestigio.</h2><p>Transforma las ideas de tu mano en estudios, trabaja en ellos y publícalos para ganar prestigio. Tu personaje cambia cada ronda y te ofrece una ventaja distinta.</p><p><strong>La tercera publicación de cualquier persona activa el final, pero la ronda se juega completa.</strong> Gana quien tenga más prestigio, aunque haya publicado menos. Si hay empate, gana quien tenga más monedas; si sigue el empate, quien tenga más cartas en la mano.</p></div>
    <nav class="rules-nav" aria-label="Apartados de las reglas">${[
      ['preparacion','1. Preparación'],['ronda','2. La ronda'],['turno','3. Tu turno'],['estudios','4. Publicar'],['personajes','5. Personajes'],['final','6. Final y victoria'],['consulta','Consulta rápida']
    ].map(([id,label])=>`<button type="button" data-command="rules-section" data-section="${id}">${label}</button>`).join('')}</nav>
    <section class="rules-section" aria-labelledby="rules-preparacion"><h2 id="rules-preparacion" tabindex="-1"><span>01</span> Prepara la academia</h2><p>Jugáis <strong>entre 3 y 5 personas</strong>, cada una desde su dispositivo. El anfitrión crea una sala, comparte su código y, cuando todos hayan entrado, inicia la partida.</p><p>Cada persona empieza con <strong>2 monedas y 2 ideas</strong>. Las monedas pagan nuevos estudios; las ideas están en tu mano privada. El trabajo mide el progreso de cada estudio y el prestigio es tu puntuación.</p><div class="rules-resource-guide" aria-label="Recursos del juego">${resourceGuide('moneda','Monedas','Pagan el coste de iniciar un estudio.')}${resourceGuide('trabajo','Trabajo','Completa los estudios de tu academia.')}${resourceGuide('prestigio','Prestigio','Tu puntuación para ganar la partida.')}</div><div class="rules-note"><strong>Qué ve cada persona.</strong> Tu mano y el personaje que eliges son privados. Las monedas, el prestigio y los estudios de todas las academias son públicos. Los personajes rivales se revelan cuando llega su turno o se resuelve un veto.</div></section>
    <section class="rules-section" aria-labelledby="rules-ronda"><h2 id="rules-ronda" tabindex="-1"><span>02</span> Una ronda, dos etapas</h2><ol class="rules-steps"><li><strong>Elegid personaje.</strong> Al comenzar cada ronda se retiran al azar 2 de los 7 personajes si sois 3 personas, o 1 si sois 4 o 5. La primera persona en elegir se decide al azar al inicio de la partida; las demás eligen siguiendo el orden de jugadores. Cada una toma un personaje de los que quedan.</li><li><strong>Jugad los turnos.</strong> Cuando todos han elegido, se juega de menor a mayor número de personaje, del 1 al 7. Tu asiento no determina cuándo actúas.</li></ol><p>Al terminar la ronda, los personajes vuelven a estar disponibles para una nueva selección y se repite el descarte. <strong>Conservas tus monedas, ideas, estudios y prestigio.</strong> Si el Investigador Principal jugó su turno, su academia elige primero en la siguiente ronda; si no, empieza quien abrió la selección anterior.</p></section>
    <section class="rules-section" aria-labelledby="rules-turno"><h2 id="rules-turno" tabindex="-1"><span>03</span> Qué puedes hacer en tu turno</h2><p>Primero recibes los ingresos de tus Patentes publicadas y los efectos automáticos de tu personaje, si corresponden. Después dispones de <strong>hasta 2 acciones base</strong>. Puedes combinarlas como quieras o repetir la misma.</p><div class="rules-action-grid"><div>${img('acciones/cobrar.webp','rules-action-image')}<h3>Cobrar</h3><p>Recibe <strong>2 monedas</strong>.</p></div><div>${img('acciones/pensar.webp','rules-action-image')}<h3>Pensar</h3><p>Roba <strong>1 idea</strong> y añádela a tu mano.</p></div><div>${img('acciones/iniciar_estudio.webp','rules-action-image')}<h3>Iniciar un estudio</h3><p>Elige una idea de tu mano y paga su coste en monedas. Pasa a tu academia con <strong>0 de trabajo</strong>.</p></div><div>${img('acciones/trabajar.webp','rules-action-image')}<h3>Trabajar</h3><p>Añade <strong>1 de trabajo</strong> a un estudio propio en desarrollo.</p></div></div><p>Tu <strong>habilidad activa no consume acciones base</strong>: puedes usarla una vez por turno, antes, entre o después de ellas, si hay un objetivo válido. Los efectos automáticos se aplican solos.</p><div class="rules-note"><strong>Excepción: Comité de Ética.</strong> Debes resolver su veto antes de hacer acciones base o terminar el turno.</div><p>Pulsa <strong>Terminar turno</strong> cuando hayas acabado. Puedes hacerlo aunque te queden acciones o no hayas usado una habilidad opcional; lo que no uses se pierde.</p></section>
    <section class="rules-section" aria-labelledby="rules-estudios"><h2 id="rules-estudios" tabindex="-1"><span>04</span> De la idea a la publicación</h2><p>Lee los tres valores de la carta: <strong>monedas</strong> para iniciar el estudio, <strong>trabajo</strong> para completarlo y <strong>prestigio</strong> que recibes al publicarlo. Iniciar no añade trabajo.</p><p>El estudio permanece en tu academia y conserva su progreso entre turnos y rondas. Cuando alcanza el trabajo requerido, <strong>se publica automáticamente y suma su prestigio</strong>. Publicar no cuesta monedas ni una acción adicional.</p><div class="rules-example"><h3>Tu primer artículo</h3>${publicationFlow}<p>Tienes 2 monedas y un <strong>Artículo Ecológico</strong> en la mano: cuesta 2 monedas, requiere 1 de trabajo y da 1 de prestigio.</p><ol><li>Primera acción: <strong>Iniciar un estudio</strong>. Pagas las 2 monedas y lo colocas con 0 de trabajo.</li><li>Segunda acción: <strong>Trabajar</strong>. Añades 1 de trabajo: se publica y ganas 1 de prestigio.</li></ol><p>Con <strong>Pre-Doctoral</strong> podrías aportar ese trabajo mediante tu habilidad gratuita y reservar la segunda acción para otra cosa.</p></div><p>Un estudio publicado ya no puede recibir trabajo ni sufrir la habilidad del Revisor 2. El Estadístico sí puede aumentar su prestigio.</p></section>
    <section class="rules-section" aria-labelledby="rules-personajes"><h2 id="rules-personajes" tabindex="-1"><span>05</span> Los 7 personajes, en orden de turno</h2><p>El número determina cuándo juegas. Abre cada personaje para consultar su habilidad y sus límites.</p><div class="rules-roles">
      <details><summary>${img('personajes/01_comite_etica.webp','rules-role-portrait')}<span class="rules-role-order">1</span><strong>Comité de Ética</strong><span class="rules-role-type">Activa · obligatoria</span></summary><div><p>Antes de actuar o terminar, nombra en privado <strong>otro personaje</strong> para vetarlo. No puedes nombrar al propio Comité ni a la Decana.</p><p>Si alguien eligió ese personaje, pierde todo su turno, incluidos los ingresos de Patentes y sus efectos automáticos. Si nadie lo eligió, el veto no tiene efecto y tu habilidad queda usada.</p></div></details>
      <details><summary>${img('personajes/02_estadistico.webp','rules-role-portrait')}<span class="rules-role-order">2</span><strong>Estadístico</strong><span class="rules-role-type">Activa</span></summary><div><p>Añade <strong>1 de prestigio</strong> a uno de tus estudios ya publicados. Puedes mejorar el mismo estudio en otra ronda si vuelves a elegir al Estadístico.</p></div></details>
      <details><summary>${img('personajes/04_investigador_principal.webp','rules-role-portrait')}<span class="rules-role-order">3</span><strong>Investigador Principal</strong><span class="rules-role-type">Automática</span></summary><div><p>Al inicio de tu turno recibes <strong>1 idea extra</strong> y tu academia pasa a elegir primero en la siguiente ronda. Si te vetan, no recibes la idea ni obtienes la primera elección.</p></div></details>
      <details><summary>${img('personajes/05_decana.webp','rules-role-portrait')}<span class="rules-role-order">4</span><strong>Decana</strong><span class="rules-role-type">Automática</span></summary><div><p>Tienes <strong>inmunidad frente a las habilidades rivales durante toda la ronda</strong>, desde que eliges este personaje. No pueden vetarte ni retirar trabajo de tus estudios.</p></div></details>
      <details><summary>${img('personajes/06_editorial.webp','rules-role-portrait')}<span class="rules-role-order">5</span><strong>Editorial</strong><span class="rules-role-type">Automática</span></summary><div><p>Al inicio de tu turno recibes <strong>1 moneda por cada estudio publicado en toda la mesa</strong>, incluidos los tuyos y las Patentes. No cuentan los estudios en desarrollo ni los que se publiquen después de empezar tu turno.</p></div></details>
      <details><summary>${img('personajes/07_pre_doctoral.webp','rules-role-portrait')}<span class="rules-role-order">6</span><strong>Pre-Doctoral</strong><span class="rules-role-type">Activa</span></summary><div><p>Añade <strong>1 de trabajo gratis</strong> a un estudio propio en desarrollo, una vez por turno. Puede completar y publicar el estudio. Esta habilidad es independiente de Trabajar: cada acción base Trabajar sigue aportando 1 de trabajo.</p></div></details>
      <details><summary>${img('personajes/08_revisor_2.webp','rules-role-portrait')}<span class="rules-role-order">7</span><strong>Revisor 2</strong><span class="rules-role-type">Activa</span></summary><div><p>Quita <strong>1 de trabajo</strong> a un estudio rival en desarrollo que tenga trabajo acumulado, una vez por turno y sin coste.</p><p>No puede afectar a estudios propios, publicados, sin trabajo o de la Decana. Por ejemplo: un estudio con 1 de trabajo queda en 0; uno con 3 queda en 2.</p></div></details>
    </div></section>
    <section class="rules-section" aria-labelledby="rules-final"><h2 id="rules-final" tabindex="-1"><span>06</span> El final y la victoria</h2><p>Cuando alguien alcanza <strong>3 estudios publicados</strong>, continuáis los turnos pendientes de esa ronda. Al acabarla se compara el prestigio total y termina la partida.</p><div class="rules-example"><h3>Tres publicaciones activan el final; el prestigio decide</h3><p>Ana publica su tercer estudio y tiene 5 de prestigio. Bruno aún juega en esa ronda y termina con 7 de prestigio y 2 publicaciones. <strong>Gana Bruno.</strong></p></div><div class="rules-note"><strong>Desempate.</strong> Si varias personas terminan con el mismo prestigio máximo, gana quien tenga <strong>más monedas</strong>. Si también empatan en monedas, gana quien tenga <strong>más cartas en la mano</strong>. Solo si el empate continúa se comparte la victoria.</div><p>Los estudios en desarrollo no dan prestigio. Sí cuentan las mejoras del Estadístico y las Patentes publicadas; una Patente cuenta como una publicación para activar el final.</p></section>
    <section class="rules-section" aria-labelledby="rules-consulta"><h2 id="rules-consulta" tabindex="-1">Consulta rápida</h2><details class="rules-reference"><summary>Cartas de idea: costes, trabajo y prestigio</summary><div><p>El mazo es <strong>inagotable y con reposición</strong>: cada idea robada sigue las probabilidades de la tabla, también en el reparto inicial. Pueden repetirse cartas.</p><div class="rules-table-scroll" role="region" aria-label="Catálogo de ideas" tabindex="0"><table><caption>Valores y probabilidad de cada idea</caption><thead><tr><th scope="col">Idea</th><th scope="col">Monedas</th><th scope="col">Trabajo</th><th scope="col">Prestigio</th><th scope="col">Probabilidad</th></tr></thead><tbody>${[
      ['Artículo Ecológico',2,1,1,'13%'],['Artículo Transversal',3,1,2,'13%'],['Casos y Controles',3,2,3,'13%'],['Cohortes',4,3,5,'13%'],['Revisión Sistemática',3,5,6,'13%'],['Ensayo Clínico Aleatorizado',5,4,7,'13%'],['Ensayo Comunitario',9,4,9,'13%'],['Patente',4,4,5,'9%']
    ].map(([name,...values])=>`<tr><th scope="row">${name}</th>${values.map(value=>`<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p><strong>Patente · Legendaria:</strong> una vez publicada, genera <strong>2 monedas al inicio de cada turno tuyo</strong>. Varias Patentes acumulan sus ingresos. Un turno vetado no genera ingresos.</p></div></details><details class="rules-reference"><summary>Jugar desde varios dispositivos y volver a la sala</summary><div><p>Comparte el código para que cada persona entre desde su navegador. Al recargar recuperas tu identidad en la misma pestaña. Mantén esa pestaña para volver a tu partida: abrir otra no recupera tu identidad por nombre.</p><p>Las salas caducan tras 24 horas sin actividad válida y desaparecen si se reinicia el servidor.</p></div></details></section>
    <div class="rules-guide-footer"><button type="button" class="plain-button" data-command="rules-section" data-section="preparacion">Volver a la preparación ↑</button><button type="button" class="gold-button" data-command="close">Listo para jugar</button></div>
    </article>`, {wide:true, kind:'info', subtitle:'Una guía para empezar y consultar durante la partida.'});
  document.getElementById('modal').classList.add('rules-dialog');
}
function chooseAction(id) {
  const action = state.acciones.find(a => a.id === id);
  if (!action) return;
  if (!action.disponible) {
    dialog(action.nombre, `<p>${esc(action.motivo)}</p>`, {kind:'info', snapshot:true}); return;
  }
  if (id === 'FIN_TURNO' && endTurnWarning(state)) {
    dialog('¿Terminar el turno?', `<p>${esc(endTurnWarning(state))}</p><p>Si terminas ahora, renuncias a lo que queda de este turno.</p><div class="dialog-buttons"><button class="plain-button" data-command="close">Seguir jugando</button><button class="gold-button" data-command="confirm-end">Terminar turno</button></div>`);
    return;
  }
  if (!action.opciones.length) { act(id); return; }
  pendingAction = action;
  highlightTargets(action,state);
  let content;
  const ethics = id === 'HABILIDAD' && action.opciones.every(o => o.rol);
  if (ethics) content = `<section class="ethics-selection"><p class="ethics-classification">EXPEDIENTE RESERVADO · REVISIÓN ACADÉMICA</p><p>Elige el personaje que deseas vetar. Esta decisión solo la ves tú.</p><div class="ethics-grid">${action.opciones.map((o,i) => roleCard({...o.rol,indice:i},{command:'veto-choice'})).join('')}</div><p class="ethics-status" role="status">Selecciona una carta para registrar el veto.</p></section>`;
  else if (id === 'INICIAR') content = `<div class="idea-selection">${state.mano.map(c => `<div class="idea-option ${action.opciones.some(o => o.indice === c.indice) ? 'eligible-option' : ''}">${ideaCard(c,{command:'start-choice'})}${action.opciones.some(o => o.indice === c.indice) ? '<span>Objetivo válido</span>' : `<small>${esc(ideaUnavailableReason(state,c))}</small>`}</div>`).join('')}</div>`;
  else if (action.opciones.every(o => Number.isInteger(o.indice))) content = articleChoices(action,state);
  else content = `<div class="target-list">${action.opciones.map((o,i) => `<button class="target-button" data-command="target" data-index="${i}">${esc(o.etiqueta)}<span>Seleccionar</span></button>`).join('')}</div>`;
  dialog(ethics ? 'Comité de Ética' : action.nombre, `<p class="decision-copy">${esc(action.descripcion)}</p>${content}`, {wide:ethics || action.opciones.some(o => Number.isInteger(o.indice))});
}
function inspect(c, study = null, player = null) {
  if (!c) return;
  const canStart = !study && state.acciones.find(a => a.id === 'INICIAR')?.opciones.some(o => o.indice === c.indice)
    && state.acciones.find(a => a.id === 'INICIAR')?.disponible;
  const canWork = study && player === state.yo && state.acciones.find(a => a.id === 'TRABAJAR')?.disponible
    && state.acciones.find(a => a.id === 'TRABAJAR')?.opciones.some(o => o.indice === study.indice);
  dialog(c.nombre, `<div class="card-detail">${ideaCard(c,{command:'noop'})}<div><span class="eyebrow">${study ? study.publicado ? 'ARTÍCULO PUBLICADO' : 'ESTUDIO EN DESARROLLO' : 'CARTA DE IDEA'}</span><h2>${esc(c.nombre)}</h2>
    <dl><div><dt>Coste de inicio</dt><dd>${c.coste} monedas</dd></div><div><dt>Trabajo requerido</dt><dd>${c.trabajo} puntos</dd></div><div><dt>Prestigio</dt><dd>${c.prestigio}${study?.prestigioExtra ? ` + ${study.prestigioExtra}` : ''}</dd></div></dl>
    ${c.ingresoPorTurno ? `<p>Legendaria. Mientras esté publicada, recibes ${c.ingresoPorTurno} monedas al iniciar tu turno.</p>` : ''}
    ${study ? `<p>Progreso: ${study.trabajo} / ${c.trabajo}</p>` : ''}
    ${canStart ? `${preview(state.acciones.find(a=>a.id==='INICIAR').opciones.find(o=>o.indice===c.indice))}<button class="gold-button" data-command="start" data-index="${c.indice}">Iniciar estudio · ${c.coste} monedas</button>` : ''}
    ${canWork ? `${preview(state.acciones.find(a=>a.id==='TRABAJAR').opciones.find(o=>o.indice===study.indice))}<button class="gold-button" data-command="work" data-index="${study.indice}">Trabajar en este estudio</button>` : ''}
    ${!study && !canStart ? `<p class="muted">${esc(ideaUnavailableReason(state,c))}</p>` : ''}</div></div>`, {kind:canStart || canWork ? 'decision' : 'info', snapshot:true});
}

function confirmTarget(index) {
  const option = pendingAction?.opciones[index];
  if (!option || !pendingAction.disponible) return;
  selectedTarget = index;
  const owner = state.jugadores.find(p=>p.nombre===(option.objetivo || state.yo));
  const study = owner?.estudios.find(s=>s.indice===option.indice);
  dialog(pendingAction.nombre, `<div class="target-confirm">${study ? ideaCard(study.carta,{command:'noop'}) : ''}<h2>${esc(option.etiqueta)}</h2>${study ? `<p>Academia de ${esc(owner.nombre)}</p>` : ''}${preview(option)}<div class="dialog-buttons"><button class="plain-button" data-command="back-targets">Volver a los objetivos</button><button class="gold-button" data-command="confirm-target">Confirmar ${esc(pendingAction.nombre.toLowerCase())}</button></div></div>`);
}

for (const event of ['pointerover','focusin']) document.addEventListener(event, e=>{
  const button=e.target.closest?.('[data-command="action"]');
  if (button && state) highlightTargets(state.acciones.find(a=>a.id===button.dataset.action),state);
});
for (const event of ['pointerout','focusout']) document.addEventListener(event, e=>{
  if (e.target.closest?.('[data-command="action"]') && !document.getElementById('modal').open) clearTargets();
});
document.getElementById('modal').addEventListener('close',clearTargets);

document.addEventListener('submit', e => {
  if(e.target.id==='match-search') {
    e.preventDefault();const fields=new FormData(e.target);
    void matchmaking.submit(String(fields.get('nombre')).trim(),Number(fields.get('jugadores')));return;
  }
  if (!['create-room','join-room'].includes(e.target.id)) return;
  e.preventDefault();
  const fields=new FormData(e.target); const name=String(fields.get('nombre')).trim();
  run(() => e.target.id==='create-room' ? api.create(name) : api.join(String(fields.get('codigo')),name));
});
document.addEventListener('click', async e => {
  const matchButton=e.target.closest('[data-match]');
  if(matchButton && !matchButton.disabled) {void matchmaking.command(matchButton.dataset.match);return;}
  const button = e.target.closest('[data-command]'); if (!button || button.disabled || busy || visualBusy) return;
  const index = Number(button.dataset.index);
  switch (button.dataset.command) {
    case 'matchmaking': openMatchmaking(); break;
    case 'private-create': home('private-create'); break;
    case 'private-join': home('private-join'); break;
    case 'home': home('play',true); break;
    case 'resume': screen='connecting'; run(() => api.state()); break;
    case 'start-game': run(() => api.start(room.revision)); break;
    case 'help': help(); break;
    case 'rules-section': {
      const heading = document.getElementById(`rules-${button.dataset.section}`);
      heading?.focus({preventScroll:true}); heading?.scrollIntoView({block:'start'});
      break;
    }
    case 'close': closeDialog(); clearTargets(); break;
    case 'confirm-end': if (state.acciones.some(a => a.id === 'FIN_TURNO' && a.disponible)) act('FIN_TURNO'); break;
    case 'phase': phaseDialog(state); break;
    case 'action': chooseAction(button.dataset.action); break;
    case 'unavailable-role': {
      const r = state.catalogoSeleccion.find(r => r.orden === Number(button.dataset.order));
      if (!r) break;
      dialog('No disponible', `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div>`);
      break;
    }
    case 'role': {
      const choosingState=state;
      stopPolling();
      visualBusy=true;
      try { await chooseRole(button); } finally { visualBusy=false; schedulePoll(); }
      if(state!==choosingState) break;
      selectedRole = state.seleccion.find(r => r.indice === index);
      dialog('Representa a tu academia', `<div class="role-confirm">${roleCard(selectedRole,{command:'noop',selected:true})}<div><span class="eyebrow">ORDEN DE TURNO ${selectedRole.orden}</span><h2>${esc(selectedRole.nombre)}</h2><p>${esc(selectedRole.habilidad)}</p><div class="dialog-buttons"><button class="gold-button" data-command="confirm-role">Confirmar elección</button><button class="plain-button" data-command="back-roles">Volver a los personajes</button></div></div></div>`);
      break;
    }
    case 'back-roles': phaseDialog(state); break;
    case 'confirm-role': if (selectedRole && state.seleccion.some(r => r.indice === selectedRole.indice && r.nombre === selectedRole.nombre)) act('SELECCIONAR',{indice:selectedRole.indice}); break;
    case 'veto-choice': {
      const choosingState=state, option=pendingAction.opciones[index];
      stopPolling(); visualBusy=true;
      const modal=document.getElementById('modal'); modal.dataset.locked='true';
      try { await chooseVeto(button); }
      finally { visualBusy=false; modal.dataset.locked='false'; }
      if (state===choosingState) await act('HABILIDAD',{objetivo:option.objetivo});
      else schedulePoll();
      break;
    }
    case 'target': confirmTarget(index); break;
    case 'back-targets': if (pendingAction) chooseAction(pendingAction.id); break;
    case 'confirm-target': {
      const option = pendingAction?.opciones[selectedTarget];
      if (!option) break;
      const payload = {}; if (option.indice !== undefined) payload.indice = option.indice; if (option.objetivo !== undefined) payload.objetivo = option.objetivo;
      act(pendingAction.id,payload); break;
    }
    case 'inspect': inspect(state.mano.find(c => c.indice === index)); break;
    case 'start-choice': inspect(state.mano.find(c => c.indice === index)); break;
    case 'start': act('INICIAR',{indice:index}); break;
    case 'work': act('TRABAJAR',{indice:index}); break;
    case 'study': case 'public-study': {
      const p = state.jugadores.find(p => p.nombre === button.dataset.player);
      const study = p.estudios.find(s => s.indice === index); inspect(study.carta,study,p.nombre); break;
    }
    case 'rival': {
      const p = state.jugadores.find(p => p.nombre === button.dataset.player);
      dialog(`Academia de ${p.nombre}`, `<div class="rival-details"><p>${p.monedas} monedas · ${p.prestigio} prestigio · ${p.cartas} ideas en mano</p>${studies(p,false).replace('Mis estudios','Estudios públicos')}</div>`, {kind:'info',snapshot:true}); break;
    }
    case 'ability-detail': {
      const r = state.jugadores.find(p => p.nombre === state.yo).rol;
      dialog(r.nombre, `<div class="role-confirm">${roleCard(r,{command:'noop'})}<div><h2>${esc(r.nombre)}</h2><p>${esc(r.habilidad)}</p></div></div>`, {kind:'info',snapshot:true}); break;
    }
    case 'history': dialog('Crónica de la mesa', `<ol class="chronicle">${state.eventos.map(event => `<li class="${event.publicacion ? 'publication' : ''}">${esc(event.texto)}</li>`).join('') || '<li>La academia acaba de abrir sus puertas.</li>'}</ol>`, {kind:'info',snapshot:true}); break;
  }
});

async function boot() {
  if(api.matchIdentity?.()) {openMatchmaking();return;}
  if (!api.identity()) { home(); return; }
  screen='connecting';
  try {
    const next=await api.state();
    connectionStatus();
    await renderRoom(next,true);
  }
  catch (error) {
    handleError(error);
    if (screen!=='home') app.innerHTML='<div class="connection-error"><h1>Recuperando tu academia</h1><p>Volveremos a conectar automáticamente.</p><button class="text-button" data-command="home">Volver al inicio</button></div>';
  } finally { schedulePoll(); }
}
document.addEventListener('tesis:account-return',()=>{
  if(state && !document.getElementById('modal').open && ['SELECCION_ROLES','FIN_RONDA','FIN_PARTIDA'].includes(state.fase))phaseDialog(state);
});
initAccountPanel();
startPresence(accounts);
boot();
