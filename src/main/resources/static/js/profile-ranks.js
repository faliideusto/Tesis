// Distinciones visuales del perfil. No intervienen en las reglas ni conceden XP.
export const RANKS = Object.freeze([
  {id:'madera', name:'Madera', start:1, title:'Aprendiz de la academia', color:'#bf9264', glow:'#8e6134', description:'Toda gran idea empieza con una primera página.'},
  {id:'bronce', name:'Bronce', start:5, title:'Investigador emergente', color:'#dc9b65', glow:'#b86335', description:'Tu curiosidad comienza a dejar huella.'},
  {id:'plata', name:'Plata', start:10, title:'Erudito de la academia', color:'#d5e3f2', glow:'#89b0ce', description:'El conocimiento encuentra una voz propia.'},
  {id:'oro', name:'Oro', start:20, title:'Maestro del conocimiento', color:'#f4ce73', glow:'#dba339', description:'Tus ideas brillan en los salones de la academia.'},
  {id:'platino', name:'Platino', start:35, title:'Eminencia científica', color:'#a9eee5', glow:'#56cabe', description:'Una trayectoria que inspira nuevas generaciones.'},
  {id:'diamante', name:'Diamante', start:50, title:'Guardián del saber', color:'#a9dfff', glow:'#609ffc', description:'El tiempo convierte tu legado en algo excepcional.'},
  {id:'eterno', name:'Eterno', start:75, title:'Leyenda de la academia', color:'#f3cd78', glow:'#b377ff', description:'Un legado escrito en oro. Un conocimiento sin límites.'},
].map(rank=>Object.freeze(rank)));

export function progression(profile) {
  const rawXp=Number(profile?.xp);
  const xp=Number.isSafeInteger(rawXp) && rawXp>=0 ? rawXp : 0;
  const rawLevel=Number(profile?.nivel);
  // El nivel llega del backend; nunca se modifica para reclamar una recompensa.
  const level=Number.isSafeInteger(rawLevel) && rawLevel>=1 ? rawLevel : 1;
  const index=RANKS.reduce((current, rank, i)=>level>=rank.start ? i : current, 0);
  const rank=RANKS[index], nextRank=RANKS[index+1] || null;
  const inLevel=xp%500;
  return {rank,index,nextRank,level,xp,inLevel,toNextLevel:500-inLevel,
    percent:inLevel/500*100,
    rankPercent:nextRank ? Math.max(0,Math.min(100,(level-rank.start)/(nextRank.start-rank.start)*100)) : 100};
}

