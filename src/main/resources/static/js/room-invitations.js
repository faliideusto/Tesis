import {esc} from './dom.js';
import {badge,progression} from './profile-ranks.js';
import {createPublicProfile} from './public-profile.js';

export function onlineFriends(data) {
  return data?.presenciaDisponible===true?(data.amigos||[]).filter(person=>person.enLinea===true):[];
}
export function roomFriendsView(data,{expanded=false,loading=false,error='',statuses={}}={}) {
  return `<div class="room-invite-heading"><div><span>INVESTIGAR EN COMPAÑÍA</span><h3>Tu círculo en esta sala</h3></div><button type="button" data-room-invite-toggle>${expanded?'Ocultar amigos':'Invitar amigos'}</button></div>${expanded?`<div class="room-invite-body"><button type="button" data-room-invite-refresh ${loading?'disabled':''}>Actualizar</button>${loading?'<p role="status">Buscando amigos en línea…</p>':error?`<p role="status">${esc(error)}</p>`:data?.presenciaDisponible!==true?'<p>La presencia de tus amigos no está disponible en este servidor.</p>':onlineFriends(data).length?`<ul>${onlineFriends(data).map(person=>`<li><button type="button" class="room-invite-person" data-public-profile="${esc(person.codigo)}" aria-label="Ver perfil de ${esc(person.nombre)}">${badge(progression({nivel:person.nivel}).rank.id,{small:true})}<span><strong>${esc(person.nombre)}</strong><small>En línea · Nivel ${esc(person.nivel)}</small></span></button><div><button type="button" data-room-invite-send="${esc(person.codigo)}" ${statuses[person.codigo]?.busy?'disabled':''}>${statuses[person.codigo]?.busy?'Enviando…':'Invitar'}</button>${statuses[person.codigo]?.message?`<p role="status">${esc(statuses[person.codigo].message)}</p>`:''}</div></li>`).join('')}</ul>`:'<p>No tienes amigos en línea ahora. Actualiza cuando se conecten.</p>'}</div>`:''}`;
}
export function invitationInboxView(items,busyId='',status='') {
  return `${items.length?`<h3>Te esperan en la Academia</h3><ul>${items.map(item=>`<li><p><strong>${esc(item.nombreAnfitrion)}</strong> te invita a una partida.<span>Sala ${esc(item.codigoSala)}</span></p><div><button type="button" data-room-invitation-accept="${esc(item.id)}" ${busyId?'disabled':''}>Aceptar</button><button type="button" data-room-invitation-reject="${esc(item.id)}" ${busyId?'disabled':''}>Rechazar</button></div></li>`).join('')}</ul>`:''}${status?`<p class="room-inbox-status" role="status">${esc(status)}</p>`:''}`;
}

