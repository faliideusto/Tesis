import {accounts} from './auth.js';
import {esc} from './dom.js';
import {RANKS, progression, badge} from './profile-ranks.js';
import {academyTabs,mountCommunity} from './community-panel.js';
import {mountCustomization} from './profile-customization.js';

export function progressText(progress) {
  switch(progress?.estado) {
    case 'INVITADO': return 'Como invitado · esta partida no acumula experiencia.';
    case 'VINCULADA': return 'Cuenta vinculada · tu progreso se guardará al terminar.';
    case 'PENDIENTE': return 'Guardando experiencia… Si el servidor reinicia antes de guardarla, puede perderse.';
    case 'CONFIRMADA': return `Progreso guardado · +${Number(progress.xp) || 0} XP.`;
    case 'ERROR': return 'No se pudo guardar el progreso. Contacta con quien administra Tesis; no se garantiza recuperar esta recompensa.';
    default: return '';
  }
}
const closeButton=()=>'<nav class="academy-navigation" aria-label="Navegación de tu academia"><button type="button" class="account-close"><span aria-hidden="true">←</span> Volver al juego</button><span class="academy-wordmark">TESIS <small>LA ACADEMIA</small></span><span class="academy-section-label">MI PERFIL</span></nav>';
function unavailableView() {
  return `<div class="academy-unavailable">${closeButton()}<header class="academy-welcome"><span class="eyebrow">TU HISTORIA EN LA ACADEMIA</span><h2 id="account-title">Mi perfil</h2><p>Cada partida es una nueva página.<br>Un perfil conserva la historia de tu investigador.</p></header><section class="account-availability" aria-labelledby="availability-title"><span class="availability-icon" aria-hidden="true">◇</span><div><h3 id="availability-title">Las cuentas no están habilitadas en este servidor</h3><p>Iniciar sesión y crear una cuenta no están disponibles aquí. Puedes seguir jugando como invitado; tus partidas no acumularán experiencia.</p></div><button class="plain-button" disabled>Iniciar sesión · no disponible</button></section><section class="academy-benefits" aria-label="Qué ofrece un perfil"><article><span aria-hidden="true">01</span><h3>Tu identidad</h3><p>Un nombre propio y una distinción que cuentan tu trayectoria.</p></article><article><span aria-hidden="true">02</span><h3>Tu progreso</h3><p>200 XP por terminar una partida y 100 XP adicionales por ganar, también en empate.</p></article><article><span aria-hidden="true">03</span><h3>Tu legado</h3><p>Partidas, victorias y siete rangos visuales. Sin ventajas durante el juego.</p></article></section><section class="rank-journey academy-rank-gallery" aria-label="Rangos disponibles cuando las cuentas estén habilitadas"><div class="journey-heading"><div><span class="eyebrow">SIETE DISTINCIONES, UNA TRAYECTORIA</span><h3>El camino de la academia</h3></div><span class="cosmetic-note">Vista del catálogo · no tienes un rango asignado</span></div><ol class="rank-path">${RANKS.map(rank=>`<li class="rank-step catalog-rank">${badge(rank.id,{small:true})}<strong>${esc(rank.name)}</strong><span>DESDE NIVEL ${rank.start}</span></li>`).join('')}</ol></section><button type="button" class="gold-button unavailable-return" id="account-dismiss">Volver a la mesa <span aria-hidden="true">→</span></button><p id="account-message" class="account-message" role="status"></p></div>`;
}
const frameCorners=()=>'<span class="frame-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const academicSprig=()=>'<svg class="academic-sprig" viewBox="0 0 30 42" aria-hidden="true"><g fill="currentColor"><path d="M15 38V13h1v25ZM14 25C5 25 4 19 3 17c7 0 10 3 11 8Zm0 8C5 32 3 27 2 25c7 0 11 3 12 8Zm0-13C8 16 9 11 10 9c4 3 5 6 4 11Zm3 5c9 0 10-6 11-8-7 0-10 3-11 8Zm0 8c9-1 11-6 12-8-7 0-11 3-12 8Zm0-13c6-4 5-9 4-11-4 3-5 6-4 11ZM15 1C8 8 9 11 15 16 21 11 22 8 15 1Z"/></g><path d="M15 5v8M11 35l4 5 5-5" fill="none" stroke="currentColor"/></svg>';
const emblemLaurels=()=>{
  const leaves=Array.from({length:8},(_,i)=>{
    const theta=(-125-i*11)*Math.PI/180,x=175+116*Math.cos(theta),y=137-116*Math.sin(theta);
    return `<path d="M ${x} ${y} q -24 -9 -17 -32 q 23 7 17 32 Z" transform="rotate(${-60+i*12.5} ${x} ${y})"/>`;
  }).join('');
  return `<svg class="emblem-laurels" viewBox="0 0 350 260" aria-hidden="true"><g fill="currentColor">${leaves}<g transform="translate(350 0) scale(-1 1)">${leaves}</g></g><path d="M95 236Q22 176 68 80M255 236q73-60 27-156" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
};
export function profileView(profile) {
  const p=progression(profile),played=Math.max(0,Number(profile.partidasTerminadas)||0),wins=Math.max(0,Number(profile.victorias)||0);
  return `<div class="profile-shell tier-${p.rank.id}">${closeButton()}
    <h2 id="account-title" class="sr-only">Mi perfil</h2>
    <div class="profile-main"><nav class="customization-view-tabs" aria-label="Vista del perfil"><span aria-current="page">Resumen</span><button type="button" data-customize>✒ Personalización</button></nav><section class="profile-identity" aria-label="Tu rango actual">${frameCorners()}<span class="researcher-card-label">CARNET DE INVESTIGADOR</span><div class="profile-emblem">${emblemLaurels()}${badge(p.rank.id)}<span class="emblem-level">NIVEL <b>${esc(p.level)}</b></span></div><span class="rank-kicker">${esc(p.rank.title)}</span><h3>${esc(profile.nombre)}</h3><span class="identity-divider" aria-hidden="true">◇</span><span class="rank-name">${esc(p.rank.name)}</span><p class="rank-description">${esc(p.rank.description)}</p><span class="researcher-card-signature">TESIS · MIEMBRO DE LA ACADEMIA</span></section>
    <section class="profile-record" aria-label="Progresión y estadísticas">${frameCorners()}<div class="profile-progress"><div class="profile-record-heading"><div class="profile-section-label">${academicSprig()}<span>PROGRESIÓN DE NIVEL</span></div></div><div class="xp-headline"><strong>${esc(p.inLevel)} <small>/ 500 XP</small></strong><div class="xp-next"><span>NIVEL ${esc(p.level)} → ${esc(p.level+1)}</span><span>${esc(p.toNextLevel)} XP para el siguiente nivel</span></div></div><div class="xp-track" role="progressbar" aria-label="Progreso al siguiente nivel" aria-valuemin="0" aria-valuemax="500" aria-valuenow="${p.inLevel}" aria-valuetext="${p.inLevel} de 500 XP"><span style="width:${p.percent}%"></span></div><p class="xp-total">${esc(p.xp)} XP acumulada <span>·</span> Tu legado sigue creciendo</p></div>
    <div class="profile-stat-grid"><div>${frameCorners()}<span class="stat-glyph" aria-hidden="true">▤</span><strong>${esc(played)}</strong><span>Partidas terminadas</span></div><div>${frameCorners()}<span class="stat-glyph" aria-hidden="true">♛</span><strong>${esc(wins)}</strong><span>Victorias</span></div><div>${frameCorners()}<span class="stat-glyph" aria-hidden="true">✦</span><strong>${played?Math.round(wins/played*100):0}<small>%</small></strong><span>Porcentaje de victorias</span></div></div>
    <div class="next-rank-card">${frameCorners()}${p.nextRank?`${badge(p.nextRank.id,{small:true})}<div><span>EL SIGUIENTE HORIZONTE</span><strong>${esc(p.nextRank.name)}</strong><p>Nivel ${p.nextRank.start} · ${Math.max(0,(p.nextRank.start-1)*500-p.xp)} XP por recorrer</p></div>`:`${badge('eterno',{small:true})}<div><span>EL MAYOR HONOR DE LA ACADEMIA</span><strong>Un legado eterno</strong><p>Has alcanzado el último rango. Tus niveles continúan.</p></div>`}</div></section></div>
    <section class="rank-journey" aria-label="Ruta de rangos">${frameCorners()}<div class="journey-heading">${academicSprig()}<div><span class="eyebrow">DE LA PRIMERA IDEA AL LEGADO</span><h3>Tu camino en Tesis</h3></div><span class="cosmetic-note">Prestigio visual. Sin ventajas en partida.</span></div><ol class="rank-path">${RANKS.map((rank,i)=>`<li class="rank-step ${i<p.index?'achieved':i===p.index?'current':i===p.index+1?'locked next':'locked'}" ${i===p.index?'aria-current="step"':''} title="${esc(rank.name)} · nivel ${rank.start}">${badge(rank.id,{small:true})}<div class="rank-plaque"><strong>${esc(rank.name)}</strong><span>NIV. ${rank.start}${i===p.index?' · ACTUAL':i<p.index?' · ✓':''}</span></div>${i===p.index+1?'<span class="next-rank-ribbon">SIGUIENTE</span>':''}</li>`).join('')}</ol></section>
    <footer class="profile-footer"><p class="profile-community-notice">Tu nombre visible y tus estadísticas aparecen para otras cuentas en el ranking global.</p><p class="profile-xp-notice">+200 XP por terminar <span>·</span> +100 XP por ganar, también en empate</p><div><button type="button" class="account-link" id="account-edit" aria-expanded="false">Editar nombre</button><button type="button" class="account-link" id="account-refresh">Actualizar</button><button type="button" class="account-link logout" id="account-logout">Cerrar sesión</button></div></footer>
    <form id="account-rename" class="profile-name-editor" hidden><label>Nombre visible<input name="nombre" value="${esc(profile.nombre)}" maxlength="24" required autocomplete="nickname"></label><button class="gold-button">Guardar nombre</button><p>Tu asiento actual mantiene su nombre.</p></form><p id="account-message" class="account-message" role="status"></p></div>`;
}
function authView(mode) {
  const register=mode==='register';
  return `<div class="account-auth-shell">${closeButton()}<section class="auth-art"><span class="eyebrow">TU HISTORIA EN LA ACADEMIA</span><h2>Las partidas pasan.<br><em>Tu legado permanece.</em></h2><p>Entra en tu perfil para conservar tus logros y escribir la siguiente página.</p><div class="auth-featured-badge">${badge('oro')}<span>SIETE RANGOS POR DESCUBRIR</span></div><div class="auth-rank-preview">${badge('madera',{small:true})}<span>✦</span>${badge('diamante',{small:true})}<span>✦</span>${badge('eterno',{small:true})}</div><div class="auth-benefit-line"><span>Tu investigador</span><span>Tus victorias</span><span>Tu progreso</span></div></section><section class="auth-form-panel"><span class="eyebrow">MI PERFIL · TESIS</span><h2 id="account-title">${register?'Comienza tu legado':'Bienvenido de nuevo.'}</h2><p class="auth-intro">${register?'Crea tu cuenta y conserva cada paso de tu progreso.':'Inicia sesión y continúa tu trayectoria en la academia.'}</p><div class="auth-tabs" aria-label="Acceso de cuenta"><button type="button" data-auth-mode="login" aria-pressed="${!register}">Iniciar sesión</button><button type="button" id="account-switch" data-auth-mode="register" aria-pressed="${register}">Crear cuenta</button></div>
    <form id="account-${mode}">${register?'<label>Nombre de tu investigador<input name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Así te conocerá la academia"></label>':''}<label>Correo electrónico<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.com"></label><label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="${register?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"></label><button class="gold-button">${register?'Crear mi academia':'Entrar en Tesis'} <span aria-hidden="true">→</span></button></form><p id="account-message" class="account-message" role="status"></p><button type="button" class="account-link auth-guest" id="account-dismiss">Seguir jugando como invitado</button><p class="auth-fine-print">No verificamos el correo. Sin recuperación pública por email: conserva tu contraseña. Entrar como invitado no acumula XP en esa partida.</p></section></div>`;
}
function disconnectedView() {
  return `<div class="account-empty-shell">${closeButton()}${badge('madera')}<span class="eyebrow">VOLVEREMOS A ENCONTRARNOS</span><h2 id="account-title">La academia está desconectada</h2><p>Recarga para volver a conectar con tu cuenta.</p><p>Continuar como invitado cierra tu cuenta en esta pestaña. Tu sala actual conserva su identidad; las nuevas salas no acumularán XP.</p><button type="button" class="gold-button" id="account-guest">Continuar como invitado</button></div>`;
}
export function initAccountPanel() {
  const panel=document.getElementById('account-panel'),opener=document.getElementById('account-open');
  let mode='login',working=false,loginIdentityPending=false,lastView='',restoring=true,connectionFailed=false,returnFocus=null,returnScroll=0,operation=0;
  let academyPage='profile',community=null,lastIdentity=accounts.identity();
  const routes={'#perfil':'profile','#amigos':'friends','#ranking':'ranking','#misiones':'missions','#personalizacion':'customization'};
  const hashes=Object.fromEntries(Object.entries(routes).map(([hash,page])=>[page,hash]));
  const labels={profile:'Mi perfil',friends:'Amigos',ranking:'Ranking global',missions:'Misiones',customization:'Personalización'};
  const app=document.getElementById('app');
  function leave() {
    operation++;working=false;panel.removeAttribute('aria-busy');
    community?.destroy();community=null;lastView='';
    panel.hidden=true;app.inert=false;app.hidden=false;document.body.classList.remove('account-page-active');
    document.title='Tesis · La mesa del conocimiento';
    window.scrollTo(0,returnScroll);
    (returnFocus?.isConnected&&returnFocus!==document.body?returnFocus:opener).focus({preventScroll:true});
    document.dispatchEvent(new Event('tesis:account-return'));
  }
  function enter() {
    if(!panel.hidden){draw(true);return;}
    returnFocus=document.activeElement;returnScroll=window.scrollY;
    panel.hidden=false;app.inert=true;app.hidden=true;document.body.classList.add('account-page-active');
    document.title='Mi academia · Tesis';window.scrollTo(0,0);draw(true);panel.focus();
    if(accounts.signedIn())void perform(()=>accounts.refreshProfile());
  }
  function openPage(page='profile',source=opener) {
    if(!hashes[page])return;
    if(academyPage!==page){operation++;working=false;panel.removeAttribute('aria-busy');}
    if(panel.hidden) {
      returnFocus=source;
      if(location.hash!==hashes[page])history.pushState({...history.state,tesisAcademyReturn:location.pathname+location.search+location.hash},'',hashes[page]);
    } else if(location.hash!==hashes[page])history.replaceState(history.state,'',hashes[page]);
    academyPage=page;
    enter();
    returnFocus=source;
  }
  function closePage() {
    if(history.state?.tesisAcademyReturn&&routes[location.hash])history.back();
    else {history.replaceState(null,'',location.pathname+location.search);leave();}
  }
  function followLocation(){
    const page=routes[location.hash];
    if(page){if(!panel.hidden&&academyPage===page)return;operation++;working=false;panel.removeAttribute('aria-busy');academyPage=page;enter();}
    else if(!panel.hidden)leave();
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    const page=routes[link?.getAttribute('href')];
    if(!page||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();openPage(page,link);
  });
  window.addEventListener('popstate',followLocation);window.addEventListener('hashchange',followLocation);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closePage();}});
  function draw(force=false) {
    opener.hidden=false;
    const profile=accounts.profile();
    const identity=accounts.identity();
    if(identity!==lastIdentity){
      const completingLogin=working&&loginIdentityPending&&!lastIdentity&&identity;
      lastIdentity=identity;loginIdentityPending=false;
      if(!completingLogin){operation++;working=false;panel.removeAttribute('aria-busy');}
      community?.destroy();community=null;lastView='';
    }
    if(accounts.signedIn()) {
      const p=progression(profile||{});opener.classList.add('has-profile');
      opener.dataset.rank=p.rank.id;
      opener.innerHTML=`<span class="account-trigger-monogram" aria-hidden="true">${esc(Array.from(profile?.nombre||'T')[0].toUpperCase())}<span>${p.level}</span></span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>${esc(profile?.nombre||'Mi academia')} <span>·</span> ${esc(p.rank.name)}</small></span><span class="account-chevron" aria-hidden="true">↗</span>`;
      opener.setAttribute('aria-label',profile?`Mi perfil, ${p.rank.name}, nivel ${p.level}`:'Mi perfil');
    } else {
      opener.classList.remove('has-profile');delete opener.dataset.rank;opener.innerHTML='<span class="account-trigger-monogram guest-monogram" aria-hidden="true">T</span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>Iniciar sesión</small></span><span class="account-chevron" aria-hidden="true">↗</span>';opener.setAttribute('aria-label','Mi perfil · Iniciar sesión');
    }
    if(connectionFailed)opener.innerHTML='<span class="account-trigger-monogram guest-monogram" aria-hidden="true">T</span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>Conexión pendiente</small></span>';
    if(panel.hidden||working)return;
    panel.dataset.page=academyPage;
    document.title=`${labels[academyPage]} · Tesis`;
    // Una recompensa/renovación en segundo plano no debe borrar el alias en edición.
    if(!force&&accounts.signedIn()&&profile&&panel.querySelector('#account-rename:not([hidden])'))return;
    const unavailable=!accounts.enabled()&&!restoring;
    const view=connectionFailed?'disconnected':accounts.signedIn()?`${academyPage}:${academyPage==='profile'||!profile?JSON.stringify(profile):identity}`:unavailable?'unavailable':mode;
    if(!force&&lastView===view)return;lastView=view;
    community?.destroy();community=null;
    if(connectionFailed){
      panel.innerHTML=disconnectedView();panel.dataset.view='auth';panel.setAttribute('aria-labelledby','account-title');
      panel.querySelector('.account-close').onclick=closePage;
      panel.querySelector('#account-guest').onclick=()=>{accounts.forgetStoredSession();globalThis.location.reload();};
      panel.querySelector('.account-close').focus();return;
    }
    if(accounts.signedIn()&&profile)panel.innerHTML=profileView(profile);
    else if(accounts.signedIn())panel.innerHTML=`<div class="account-empty-shell">${closeButton()}${badge('madera')}<span class="eyebrow">TU ACADEMIA</span><h2 id="account-title">Preparando tu perfil</h2><p>Conectando con tu legado…</p><p id="account-message" class="account-message" role="status"></p><button type="button" class="account-link" id="account-refresh">Volver a intentar</button><button type="button" class="account-link" id="account-logout">Cerrar sesión</button></div>`;
    else panel.innerHTML=unavailable?unavailableView():authView(mode);
    if(accounts.signedIn()&&profile) {
      const navigation=panel.querySelector('.academy-navigation');
      navigation.insertAdjacentHTML('afterend',academyTabs(academyPage==='customization'?'profile':academyPage));
      if(academyPage!=='profile') {
        const shell=panel.querySelector('.profile-shell');
        Array.from(shell.children).forEach(child=>{if(!child.matches('.academy-navigation,.community-tabs'))child.hidden=true;});
        if(academyPage==='customization') {
          shell.insertAdjacentHTML('beforeend','<section class="customization-root" aria-labelledby="customization-title"></section>');
          panel.setAttribute('aria-labelledby','customization-title');
          community=mountCustomization(panel.querySelector('.customization-root'),{accounts,profile,onSummary:()=>openPage('profile',returnFocus)});
        } else {
          shell.insertAdjacentHTML('beforeend','<h2 id="community-title" class="sr-only">Mi academia</h2><section class="community-panel" aria-labelledby="community-title"></section>');
          panel.setAttribute('aria-labelledby','community-title');
          community=mountCommunity(panel.querySelector('.community-panel'),{accounts,page:academyPage,onReward:()=>{void accounts.refreshProfile().catch(()=>{});}});
        }
      } else {
        panel.setAttribute('aria-labelledby','account-title');
      }
      panel.querySelectorAll('[data-academy-page]').forEach(button=>button.onclick=()=>{openPage(button.dataset.academyPage,returnFocus);panel.querySelector(`[data-academy-page="${academyPage}"]`)?.focus();});
    } else panel.setAttribute('aria-labelledby','account-title');
    panel.dataset.view=accounts.signedIn()?'profile':unavailable?'unavailable':'auth';
    const sectionLabel=panel.querySelector('.academy-section-label');
    if(sectionLabel)sectionLabel.textContent=labels[academyPage].toLocaleUpperCase('es-ES');
    panel.querySelector('.account-close').onclick=closePage;
    panel.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.authMode;draw(true);});
    const dismiss=panel.querySelector('#account-dismiss');if(dismiss)dismiss.onclick=closePage;
    const customize=panel.querySelector('[data-customize]');if(customize)customize.onclick=()=>{openPage('customization',returnFocus);panel.querySelector('#customization-title')?.focus();};
    const edit=panel.querySelector('#account-edit');if(edit)edit.onclick=()=>{const form=panel.querySelector('#account-rename');form.hidden=!form.hidden;edit.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)form.querySelector('input').focus();};
    const refresh=panel.querySelector('#account-refresh');if(refresh)refresh.onclick=()=>perform(()=>accounts.refreshProfile());
    const logout=panel.querySelector('#account-logout');if(logout)logout.onclick=()=>perform(()=>accounts.logout());
    if(!panel.contains(document.activeElement))panel.querySelector('input,.account-close')?.focus();
  }
  async function perform(task,{login=false}={}) {
    if(working)return;working=true;loginIdentityPending=login;const current=++operation;panel.setAttribute('aria-busy','true');
    const controls=Array.from(panel.querySelectorAll('button,input'));controls.forEach(el=>{if(!el.classList.contains('account-close'))el.disabled=true;});
    const messageNode=panel.querySelector('#account-message');if(messageNode)messageNode.textContent='Conectando…';
    let message='',success=false;
    try {const result=await task();message=typeof result==='string'?result:'';success=true;}
    catch(error){message=error.message||'No se pudo completar la operación.';}
    finally {if(current===operation){working=false;loginIdentityPending=false;panel.removeAttribute('aria-busy');controls.forEach(el=>el.disabled=false);draw(success);const target=panel.querySelector('#account-message');if(target)target.textContent=message;}}
  }
  panel.addEventListener('submit',event=>{
    if(!event.target.id.startsWith('account-'))return;
    event.preventDefault();const form=event.target,fields=new FormData(form);
    void perform(async()=>{
      if(form.id==='account-rename'){await accounts.rename(String(fields.get('nombre')).trim());return 'Nombre guardado. Tu asiento actual mantiene su nombre.';}
      const email=String(fields.get('email')).trim(),password=String(fields.get('password'));
      if(mode==='register'){const active=await accounts.register(email,password,String(fields.get('nombre')).trim());if(!active)return 'Cuenta creada sin sesión. Revisa la confirmación de correo del proyecto.';}
      else await accounts.login(email,password);
      try{await accounts.refreshProfile();}catch{return 'Sesión iniciada. No se pudo cargar tu perfil; pulsa Volver a intentar.';}
    },{login:form.id!=='account-rename'});
  });
  opener.onclick=()=>openPage('profile');
  accounts.onChange(()=>draw());draw();
  void accounts.initialize().then(()=>{restoring=false;draw();if(accounts.signedIn())void accounts.refreshProfile().catch(()=>{});}).catch(()=>{
    restoring=false;connectionFailed=true;draw(true);
  });
  followLocation();
}
