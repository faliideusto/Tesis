import {accounts} from './auth.js';
import {esc} from './dom.js';
import {RANKS, progression, badge} from './profile-ranks.js';

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
  return `<div class="academy-unavailable">${closeButton()}<header class="academy-welcome"><span class="eyebrow">TU HISTORIA EN LA ACADEMIA</span><h2 id="account-title">Mi perfil</h2><p>Cada partida es una nueva página.<br>Un perfil conserva la historia de tu investigador.</p></header><section class="account-availability" aria-labelledby="availability-title"><span class="availability-icon" aria-hidden="true">◇</span><div><h3 id="availability-title">Las cuentas no están habilitadas en este servidor</h3><p>Iniciar sesión y crear una cuenta no están disponibles aquí. Puedes seguir jugando como invitado; tus partidas no acumularán experiencia.</p></div><button class="plain-button" disabled>Iniciar sesión · no disponible</button></section><section class="academy-benefits" aria-label="Qué ofrece un perfil"><article><span aria-hidden="true">01</span><h3>Tu identidad</h3><p>Un nombre propio y una distinción que cuentan tu trayectoria.</p></article><article><span aria-hidden="true">02</span><h3>Tu progreso</h3><p>100 XP por terminar una partida y 50 XP adicionales por ganar, también en empate.</p></article><article><span aria-hidden="true">03</span><h3>Tu legado</h3><p>Partidas, victorias y siete rangos visuales. Sin ventajas durante el juego.</p></article></section><section class="rank-journey academy-rank-gallery" aria-label="Rangos disponibles cuando las cuentas estén habilitadas"><div class="journey-heading"><div><span class="eyebrow">SIETE DISTINCIONES, UNA TRAYECTORIA</span><h3>El camino de la academia</h3></div><span class="cosmetic-note">Vista del catálogo · no tienes un rango asignado</span></div><ol class="rank-path">${RANKS.map(rank=>`<li class="rank-step catalog-rank">${badge(rank.id,{small:true})}<strong>${esc(rank.name)}</strong><span>DESDE NIVEL ${rank.start}</span></li>`).join('')}</ol></section><button type="button" class="gold-button unavailable-return" id="account-dismiss">Volver a la mesa <span aria-hidden="true">→</span></button><p id="account-message" class="account-message" role="status"></p></div>`;
}
export function profileView(profile) {
  const p=progression(profile),played=Math.max(0,Number(profile.partidasTerminadas)||0),wins=Math.max(0,Number(profile.victorias)||0);
  return `<div class="profile-shell tier-${p.rank.id}">${closeButton()}
    <header class="profile-heading"><span class="eyebrow">EL LEGADO DE TU ACADEMIA</span><h2 id="account-title">Mi perfil</h2><span class="profile-ornament" aria-hidden="true">✦</span></header>
    <div class="profile-main"><section class="profile-identity" aria-label="Tu rango actual"><span class="researcher-card-label">CARNET DE INVESTIGADOR</span><div class="profile-emblem">${badge(p.rank.id)}<span class="emblem-level">NIVEL <b>${esc(p.level)}</b></span></div><span class="rank-kicker">${esc(p.rank.title)}</span><h3>${esc(profile.nombre)}</h3><span class="rank-name">${esc(p.rank.name)}</span><p class="rank-description">${esc(p.rank.description)}</p><span class="researcher-card-signature">TESIS · MIEMBRO DE LA ACADEMIA</span></section>
    <section class="profile-record" aria-label="Progresión y estadísticas"><div class="profile-section-label"><span>PROGRESIÓN DE NIVEL</span><span>NIVEL ${esc(p.level)} → ${esc(p.level+1)}</span></div><div class="xp-headline"><strong>${esc(p.inLevel)} <small>/ 500 XP</small></strong><span>${esc(p.toNextLevel)} XP para el siguiente nivel</span></div><div class="xp-track" role="progressbar" aria-label="Progreso al siguiente nivel" aria-valuemin="0" aria-valuemax="500" aria-valuenow="${p.inLevel}" aria-valuetext="${p.inLevel} de 500 XP"><span style="width:${p.percent}%"></span></div><p class="xp-total">${esc(p.xp)} XP acumulada <span>·</span> Tu legado sigue creciendo</p>
    <div class="profile-stat-grid"><div><span class="stat-glyph" aria-hidden="true">▤</span><strong>${esc(played)}</strong><span>Partidas terminadas</span></div><div><span class="stat-glyph" aria-hidden="true">♛</span><strong>${esc(wins)}</strong><span>Victorias</span></div><div><span class="stat-glyph" aria-hidden="true">✦</span><strong>${played?Math.round(wins/played*100):0}<small>%</small></strong><span>Porcentaje de victorias</span></div></div>
    <div class="next-rank-card">${p.nextRank?`${badge(p.nextRank.id,{small:true})}<div><span>EL SIGUIENTE HORIZONTE</span><strong>${esc(p.nextRank.name)}</strong><p>Nivel ${p.nextRank.start} · ${Math.max(0,(p.nextRank.start-1)*500-p.xp)} XP por recorrer</p></div>`:`${badge('eterno',{small:true})}<div><span>EL MAYOR HONOR DE LA ACADEMIA</span><strong>Un legado eterno</strong><p>Has alcanzado el último rango. Tus niveles continúan.</p></div>`}</div></section></div>
    <section class="rank-journey" aria-label="Ruta de rangos"><div class="journey-heading"><div><span class="eyebrow">DE LA PRIMERA IDEA AL LEGADO</span><h3>Tu camino en Tesis</h3></div><span class="cosmetic-note">Prestigio visual. Sin ventajas en partida.</span></div><ol class="rank-path">${RANKS.map((rank,i)=>`<li class="rank-step ${i<p.index?'achieved':i===p.index?'current':'locked'}" ${i===p.index?'aria-current="step"':''} title="${esc(rank.name)} · nivel ${rank.start}">${badge(rank.id,{small:true})}<strong>${esc(rank.name)}</strong><span>NIV. ${rank.start}${i===p.index?' · ACTUAL':i<p.index?' · ✓':''}</span></li>`).join('')}</ol></section>
    <footer class="profile-footer"><p>+100 XP por terminar <span>·</span> +50 XP por ganar, también en empate</p><div><button type="button" class="account-link" id="account-edit" aria-expanded="false">Editar nombre</button><button type="button" class="account-link" id="account-refresh">Actualizar</button><button type="button" class="account-link logout" id="account-logout">Cerrar sesión</button></div></footer>
    <form id="account-rename" class="profile-name-editor" hidden><label>Nombre visible<input name="nombre" value="${esc(profile.nombre)}" maxlength="24" required autocomplete="nickname"></label><button class="gold-button">Guardar nombre</button><p>Tu asiento actual mantiene su nombre.</p></form><p id="account-message" class="account-message" role="status"></p></div>`;
}
function authView(mode) {
  const register=mode==='register';
  return `<div class="account-auth-shell">${closeButton()}<section class="auth-art"><span class="eyebrow">TU HISTORIA EN LA ACADEMIA</span><h2>Las partidas pasan.<br><em>Tu legado permanece.</em></h2><p>Entra en tu perfil para conservar tus logros y escribir la siguiente página.</p><div class="auth-featured-badge">${badge('oro')}<span>SIETE RANGOS POR DESCUBRIR</span></div><div class="auth-rank-preview">${badge('madera',{small:true})}<span>✦</span>${badge('diamante',{small:true})}<span>✦</span>${badge('eterno',{small:true})}</div><div class="auth-benefit-line"><span>Tu investigador</span><span>Tus victorias</span><span>Tu progreso</span></div></section><section class="auth-form-panel"><span class="eyebrow">MI PERFIL · TESIS</span><h2 id="account-title">${register?'Comienza tu legado':'Bienvenido de nuevo.'}</h2><p class="auth-intro">${register?'Crea tu cuenta y conserva cada paso de tu progreso.':'Inicia sesión y continúa tu trayectoria en la academia.'}</p><div class="auth-tabs" aria-label="Acceso de cuenta"><button type="button" data-auth-mode="login" aria-pressed="${!register}">Iniciar sesión</button><button type="button" id="account-switch" data-auth-mode="register" aria-pressed="${register}">Crear cuenta</button></div>
    <form id="account-${mode}">${register?'<label>Nombre de tu investigador<input name="nombre" maxlength="24" required autocomplete="nickname" placeholder="Así te conocerá la academia"></label>':''}<label>Correo electrónico<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.com"></label><label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="${register?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"></label><button class="gold-button">${register?'Crear mi academia':'Entrar en Tesis'} <span aria-hidden="true">→</span></button></form><p id="account-message" class="account-message" role="status"></p><button type="button" class="account-link auth-guest" id="account-dismiss">Seguir jugando como invitado</button><p class="auth-fine-print">No verificamos el correo. Sin recuperación pública por email: conserva tu contraseña. Entrar como invitado no acumula XP en esa partida.</p></section></div>`;
}
export function initAccountPanel() {
  const panel=document.getElementById('account-panel'),opener=document.getElementById('account-open');
  let mode='login',working=false,lastView='',restoring=true,pushed=false,returnFocus=null,returnScroll=0;
  const app=document.getElementById('app');
  function leave() {
    panel.hidden=true;app.inert=false;app.hidden=false;document.body.classList.remove('account-page-active');
    document.title='Tesis · La mesa del conocimiento';
    window.scrollTo(0,returnScroll);
    (returnFocus?.isConnected&&returnFocus!==document.body?returnFocus:opener).focus({preventScroll:true});
    document.dispatchEvent(new Event('tesis:account-return'));
  }
  function enter() {
    if(!panel.hidden)return;
    returnFocus=document.activeElement;returnScroll=window.scrollY;
    panel.hidden=false;app.inert=true;app.hidden=true;document.body.classList.add('account-page-active');
    document.title='Mi academia · Tesis';window.scrollTo(0,0);draw(true);panel.focus();
    if(accounts.signedIn())void perform(()=>accounts.refreshProfile());
  }
  function openPage() {
    if(location.hash!=='#perfil'){history.pushState(null,'','#perfil');pushed=true;}
    enter();
  }
  function closePage() {
    if(pushed&&location.hash==='#perfil'){pushed=false;history.back();}
    else {history.replaceState(null,'',location.pathname+location.search);leave();}
  }
  function followLocation(){if(location.hash==='#perfil')enter();else if(!panel.hidden)leave();}
  window.addEventListener('popstate',followLocation);window.addEventListener('hashchange',followLocation);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closePage();}});
  function draw(force=false) {
    opener.hidden=false;
    const profile=accounts.profile();
    if(accounts.signedIn()) {
      const p=progression(profile||{});opener.classList.add('has-profile');
      opener.dataset.rank=p.rank.id;
      opener.innerHTML=`<span class="account-trigger-monogram" aria-hidden="true">${esc(Array.from(profile?.nombre||'T')[0].toUpperCase())}<span>${p.level}</span></span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>${esc(profile?.nombre||'Mi academia')} <span>·</span> ${esc(p.rank.name)}</small></span><span class="account-chevron" aria-hidden="true">↗</span>`;
      opener.setAttribute('aria-label',profile?`Mi perfil, ${p.rank.name}, nivel ${p.level}`:'Mi perfil');
    } else {
      opener.classList.remove('has-profile');delete opener.dataset.rank;opener.innerHTML='<span class="account-trigger-monogram guest-monogram" aria-hidden="true">T</span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>Iniciar sesión</small></span><span class="account-chevron" aria-hidden="true">↗</span>';opener.setAttribute('aria-label','Mi perfil · Iniciar sesión');
    }
    if(panel.hidden||working)return;
    // Una recompensa/renovación en segundo plano no debe borrar el alias en edición.
    if(!force&&accounts.signedIn()&&profile&&panel.querySelector('#account-rename:not([hidden])'))return;
    const unavailable=!accounts.enabled()&&!restoring;
    const view=accounts.signedIn()?JSON.stringify(profile):unavailable?'unavailable':mode;
    if(!force&&lastView===view)return;lastView=view;
    if(accounts.signedIn()&&profile)panel.innerHTML=profileView(profile);
    else if(accounts.signedIn())panel.innerHTML=`<div class="account-empty-shell">${closeButton()}${badge('madera')}<span class="eyebrow">TU ACADEMIA</span><h2 id="account-title">Preparando tu perfil</h2><p>Conectando con tu legado…</p><p id="account-message" class="account-message" role="status"></p><button type="button" class="account-link" id="account-refresh">Volver a intentar</button><button type="button" class="account-link" id="account-logout">Cerrar sesión</button></div>`;
    else panel.innerHTML=unavailable?unavailableView():authView(mode);
    panel.dataset.view=accounts.signedIn()?'profile':unavailable?'unavailable':'auth';
    panel.querySelector('.account-close').onclick=closePage;
    panel.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.authMode;draw(true);});
    const dismiss=panel.querySelector('#account-dismiss');if(dismiss)dismiss.onclick=closePage;
    const edit=panel.querySelector('#account-edit');if(edit)edit.onclick=()=>{const form=panel.querySelector('#account-rename');form.hidden=!form.hidden;edit.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)form.querySelector('input').focus();};
    const refresh=panel.querySelector('#account-refresh');if(refresh)refresh.onclick=()=>perform(()=>accounts.refreshProfile());
    const logout=panel.querySelector('#account-logout');if(logout)logout.onclick=()=>perform(()=>accounts.logout());
    if(!panel.contains(document.activeElement))panel.querySelector('input,.account-close')?.focus();
  }
  async function perform(task) {
    if(working)return;working=true;panel.setAttribute('aria-busy','true');
    const controls=Array.from(panel.querySelectorAll('button,input'));controls.forEach(el=>{if(!el.classList.contains('account-close'))el.disabled=true;});
    const messageNode=panel.querySelector('#account-message');if(messageNode)messageNode.textContent='Conectando…';
    let message='',success=false;
    try {const result=await task();message=typeof result==='string'?result:'';success=true;}
    catch(error){message=error.message||'No se pudo completar la operación.';}
    finally {working=false;panel.removeAttribute('aria-busy');controls.forEach(el=>el.disabled=false);draw(success);const target=panel.querySelector('#account-message');if(target)target.textContent=message;}
  }
  panel.addEventListener('submit',event=>{
    event.preventDefault();const form=event.target,fields=new FormData(form);
    void perform(async()=>{
      if(form.id==='account-rename'){await accounts.rename(String(fields.get('nombre')).trim());return 'Nombre guardado. Tu asiento actual mantiene su nombre.';}
      const email=String(fields.get('email')).trim(),password=String(fields.get('password'));
      if(mode==='register'){const active=await accounts.register(email,password,String(fields.get('nombre')).trim());if(!active)return 'Cuenta creada sin sesión. Revisa la confirmación de correo del proyecto.';}
      else await accounts.login(email,password);
      try{await accounts.refreshProfile();}catch{return 'Sesión iniciada. No se pudo cargar tu perfil; pulsa Volver a intentar.';}
    });
  });
  opener.onclick=openPage;
  accounts.onChange(()=>draw());draw();
  void accounts.initialize().then(()=>{restoring=false;draw();if(accounts.signedIn())void accounts.refreshProfile().catch(()=>{});}).catch(()=>{
    restoring=false;opener.hidden=false;opener.innerHTML='<span class="account-trigger-monogram guest-monogram" aria-hidden="true">T</span><span class="account-trigger-copy"><strong>Mi perfil</strong><small>Conexión pendiente</small></span>';
    const disconnected=()=>{panel.dataset.view='auth';panel.innerHTML=`<div class="account-empty-shell">${closeButton()}${badge('madera')}<span class="eyebrow">VOLVEREMOS A ENCONTRARNOS</span><h2 id="account-title">La academia está desconectada</h2><p>Recarga para volver a conectar con tu cuenta.</p><p>Continuar como invitado cierra tu cuenta en esta pestaña. Tu sala actual conserva su identidad; las nuevas salas no acumularán XP.</p><button type="button" class="gold-button" id="account-guest">Continuar como invitado</button></div>`;panel.querySelector('.account-close').onclick=closePage;panel.querySelector('#account-guest').onclick=()=>{accounts.forgetStoredSession();globalThis.location.reload();};};
    opener.onclick=()=>{openPage();disconnected();};if(!panel.hidden)disconnected();
  });
  followLocation();
}