export function createRoomInvitations({accounts,api,onAccept,getRoom=()=>null,document=globalThis.document,schedule=setTimeout,cancel=clearTimeout}={}) {
  let alive=true,identity=null,generation=0,timer=null,inboxReading=false,lobbyReading=false,inboxBusy='',lobbyData=null,expanded=false,loading=false,lobbyError='',roomCode='',statuses={},invitations=[],inboxStatus='',inbox=null,profile=null,profileRoot=null;
  const signed=()=>Boolean(accounts.signedIn());
  const actor=()=>signed()?accounts.identity():null;
  const valid=(current,who)=>alive&&generation===current&&actor()===who&&who!==null;
  function syncIdentity() {
    const next=actor();if(next===identity)return;
    identity=next;++generation;invitations=[];inboxStatus='';statuses={};lobbyData=null;lobbyError='';expanded=false;
    profile?.destroy();profile=null;profileRoot=null;renderInbox();renderLobby();
  }
  const slot=()=>document?.querySelector('[data-room-invitations]');
  const eligible=()=>{const room=getRoom();return signed()&&room?.fase==='LOBBY'&&room.soyAnfitrion;};
  function renderInbox() {
    if(!document?.body)return;
    if(!inbox){inbox=document.createElement('aside');inbox.className='room-invitation-inbox';inbox.setAttribute('aria-label','Invitaciones a partidas');inbox.setAttribute('aria-live','polite');document.body.append(inbox);inbox.addEventListener('click',inboxClick);}
    inbox.hidden=!signed()||(!invitations.length&&!inboxStatus);
    const html=invitationInboxView(invitations,inboxBusy,inboxStatus);if(inbox.innerHTML!==html)inbox.innerHTML=html;
  }
  function renderLobby() {
    const node=slot();if(!node)return;
    node.hidden=!eligible();if(node.hidden)return;
    const html=roomFriendsView(lobbyData,{expanded,loading,error:lobbyError,statuses});if(node.innerHTML!==html)node.innerHTML=html;
  }
  async function readLobby() {
    syncIdentity();if(!alive||!eligible()||lobbyReading)return;
    lobbyReading=true;loading=true;lobbyError='';renderLobby();const current=generation,who=identity,currentRoom=roomCode;
    try {const value=await accounts.community();if(valid(current,who)&&eligible()&&roomCode===currentRoom)lobbyData=value;}
    catch(error){if(valid(current,who)&&roomCode===currentRoom)lobbyError=error.message||'No se pudieron cargar tus amigos.';}
    finally {lobbyReading=false;loading=false;if(alive)renderLobby();}
  }
  async function lobbyClick(event) {
    const button=event.target.closest('button'),node=slot();if(!button||!node?.contains(button)||button.disabled)return;
    syncIdentity();if(!eligible())return;
    if(button.hasAttribute('data-room-invite-toggle')){expanded=!expanded;renderLobby();if(expanded)void readLobby();return;}
    if(button.hasAttribute('data-room-invite-refresh')){void readLobby();return;}
    if(button.hasAttribute('data-public-profile')){
      if(!profile){profile=createPublicProfile(node,{accounts});profileRoot=node;}profile.open(button.dataset.publicProfile,button);return;
    }
    const code=button.dataset.roomInviteSend;if(!code||statuses[code]?.busy)return;
    const current=generation,who=identity,currentRoom=roomCode;statuses[code]={busy:true,message:''};renderLobby();
    try {await api.inviteFriend(code);if(valid(current,who)&&roomCode===currentRoom)statuses[code]={busy:false,message:'Invitación enviada.'};}
    catch(error){if(valid(current,who)&&roomCode===currentRoom)statuses[code]={busy:false,message:error.message||'No se pudo enviar. Actualiza antes de repetir.'};}
    finally {if(alive)renderLobby();}
  }
  async function inboxClick(event) {
    const button=event.target.closest('button');if(!button||button.disabled||inboxBusy)return;
    syncIdentity();const accept=button.dataset.roomInvitationAccept,id=accept||button.dataset.roomInvitationReject;if(!id||!identity)return;
    const current=generation,who=identity;inboxBusy=id;inboxStatus='';renderInbox();
    inbox?.setAttribute('tabindex','-1');inbox?.focus({preventScroll:true});
    try {
      const result=accept?await onAccept(id):await accounts.rejectInvitation(id);
      if(!valid(current,who))return;
      if(result!==false)invitations=invitations.filter(item=>item.id!==id);
    } catch(error){if(valid(current,who))inboxStatus=error.message||'No se pudo completar. Actualiza antes de repetir.';}
    finally {
      inboxBusy='';if(alive){renderInbox();if(valid(current,who)&&!inbox?.hidden&&document?.activeElement===inbox)inbox.querySelector('button')?.focus({preventScroll:true});}
    }
  }
  async function refreshInbox() {
    syncIdentity();if(!alive||!identity||inboxReading||inboxBusy||document?.visibilityState==='hidden')return;
    inboxReading=true;const current=generation,who=identity;
    try {const data=await accounts.invitations();if(valid(current,who)&&!inboxBusy){invitations=data.invitaciones||[];renderInbox();}}
    catch { /* Preserve actionable invitations and mutation feedback until the next read. */ }
    finally {inboxReading=false;}
  }
  async function tick(){try{await refreshInbox();}finally{if(alive)timer=schedule(tick,5000);}}
  const delegated=event=>void lobbyClick(event);
  const visible=()=>{if(document?.visibilityState!=='hidden')void refreshInbox();};
  const refreshLobby=()=>{
    syncIdentity();const next=eligible()?getRoom().codigo:'',node=slot();
    if(profile&&(profileRoot!==node||!eligible())){profile.destroy();profile=null;profileRoot=null;}
    if(next!==roomCode){roomCode=next;++generation;statuses={};lobbyData=null;expanded=false;profile?.destroy();profile=null;profileRoot=null;}
    renderLobby();
  };
  const unsubscribe=accounts.onChange?.(()=>{syncIdentity();refreshLobby();void refreshInbox();});
  document?.addEventListener?.('click',delegated);
  document?.addEventListener?.('visibilitychange',visible);
  timer=schedule(tick,0);
  return {
    refreshInbox,
    refreshLobby,
    destroy(){alive=false;++generation;cancel(timer);unsubscribe?.();profile?.destroy();document?.removeEventListener?.('click',delegated);document?.removeEventListener?.('visibilitychange',visible);inbox?.remove();}
  };
}
