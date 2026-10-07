import {esc} from './dom.js';
import {progression} from './profile-ranks.js';

const TYPES=[['avatar','Avatar','♙'],['marco','Marco','▣'],['titulo','Título','✒'],['insignia','Insignia','✦'],['placa','Placa','◇'],['reverso','Reverso','▤'],['interaccion','Interacciones','✧']];
const DEFAULT_AVATAR='/assets/Tesis-assets/profile-v250/user-icon.svg';
const DEFAULTS=TYPES.map(([tipo,,icon],index)=>({id:`default:${tipo}`,tipo,nombre:['Avatar predeterminado','Sin marco','Sin título','Sin insignia','Placa predeterminada','Reverso clásico','Sin interacción equipada'][index],asset:tipo==='avatar'?DEFAULT_AVATAR:tipo==='reverso'?'/assets/Tesis-assets/cartas/reverso_idea.webp':null,rareza:'comun',predeterminado:true,icon}));
const safeAsset=asset=>/^\/assets\/(?:Tesis-assets|seasons)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:svg|png|webp)$/.test(asset||'')?asset:null;
export const cosmeticArt=(item,cls='')=>{const path=safeAsset(item?.asset);return `<span class="customization-art customization-art-${esc(item?.tipo||'avatar')} ${cls}">${item?.tipo==='titulo'?`<span class="customization-title-art">${esc(item.nombre)}</span>`:path?`<img src="${esc(path)}" alt="" decoding="async">`:`<span class="customization-original-glyph" aria-hidden="true">${esc(item?.icon||'◇')}</span>`}</span>`;};
const art=cosmeticArt;
export function profileCosmeticParts(data) {
  const current=type=>data?.inventario?.find(item=>item.id===data.equipamiento?.[type])||DEFAULTS.find(item=>item.tipo===type);
  const avatar=current('avatar'),frame=current('marco'),title=current('titulo'),badge=current('insignia'),plate=current('placa'),back=current('reverso');
  return {portrait:`<div class="customization-portrait ${frame.predeterminado?'':'has-frame'}" data-frame="${esc(frame.id)}">${art(avatar)}${frame.predeterminado?'':art(frame,'customization-frame-overlay')}</div>`,plate:plate.predeterminado?'':art(plate,'customization-plate-overlay'),title:title.predeterminado?'':`<div class="customization-equipped-title">${esc(title.nombre)}</div>`,badge:badge.predeterminado?'':`<div class="customization-equipped-badge">${art(badge)}<span>${esc(badge.nombre)}</span></div>`,back:`<span>${esc(back.nombre)}</span>${art(back)}`};
}

