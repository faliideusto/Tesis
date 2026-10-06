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

// El catálogo limita las rutas de imágenes y nunca usa el id recibido como ruta.
export function badge(rankId,{small=false}={}) {
  const rank=RANKS.find(rank=>rank.id===rankId)||RANKS[0];
  return `<span class="profile-badge tier-${rank.id}${small?' profile-badge-small':''}" role="img" aria-label="Distinción ${rank.name}"><img src="/assets/Tesis-assets/Rango-Niveles/${rank.name}.png" alt="" width="1254" height="1254" decoding="async"></span>`;
}
