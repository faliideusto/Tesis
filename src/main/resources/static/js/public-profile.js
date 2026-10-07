import {esc} from './dom.js';
import {badge,progression} from './profile-ranks.js';

const integer=value=>Math.max(0,Math.floor(Number(value)||0));
const format=value=>integer(value).toLocaleString('es-ES');
const frame=()=>'<span class="public-profile-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

export function publicProfileView(profile) {
  const p=progression(profile),games=integer(profile.partidasTerminadas),wins=integer(profile.victorias);
  const rate=games?Math.round(wins/games*100):0;
  const presence=profile.presenciaDisponible===true?(profile.enLinea?'En línea':'Desconectado'):'Presencia no disponible';
  return `<div class="public-profile-layout"><section class="public-researcher-card">${frame()}<p class="public-profile-kicker">CARNET DE INVESTIGADOR</p>${badge(p.rank.id)}<span class="public-level-plaque">NIVEL ${format(p.level)}</span><p class="public-rank-title">${esc(p.rank.title)}</p><h3>${esc(profile.nombre)}</h3><span class="public-identity-divider" aria-hidden="true">◇</span><strong class="public-rank-name">${esc(p.rank.name)}</strong><p class="public-rank-description">${esc(p.rank.description)}</p><span class="public-presence ${profile.presenciaDisponible===true&&profile.enLinea?'is-online':''}"><i aria-hidden="true"></i>${presence}</span></section><section class="public-profile-record" aria-label="Progreso y estadísticas públicas">${frame()}<h3>Progresión de nivel</h3><div class="public-xp-headline"><strong>${format(p.inLevel)} <small>/ 500 XP</small></strong><span>NIVEL ${format(p.level)} → ${format(p.level+1)}</span></div><progress value="${p.inLevel}" max="500" aria-label="Experiencia para el siguiente nivel">${format(p.inLevel)} / 500 XP</progress><p class="public-total-xp">${format(p.xp)} XP acumulada</p><dl class="public-profile-stats"><div><dt>Partidas terminadas</dt><dd>${format(games)}</dd></div><div><dt>Victorias</dt><dd>${format(wins)}</dd></div><div><dt>Porcentaje de victorias</dt><dd>${rate}%</dd></div></dl><div class="public-profile-code"><span>Código de amistad</span><strong>${esc(profile.codigo)}</strong></div><p class="public-profile-fine-print">Prestigio visual. Sin ventajas en partida.</p></section></div>`;
}

// This modal has its own lifecycle and exposes only the server's public projection.
export function createPublicProfile(root,{accounts}={}) {
  const document=root.ownerDocument,identity=accounts.identity();
  let alive=true,generation=0,dialog=null,invoker=null,code='';
  const valid=current=>alive&&dialog?.open&&generation===current&&accounts.signedIn()&&accounts.identity()===identity;
  function restoreFocus() {if(invoker?.isConnected!==false&&root.contains(invoker))invoker?.focus({preventScroll:true});}
  function close() {++generation;if(dialog?.open)dialog.close();restoreFocus();}
  function shell(content) {
    dialog.innerHTML=`<div class="public-profile-modal-header"><div><span>TESIS · LA ACADEMIA</span><h2 id="public-profile-title">Perfil de investigador</h2></div><button type="button" class="public-profile-close" data-public-profile-close aria-label="Cerrar perfil público">×</button></div><div class="public-profile-content">${content}</div>`;
  }
  async function load() {
    const current=++generation;
    shell('<p class="public-profile-status" role="status">Abriendo el carnet de investigador…</p>');
    dialog.querySelector('[data-public-profile-close]')?.focus({preventScroll:true});
    try {
      const profile=await accounts.publicProfile(code);if(!valid(current))return;
      shell(publicProfileView(profile));dialog.querySelector('[data-public-profile-close]')?.focus({preventScroll:true});
    } catch(error) {
      if(!valid(current))return;
      const detail=error.name==='AbortError'?'La conexión tardó demasiado.':error.name==='TypeError'?'No se pudo conectar con la Academia.':error.message||'No se pudo cargar este perfil.';
      shell(`<div class="public-profile-status" role="status"><p>${esc(detail)}</p><button type="button" class="public-profile-retry" data-public-profile-retry>Volver a intentar</button></div>`);
      dialog.querySelector('[data-public-profile-retry]')?.focus({preventScroll:true});
    }
  }
  function ensureDialog() {
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='public-profile-dialog';dialog.setAttribute('aria-labelledby','public-profile-title');
    dialog.addEventListener('click',event=>{
      if(event.target.closest('[data-public-profile-close]'))close();
      else if(event.target.closest('[data-public-profile-retry]'))void load();
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
    dialog.addEventListener('close',()=>{++generation;restoreFocus();});
    document.body.append(dialog);
  }
  return {
    get isOpen(){return Boolean(dialog?.open);},
    open(selected,button){
      if(!alive||!accounts.signedIn()||accounts.identity()!==identity)return;
      ensureDialog();invoker=button;code=selected;if(!dialog.open)dialog.showModal();void load();
    },
    destroy(){alive=false;++generation;invoker=null;if(dialog?.open)dialog.close();dialog?.remove();dialog=null;}
  };
}