// The catalog and ownership remain authoritative on the server. Art paths can change independently of IDs.
export function mountCustomization(root,{accounts,profile,onSummary}) {
  let alive=true,generation=0,busy=false,needsRefresh=false,data=null,catalog=[],selected=null;
  let category='todos',filter='todos',query='',sort='temporada',notice='';
  const identity=accounts.identity?.();
  const valid=token=>alive&&token===generation&&accounts.identity?.()===identity;
  root.innerHTML=`<h2 id="customization-title" class="sr-only" tabindex="-1">Personalización de perfil</h2><nav class="customization-view-tabs" aria-label="Vista del perfil"><button type="button" data-summary>Resumen</button><span aria-current="page">✒ Personalización</span></nav><div class="customization-layout"><aside class="customization-preview" aria-label="Vista previa de tu perfil"></aside><div class="customization-content"><section class="customization-panel customization-equipment"><header class="customization-heading"><div><h3>✦ Equipamiento actual</h3><p>Cosméticos que tienes equipados en tu perfil.</p></div></header><div class="customization-slots"></div></section><section class="customization-panel customization-collection"><header class="customization-heading"><div><h3>✦ Colección de cosméticos</h3><p>Descubre y equipa elementos únicos para personalizar tu perfil.</p></div><div class="customization-tools"><label class="sr-only" for="customization-search">Buscar cosmético</label><input id="customization-search" type="search" maxlength="80" placeholder="Buscar cosmético…"><label class="sr-only" for="customization-sort">Ordenar cosméticos</label><select id="customization-sort"><option value="temporada">Temporada</option><option value="nombre">Nombre</option><option value="nivel">Nivel</option><option value="rareza">Rareza</option></select></div></header><div class="customization-toolbar"><div class="customization-categories" role="group" aria-label="Categoría de cosméticos"><button type="button" data-category="todos" aria-pressed="true">▤ Todos</button>${TYPES.map(([id,label,icon])=>`<button type="button" data-category="${id}" aria-pressed="false">${icon} ${label}</button>`).join('')}</div><div class="customization-filters" role="group" aria-label="Estado de cosméticos">${[['todos','Todos'],['equipados','Equipados'],['desbloqueados','Desbloqueados'],['bloqueados','Bloqueados']].map(([id,label])=>`<button type="button" data-filter="${id}" aria-pressed="${id==='todos'}">${label}</button>`).join('')}</div></div><p class="customization-status" role="status" aria-live="polite"></p><div class="customization-grid" aria-label="Colección de cosméticos"></div><section class="customization-detail" aria-label="Detalle del cosmético seleccionado"></section></section></div></div>`;
  const find=selector=>root.querySelector(selector);
  const owned=id=>DEFAULTS.some(item=>item.id===id)||data?.inventario?.some(item=>item.id===id);
  const equipped=item=>item.predeterminado?!data?.equipamiento?.[item.tipo]:data?.equipamiento?.[item.tipo]===item.id;
  const current=type=>data?.inventario?.find(item=>item.id===data.equipamiento?.[type])||DEFAULTS.find(item=>item.tipo===type);
  const label=type=>TYPES.find(([id])=>id===type)?.[1]||type;
  function merge(next) {
    data=next;
    const records=new Map(DEFAULTS.map(item=>[item.id,item]));
    for(const row of next.catalogo||[]) if(!records.has(row.cosmetico.id))records.set(row.cosmetico.id,{...row.cosmetico,temporada:row.temporada,nivel:row.nivel});
    if(!next.catalogo?.length) for(const item of catalog) records.set(item.id,item);
    for(const item of next.inventario||[]) records.set(item.id,{...records.get(item.id),...item});
    catalog=[...records.values()];
    if(!catalog.some(item=>item.id===selected))selected=catalog[0]?.id||null;
  }
  function preview() {

    const p=progression(profile),avatar=current('avatar'),frame=current('marco'),title=current('titulo'),badge=current('insignia'),plate=current('placa');
    find('.customization-preview').innerHTML=`<div class="customization-researcher"><span class="customization-card-label">CARNET DE INVESTIGADOR</span><div class="customization-portrait ${!frame.predeterminado?'has-frame':''}" data-frame="${esc(frame.id)}">${art(avatar)}${!frame.predeterminado?art(frame,'customization-frame-overlay'):''}</div><span class="customization-level">NIVEL ${esc(p.level)}</span><span class="customization-rank-title">${esc(p.rank.title)}</span><div class="customization-nameplate">${!plate.predeterminado?art(plate,'customization-plate-overlay'):''}<h3>${esc(profile.nombre)}</h3></div><strong class="customization-rank">${esc(p.rank.name)}</strong>${!title.predeterminado?`<div class="customization-equipped-title">✒ ${esc(title.nombre)}</div>`:''}${!badge.predeterminado?`<div class="customization-equipped-badge">${art(badge)}<span>${esc(badge.nombre)}</span></div>`:''}<blockquote>“${esc(p.rank.description)}”</blockquote><small>TESIS · LA ACADEMIA</small></div>`;
    find('.customization-slots').innerHTML=TYPES.map(([type,name])=>{const item=current(type);return `<button type="button" class="customization-slot customization-slot-${type}" ${item?`data-select="${esc(item.id)}"`:'disabled'} aria-label="${name}: ${esc(item?.nombre||'Sin equipar')}"><span>${name}</span>${item?art(item):type==='avatar'?art({tipo:'avatar',asset:DEFAULT_AVATAR}):`<span class="customization-slot-empty" aria-hidden="true">${TYPES.find(([id])=>id===type)[2]}</span>`}<strong>${esc(item?.nombre||(type==='avatar'?'Avatar predeterminado':'Sin equipar'))}</strong></button>`;}).join('');
  }
  function list() {
    const folded=query.toLocaleLowerCase('es');
    const visible=catalog.filter(item=>(category==='todos'||category===item.tipo)&&(filter==='todos'||filter==='equipados'&&equipped(item)||filter==='desbloqueados'&&owned(item.id)||filter==='bloqueados'&&!owned(item.id))&&`${item.nombre} ${label(item.tipo)} ${item.temporada?.nombre||''}`.toLocaleLowerCase('es').includes(folded));
    visible.sort((a,b)=>sort==='nivel'?(a.nivel||0)-(b.nivel||0):sort==='rareza'?({comun:0,epico:1,legendario:2}[b.rareza]||0)-({comun:0,epico:1,legendario:2}[a.rareza]||0):sort==='nombre'?a.nombre.localeCompare(b.nombre,'es'):(b.temporada?.id||'').localeCompare(a.temporada?.id||'')||(a.nivel||0)-(b.nivel||0));
    find('.customization-grid').innerHTML=visible.length?visible.map(item=>`<button type="button" class="customization-cosmetic ${equipped(item)?'is-equipped':''} ${owned(item.id)?'is-owned':'is-locked'} ${selected===item.id?'is-selected':''}" data-select="${esc(item.id)}" aria-pressed="${selected===item.id}" aria-label="${esc(item.nombre)}, ${owned(item.id)?equipped(item)?'equipado':'desbloqueado':'bloqueado'}">${art(item)}${equipped(item)?'<span class="customization-check" aria-hidden="true">✓</span>':''}<strong>${esc(item.nombre)}</strong><span class="customization-item-status">${owned(item.id)?`${equipped(item)?'✓ Equipado':'✓ Desbloqueado'}`:`<span aria-hidden="true">♙</span> ${esc(item.temporada?.nombre||'Requisito no disponible')}${item.nivel?`<small>Nivel ${esc(item.nivel)}</small>`:''}`}</span></button>`).join(''):'<p class="customization-empty">No hay cosméticos que coincidan con estos filtros.</p>';
  }
  function detail() {
    const item=catalog.find(item=>item.id===selected);
    find('.customization-detail').innerHTML=item?`${art(item)}<div class="customization-detail-copy"><h3>${esc(item.nombre)}</h3><p class="customization-type">◇ ${esc(label(item.tipo))} · ${esc(item.predeterminado ? 'Aspecto original' : {comun:'Común',epico:'Épico',legendario:'Legendario'}[item.rareza]||item.rareza)}</p><p>${item.predeterminado?'Aspecto original · Siempre disponible. No ocupa espacio en tu inventario.':owned(item.id)?'Este cosmético pertenece a tu colección permanente.':'Desbloquea este cosmético en su pase de temporada y reclama la recompensa para añadirlo a tu colección.'}</p><span>${esc(item.temporada?.nombre||'Colección personal')}${item.nivel?` · Nivel ${esc(item.nivel)}`:''}</span></div><div class="customization-detail-actions"><span>${equipped(item)?'✓ Equipado':owned(item.id)?'✓ Desbloqueado':'Bloqueado'}</span><div><button type="button" class="gold-button" data-equip ${!owned(item.id)||equipped(item)||busy||needsRefresh?'disabled':''}>Equipar</button><button type="button" class="gold-button" data-unequip ${!equipped(item)||item.predeterminado||busy||needsRefresh?'disabled':''}>Desequipar</button></div></div>`:'<p class="customization-empty">Selecciona un cosmético para ver sus detalles.</p>';
  }
  function status() {find('.customization-status').textContent=notice;root.setAttribute('aria-busy',String(busy));}
  function render() {const titleFocused=root.ownerDocument?.activeElement?.id==='customization-title';preview();list();detail();status();if(titleFocused)find('#customization-title')?.focus({preventScroll:true});}
  async function load() {
    if(busy)return;
    const token=++generation;busy=true;notice='Cargando tu colección…';status();
    try {
      let next=await accounts.cosmetics();if(!valid(token))return;
      let partial=false;
      if(!next.catalogo||(!next.catalogo.length&&!next.temporadas?.length)) {
        try {
          const pass=await accounts.seasonPass();if(!valid(token))return;
          next={...next,catalogo:(pass.recompensas||[]).flatMap(reward=>reward.cosmeticos.map(cosmetico=>({cosmetico,temporada:pass.temporada,nivel:reward.nivel}))),temporadas:[{...pass.temporada,nivel:pass.progreso.nivel,maxNivel:pass.progreso.maxNivel,recompensasObtenidas:pass.recompensas.filter(r=>r.reclamada).length,totalRecompensas:pass.recompensas.length}]};
        } catch {if(!valid(token))return;partial=true;}
      }
      merge(next);busy=false;needsRefresh=false;notice=partial?'Tu inventario está disponible. No pudimos consultar los requisitos de temporada.':'';render();
      if(partial)find('.customization-status').insertAdjacentHTML('beforeend',' <button type="button" class="account-link" data-reload>Actualizar colección</button>');
    } catch(error) {if(!valid(token))return;busy=false;notice=error.message||'No se pudo cargar tu colección.';status();find('.customization-grid').innerHTML='<div class="customization-empty"><p>No pudimos conectar con tu colección.</p><button type="button" class="gold-button" data-reload>Volver a cargar</button></div>';}
  }
  async function equip(clear) {
    const item=catalog.find(item=>item.id===selected);if(busy||needsRefresh||!item||!owned(item.id))return;
    const token=++generation;busy=true;notice='Guardando equipamiento…';detail();status();
    try {const next=await accounts.equipCosmetic(item.tipo,clear||item.predeterminado?null:item.id);if(!valid(token))return;merge(next);busy=false;notice=clear?'Cosmético desequipado.':'Equipamiento actualizado.';render();find(item.predeterminado?`.customization-grid [data-select="${CSS.escape(item.id)}"]`:clear?'[data-equip]':'[data-unequip]')?.focus({preventScroll:true});}
    catch(error){if(!valid(token))return;busy=false;needsRefresh=true;notice=`${error.message||'No se pudo guardar el equipamiento.'} Actualiza la colección para comprobar su estado antes de volver a intentarlo.`;detail();status();find('.customization-status').insertAdjacentHTML('beforeend',' <button type="button" class="account-link" data-reload>Actualizar colección</button>');}
  }
  function click(event) {
    const button=event.target.closest('button');if(!button||!root.contains(button))return;
    if(button.hasAttribute('data-summary'))onSummary();
    else if(button.dataset.category){category=button.dataset.category;root.querySelectorAll('[data-category]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));list();}
    else if(button.dataset.filter){filter=button.dataset.filter;root.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));list();}
    else if(button.dataset.select&&!busy){selected=button.dataset.select;list();detail();find(`.customization-grid [data-select="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});}
    else if(button.hasAttribute('data-equip'))void equip(false);
    else if(button.hasAttribute('data-unequip'))void equip(true);
    else if(button.hasAttribute('data-reload'))void load();
  }
  function input(event){if(event.target.id==='customization-search'){query=event.target.value;list();}}
  function change(event){if(event.target.id==='customization-sort'){sort=event.target.value;list();}}
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);
  preview();detail();void load();
  return {destroy(){alive=false;generation++;root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeAttribute('aria-busy');}};
}
