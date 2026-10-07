import {esc} from './dom.js';

const localAsset=value=>typeof value==='string'&&/^\/assets\/(?:Tesis-assets|seasons)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|webp|svg)$/.test(value);
const renderers=new Map([['archivo_lanzamiento_libro',bookThrow]]);
function anchor(name,state){
  const seat=name===state.yo?document.getElementById('local'):document.querySelector(`#board .rival[data-player="${CSS.escape(name)}"]`);
  return seat?.querySelector('.rival-portrait')||seat;
}
function point(element){const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}

// Each renderer owns a visual lifetime, independent of the functional transition queue.
export async function playInteraction(event,{state,signal}={}) {
  const render=renderers.get(event?.interactionId);
  if(!render||!state||signal?.aborted||document.hidden||event.emisor===event.objetivo)return false;
  const equipped=state.jugadores?.find(p=>p.nombre===event.emisor)?.cosmeticos?.interaccion;
  if(equipped?.tipo!=='interaccion'||equipped.id!==event.interactionId)return false;
  const source=anchor(event.emisor,state),target=anchor(event.objetivo,state);
  if(!source?.isConnected||!target?.isConnected)return false;
  const layer=document.createElement('div');layer.className='interaction-effects';layer.setAttribute('aria-hidden','true');
  const animations=new Set();let cancelled=false;
  const cancel=()=>{cancelled=true;for(const animation of animations)animation.cancel();layer.remove();};
  const valid=()=>!cancelled&&source.isConnected&&target.isConnected&&anchor(event.emisor,state)===source&&anchor(event.objetivo,state)===target;
  const visibility=()=>{if(document.hidden)cancel();};
  signal?.addEventListener('abort',cancel,{once:true});window.addEventListener('resize',cancel);document.addEventListener('visibilitychange',visibility);
  const observer=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{if(!valid())cancel();});
  observer?.observe(document.body,{childList:true,subtree:true});
  document.body.append(layer);
  const image=(asset,kind)=>{
    if(!localAsset(asset))return null;
    const node=document.createElement('span');node.className=`interaction-piece interaction-${kind}`;node.innerHTML=`<img src="${esc(asset)}" alt="" draggable="false">`;layer.append(node);return node;
  };
  const particle=kind=>{
    const node=document.createElement('span');node.className=`interaction-piece interaction-spark interaction-spark-${kind}`;layer.append(node);return node;
  };
  const animate=async(element,frames,duration)=>{
    if(!element||!valid())return;
    const animation=element.animate(frames,{duration,easing:'linear',fill:'none'});animations.add(animation);
    try{await animation.finished;}catch{/* Cosmetic cancellation has no functional consequence. */}finally{animations.delete(animation);}
  };
  try {
    const rendered=await render({assets:equipped.assets||{},source,target,image,particle,animate,valid,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
    return rendered!==false&&valid();
  } finally {
    cancel();observer?.disconnect();signal?.removeEventListener('abort',cancel);window.removeEventListener('resize',cancel);document.removeEventListener('visibilitychange',visibility);
  }
}

async function bookThrow({assets,source,target,image,particle,animate,valid,reduced}) {
  if(!['libro','hoja-01','hoja-02','impacto'].every(key=>localAsset(assets[key])))return false;
  const from=point(source),to=point(target);
  const impact=()=>{
    const node=image(assets.impacto,'impact');node.style.left=`${to.x}px`;node.style.top=`${to.y}px`;
    return animate(node,reduced?[{opacity:0},{opacity:.8,offset:.2},{opacity:0}]:[{opacity:0,transform:'translate(-50%,-50%) scale(.45)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.1)',offset:.22},{opacity:0,transform:'translate(-50%,-50%) scale(1.35)'}],reduced?200:300);
  };
  if(reduced){await impact();return;}
  const distance=Math.hypot(to.x-from.x,to.y-from.y),arc=Math.min(100,Math.max(35,distance*.17));
  const frame=(t,extra=0)=>`translate(-50%,-50%) translate(${(to.x-from.x)*t}px,${(to.y-from.y)*t-Math.sin(Math.PI*t)*arc+extra}px)`;
  const book=image(assets.libro,'book');book.style.left=`${from.x}px`;book.style.top=`${from.y}px`;
  const flight=animate(book,Array.from({length:9},(_,i)=>{const t=i/8;return {offset:t,opacity:t===0?0:1,transform:`${frame(t)} rotate(${-20+130*t}deg) scale(${.75+Math.sin(Math.PI*t)*.22})`};}),820);
  const pages=['hoja-01','hoja-02'].map((key,index)=>{
    const page=image(assets[key],'page');page.style.left=`${from.x}px`;page.style.top=`${from.y}px`;
    return animate(page,Array.from({length:9},(_,i)=>{const t=i/8;return {offset:t,opacity:t<.25||t===1?0:.85,transform:`${frame(Math.max(0,t-.13*(index+1)),index?28:-18)} rotate(${(index?1:-1)*(30+260*t)}deg) scale(.8)`};}),820);
  });
  await Promise.all([flight,...pages]);book.remove();if(!valid())return;
  const radius=Math.min(180,Math.max(110,target.getBoundingClientRect().width*1.7));
  const sparks=Array.from({length:48},(_,index)=>{
    const star=index%3===0,node=particle(star?'star':'trail');
    node.style.left=`${to.x}px`;node.style.top=`${to.y}px`;node.style.color=index%2?'#d5a2ff':'#ffd66f';
    const angle=index*2.3999632297,distance=radius*(.45+(index%7)/10),x=Math.cos(angle)*distance,y=Math.sin(angle)*distance;
    const rotation=angle*180/Math.PI;
    const transform=(progress,scale)=>`translate(-50%,-50%) translate(${x*progress}px,${y*progress+18*progress*progress}px) rotate(${rotation}deg) scale(${scale})`;
    return animate(node,[{opacity:0,transform:transform(0,.3)},{opacity:1,transform:transform(.2,star?1.2:1),offset:.13},{opacity:.85,transform:transform(.65,.8),offset:.5},{opacity:0,transform:transform(1,.15)}],580);
  });
  await Promise.all([impact(),...sparks,animate(target,[{transform:'translateX(0)'},{transform:'translateX(-3px)',offset:.2},{transform:'translateX(3px)',offset:.4},{transform:'translateX(-2px)',offset:.6},{transform:'translateX(0)'}],220)]);
}
