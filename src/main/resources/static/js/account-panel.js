import {accounts} from './auth.js';
import {esc} from './dom.js';

export function progressText(progress) {
  switch(progress?.estado) {
    case 'INVITADO': return 'Invitado · esta partida no acumula experiencia.';
    case 'VINCULADA': return 'Partida vinculada a tu cuenta. El nivel no da ventajas.';
    case 'PENDIENTE': return 'Resultado válido · guardando experiencia. Si el servidor reinicia antes de guardarla, puede perderse.';
    case 'CONFIRMADA': return `Progreso guardado · +${Number(progress.xp) || 0} XP.`;
    case 'ERROR': return 'Resultado válido · no se pudo guardar el progreso. Contacta con quien administra Tesis; no se garantiza recuperar esta recompensa.';
    default: return '';
  }
}
export function initAccountPanel() {
  const panel=document.getElementById('account-panel');
  const opener=document.getElementById('account-open');
  let mode='login', working=false;
  function draw() {
    opener.hidden=!accounts.enabled();
    opener.textContent=accounts.signedIn()?'Mi perfil':'Cuenta / Invitado';
    if (!panel.open || working) return;
    const profile=accounts.profile();
    panel.innerHTML=`<div class="account-content"><button type="button" class="text-button account-close" aria-label="Cerrar perfil">Cerrar</button><h2>${accounts.signedIn()?'Mi perfil':mode==='register'?'Crear cuenta':'Iniciar sesión'}</h2>
      ${accounts.signedIn() ? `<p id="account-message" role="status">${profile?'':'Perfil pendiente de cargar.'}</p>
        ${profile?`<div class="profile-stats"><strong>Nivel ${esc(profile.nivel)}</strong><span>${esc(profile.xp)} XP</span><span>${esc(profile.partidasTerminadas)} partidas terminadas</span><span>${esc(profile.victorias)} victorias</span></div>
          <form id="account-rename"><label>Nombre visible<input name="nombre" value="${esc(profile.nombre)}" maxlength="24" required autocomplete="nickname"></label><button class="gold-button">Guardar nombre</button></form>`:''}
        <button type="button" class="plain-button" id="account-refresh">Actualizar perfil</button><button type="button" class="text-button" id="account-logout">Cerrar sesión</button><p class="setup-note">Cerrar sesión conserva tu sala. El nombre y la cuenta del asiento se fijan al entrar.</p>`:
        `<form id="account-${mode}">${mode==='register'?'<label>Nombre visible<input name="nombre" maxlength="24" required autocomplete="nickname"></label>':''}<label>Correo<input name="email" type="email" required autocomplete="email"></label><label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="${mode==='register'?'new-password':'current-password'}"></label><p class="setup-note">Mínimo 6 caracteres. No se verifica el correo. La recuperación por correo no está disponible públicamente; conserva tu contraseña.</p><button class="gold-button">${mode==='register'?'Crear cuenta':'Entrar'}</button></form>
         <p id="account-message" role="status"></p><button type="button" class="text-button" id="account-switch">${mode==='register'?'Ya tengo cuenta':'Crear una cuenta'}</button><p class="setup-note">También puedes jugar como invitado. Entrar después no reclama experiencia de una sala creada como invitado.</p>`}
      </div>`;
    panel.querySelector('.account-close').onclick=()=>panel.close();
    const switcher=panel.querySelector('#account-switch');
    if(switcher) switcher.onclick=()=>{mode=mode==='login'?'register':'login';draw();};
    const refresh=panel.querySelector('#account-refresh');
    if(refresh) refresh.onclick=()=>perform(()=>accounts.refreshProfile());
    const logout=panel.querySelector('#account-logout');
    if(logout) logout.onclick=()=>perform(()=>accounts.logout());
  }
  async function perform(task) {
    if(working) return;
    working=true;
    panel.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    let message='';
    try {const result=await task();message=typeof result==='string'?result:'';}
    catch(error) {message=error.message || 'No se pudo completar la operación.';}
    finally {
      working=false; draw();
      const target=panel.querySelector('#account-message');
      if(target) target.textContent=message;
    }
  }
  panel.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.target,fields=new FormData(form);
    void perform(async()=>{
      if(form.id==='account-rename') {await accounts.rename(String(fields.get('nombre')).trim());return 'Nombre guardado. Tu asiento actual mantiene su nombre.';}
      const email=String(fields.get('email')).trim(),password=String(fields.get('password'));
      if(mode==='register') {
        const active=await accounts.register(email,password,String(fields.get('nombre')).trim());
        if(!active) return 'Cuenta creada sin sesión. Revisa la configuración de confirmación de correo del proyecto.';
      } else await accounts.login(email,password);
      try {await accounts.refreshProfile();} catch {return 'Sesión iniciada. No se pudo cargar tu perfil; pulsa Actualizar perfil.';}
    });
  });
  opener.onclick=()=>{panel.showModal();draw();if(accounts.signedIn()) void perform(()=>accounts.refreshProfile());};
  accounts.onChange(draw);
  void accounts.initialize().then(draw).catch(()=>{
    opener.hidden=false;opener.textContent='Cuenta no disponible';
    opener.onclick=()=>{
      panel.innerHTML='<div class="account-content"><h2>Cuenta no disponible</h2><p>Recarga la página para volver a conectar con las cuentas.</p><p>Si continúas como invitado, cerraremos tu sesión de cuenta en esta pestaña y las nuevas salas no acumularán experiencia. Tu sala actual y la cuenta con la que entraste se conservan.</p><button type="button" class="gold-button" id="account-guest">Continuar como invitado</button><button type="button" class="plain-button account-close">Cerrar</button></div>';
      panel.querySelector('.account-close').onclick=()=>panel.close();
      panel.querySelector('#account-guest').onclick=()=>{accounts.forgetStoredSession();globalThis.location.reload();};
      panel.showModal();
    };
  });
}