let badgeSequence=0;
export function badge(rankId,{small=false}={}) {
  const index=Math.max(0,RANKS.findIndex(rank=>rank.id===rankId));
  const rank=RANKS[index], eternal=rank.id==='eterno', diamond=rank.id==='diamante';
  const prefix=`rank-${rank.id}-${++badgeSequence}`;
  const bright=eternal ? '#fff0b2' : index>=2 ? '#f3fbff' : '#f4d7a4';
  const deep=eternal ? '#49236f' : ['#553621','#703c28','#526877','#836019','#276964','#315b95'][index];
  const leaves=Array.from({length:7},(_,i)=>{
    const x=55-i*2.1, y=189-i*15.8, angle=-44+i*9;
    return `<path d="M ${x} ${y} q -26 -4 -21 -26 q 23 6 21 26 Z" transform="rotate(${angle} ${x} ${y})"/>`;
  }).join('');
  const stars=index>=3 ? `<g fill="${bright}"><path d="M120 5l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="M39 78l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><path d="M201 78l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g>` : '';
  const crown=index>=4 ? `<path d="M84 45L79 24l22 11 19-18 19 18 22-11-5 21Z" fill="url(#${prefix}-metal)" stroke="${bright}" stroke-width="1.2"/><circle cx="120" cy="30" r="4" fill="${eternal?'#b689ff':rank.glow}"/>` : '';
  const gem=diamond||eternal ? `<g transform="translate(120 214)"><path d="M-18-7-10-18H10L18-7 0 17Z" fill="${eternal?'#9d63ef':'#8cd8ff'}" stroke="${bright}" stroke-width="1.5"/><path d="M-18-7H18M-10-18-6-7 0 17 6-7 10-18M-6-7 0-18 6-7" fill="none" stroke="${eternal?'#e1c5ff':'#effcff'}" stroke-width="1"/></g>` : `<path d="M120 203l8 10-8 10-8-10Z" fill="url(#${prefix}-metal)" stroke="${bright}"/>`;
  const wood=index===0 ? `<g stroke="#eed3aa" stroke-opacity=".12" fill="none"><path d="M89 58q-14 50 1 122M99 55q-12 54-2 130M141 58q15 55-3 126M149 61q12 59-5 112"/></g>` : '';
  const rays=eternal ? `<g stroke="#c29bff" stroke-opacity=".35"><path d="M120 0V13M73 11l9 16M167 11l-9 16M15 101l16 5M225 101l-16 5M20 170l14-6M220 170l-14-6"/></g><path d="M120 45L169 75 162 159 120 199 78 159 71 75Z" fill="#b578ff" opacity=".08"/>` : '';
  return `<svg class="profile-badge tier-${rank.id}${small?' profile-badge-small':''}" viewBox="0 0 240 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distinción ${rank.name}" focusable="false">
    <defs><linearGradient id="${prefix}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bright}"/><stop offset=".26" stop-color="${rank.color}"/><stop offset=".53" stop-color="${deep}"/><stop offset=".72" stop-color="${rank.color}"/><stop offset="1" stop-color="${bright}"/></linearGradient><linearGradient id="${prefix}-shield" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${deep}"/><stop offset="1" stop-color="#101626"/></linearGradient><radialGradient id="${prefix}-halo"><stop stop-color="${rank.glow}" stop-opacity=".25"/><stop offset="1" stop-color="${rank.glow}" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="120" cy="130" rx="119" ry="129" fill="url(#${prefix}-halo)"/>${rays}${stars}${crown}
    <path d="M120 39L177 67 174 153Q168 191 120 224Q72 191 66 153L63 67Z" fill="url(#${prefix}-metal)" stroke="${rank.color}" stroke-width="1.4"/>
    <path d="M120 47L168 73 166 151Q159 183 120 214Q81 183 74 151L72 73Z" fill="url(#${prefix}-shield)" stroke="${bright}" stroke-opacity=".65"/>
    <path d="M120 55L159 77 157 150Q151 177 120 201Q89 177 83 150L81 77Z" fill="none" stroke="${rank.color}" stroke-opacity=".35"/>${wood}
    <g fill="url(#${prefix}-metal)" stroke="${deep}" stroke-width=".5">${leaves}<g transform="translate(240 0) scale(-1 1)">${leaves}</g></g>
    <g stroke="${rank.color}" fill="none" stroke-width="1.8"><path d="M46 201Q25 145 55 90M194 201Q215 145 185 90"/></g>
    <g fill="url(#${prefix}-metal)"><path d="M84 99L120 78 156 99Z"/><path d="M88 101H152V106H88Z"/><path d="M91 109H99V144H91ZM106 109H114V144H106ZM126 109H134V144H126ZM141 109H149V144H141Z"/><path d="M85 146H155V151H85ZM81 154H159V159H81Z"/></g>
    <path d="M96 97L120 84 144 97Z" fill="${deep}" stroke="${bright}" stroke-width=".7"/>
    <g stroke="${bright}" stroke-opacity=".65" stroke-width=".9"><path d="M94 110V142M109 110V142M129 110V142M144 110V142"/></g>
    <path d="M83 170Q103 158 120 169Q137 158 157 170L155 189Q137 181 120 191Q103 181 85 189Z" fill="url(#${prefix}-metal)" stroke="${bright}" stroke-width="1"/>
    <g fill="none" stroke="${deep}" stroke-width="1.2"><path d="M120 170V188M89 172Q103 167 115 172M89 177Q103 172 115 177M89 182Q103 177 115 182M125 172Q138 167 151 172M125 177Q138 172 151 177M125 182Q138 177 151 182"/></g>
    <path d="M39 226L73 214 83 240 51 249 56 234Z" fill="${deep}" stroke="${rank.color}"/><path d="M201 226L167 214 157 240 189 249 184 234Z" fill="${deep}" stroke="${rank.color}"/>
    <path d="M65 221Q120 238 175 221L172 241Q120 257 68 241Z" fill="url(#${prefix}-shield)" stroke="${rank.color}" stroke-width="1.4"/>
    <path d="M76 232Q120 244 164 232" fill="none" stroke="${bright}" stroke-opacity=".45"/>${gem}
    <path d="M111 260h18M117 264h6" stroke="${rank.color}" stroke-width="1"/>
  </svg>`;
}
