import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({console,Date});
const modules=new Map();
async function load(name){if(modules.has(name))return modules.get(name);const mod=new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context});modules.set(name,mod);await mod.link(spec=>load(spec.replace('./','')));await mod.evaluate();return mod;}
const {mountMissions,missionsView,seasonCountdown,missionState}=(await load('missions-panel.js')).namespace;
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function root(){const nodes=new Map(),listeners=new Map();return {innerHTML:'',nodes,listeners,setAttribute(){},contains:()=>true,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',setAttribute(){},focus(){}});return nodes.get(selector);},querySelectorAll:()=>[],addEventListener:(key,value)=>listeners.set(key,value),removeEventListener:key=>listeners.delete(key)};}
const mission={id:'daily_game',titulo:'<script>bad</script>',descripcion:'Termina una partida.',objetivo:1,progreso:1,xp:50,puntosPase:50,completada:true,reclamada:false};
const data={diarias:[mission],semanales:[],temporada:[],reinicioDiario:'2026-10-08T00:00:00Z'};
const pass={temporada:{id:'2026-10',nombre:'Crónicas del Archivo',fin:'2026-10-31T23:00:00Z',activa:true},progreso:{nivel:1,maxNivel:10,puntos:450,puntosSiguienteNivel:500,puntosPorNivel:500},recompensas:[{id:'badge',nombre:'Crónicas',nivel:1,cosmeticos:[{tipo:'insignia',nombre:'Archivo',asset:'https://evil.test/a.png'}],desbloqueada:true,reclamada:false}]};
const html=missionsView(data,pass,{expanded:true,season:true,routine:true});
assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(!html.includes('evil.test'));
assert(html.includes('data-countdown-end="2026-10-08T00:00:00Z"'));assert(!html.includes('Se renuevan'));assert(html.includes('data-mission-claim="daily_game"'));assert(html.includes('data-season-claim="badge"'));assert(html.includes('50 puntos para el siguiente nivel'));
const expired={...pass,temporada:{...pass.temporada,fin:'2000-01-01T00:00:00Z',activa:true}};
assert.match(missionsView(data,expired,{season:true,routine:true}),/data-season-claim="badge" disabled/,'Stale active season cannot expose an enabled claim after its end');
assert.equal(missionState({...mission,reclamada:true}),'reclamada');
assert.equal(seasonCountdown(null),'Tiempo restante pendiente de confirmar');assert.equal(seasonCountdown('2026-10-31T23:00:00Z',Date.parse('2026-10-07T12:00:00Z')),'24 días · 11 h · 0 min · 0 s restantes');assert.equal(seasonCountdown('2026-01-01',Date.parse('2026-10-07')),'Temporada finalizada');
let identity='one',resolve;
const staleRoot=root(),stale=mountMissions(staleRoot,{accounts:{identity:()=>identity,missions:()=>new Promise(done=>resolve=done),seasonPass:async()=>pass}});await flush();stale.destroy();resolve(data);await flush();assert(!staleRoot.innerHTML.includes('daily_game'));assert.equal(staleRoot.listeners.size,0);
let reads=0,claims=0,rewards=0;
const activeRoot=root(),active=mountMissions(activeRoot,{accounts:{identity:()=>identity,missions:async()=>{if(reads++>0)throw Error('lectura interrumpida');return data;},seasonPass:async()=>pass,claimMission:async()=>{claims++;return {...data,diarias:[{...mission,reclamada:true}]};}},onReward:()=>rewards++,routine:true});await flush();
const button={disabled:false,dataset:{missionClaim:mission.id},hasAttribute:key=>key==='data-mission-claim'};
const click=()=>activeRoot.listeners.get('click')({target:{closest:()=>button}});
click();click();await flush();assert.equal(claims,1);assert.equal(rewards,1);assert(activeRoot.innerHTML.includes('is-claimed'),'Authoritative claim response survives a failed follow-up read');assert(activeRoot.innerHTML.includes('lectura interrumpida'));
click();await flush();assert.equal(claims,1,'Already claimed reward cannot be resubmitted');active.destroy();
const partialRoot=root(),partial=mountMissions(partialRoot,{accounts:{identity:()=>identity,missions:async()=>data},season:true,routine:true});await flush();assert(partialRoot.innerHTML.includes('daily_game'),'Missing pass endpoint cannot hide available missions');assert(partialRoot.innerHTML.includes('No se ha podido actualizar el pase'));partial.destroy();
const special={id:'especial:cumlaude',titulo:'Cum Laude',descripcion:'Gana una partida con 20 o más puntos de prestigio.',objetivo:1,progreso:1,xp:0,puntosPase:0,completada:true,reclamada:false,recompensa:{id:'especial_cum_laude',tipo:'marco',nombre:'Cum Laude',asset:'/assets/seasons/misiones-especiales/marcos/marco-cum-laude.png',rareza:'legendario'}};
const crush={id:'especial:paliza5',titulo:'Victoria aplastante',descripcion:'Gana sacando 5.',objetivo:1,progreso:0,xp:500,puntosPase:0,completada:false,reclamada:false,recompensa:null};
const specialHtml=missionsView({...data,especiales:[special,crush]},pass,{routine:true});
assert(specialHtml.includes('Misiones especiales'));assert(specialHtml.includes('Permanentes'));assert(specialHtml.includes('marco-cum-laude.png'));assert(specialHtml.includes('Marco de perfil «Cum Laude»'));assert(specialHtml.includes('+500 XP'));assert(!specialHtml.includes('+0 puntos de pase'));assert(specialHtml.includes('data-mission-claim="especial:cumlaude"'));assert(specialHtml.includes('data-mission-period="especiales"'));
assert(!missionsView({...data,especiales:[special]},pass,{period:'diarias',routine:true}).includes('especial:cumlaude'),'Period filter hides special missions');
// Llaverito: premio físico de Choquet, sin XP ni cosmético en el juego; progreso por nivel hasta 25.
const keychain={id:'especial:llaverito',titulo:'Llaverito',descripcion:'Llega al rango Catedrático (nivel 25). El profesor Choquet te entregará un llavero en persona.',objetivo:25,progreso:12,xp:0,puntosPase:0,completada:false,reclamada:false,recompensa:null};
const keyHtml=missionsView({...data,especiales:[special,keychain,crush]},pass);
assert(keyHtml.includes('data-mission-id="especial:llaverito"'));assert(keyHtml.includes('Choquet te entregará un llavero'));assert(keyHtml.includes('12 / 25'));assert(keyHtml.includes('>Llavero<'));assert(keyHtml.includes('Premio en persona'));assert(!keyHtml.includes('+0 XP'));
// Por defecto no hay temporada ni pase: solo XP en diarias/semanales.
const plain=missionsView({...data,temporada:[{...mission,id:'temporada:jugar10:2026-10',titulo:'Diez partidas de temporada'}]},pass,{routine:true});
assert(!plain.includes('Misiones de temporada'));assert(!plain.includes('temporada:jugar10'));assert(!plain.includes('puntos de pase'));assert(!plain.includes('missions-pass'));assert(!plain.includes('data-mission-period="temporada"'));assert(!plain.includes('Crónicas del Archivo'));
assert(plain.includes('Recompensa de experiencia'));assert(plain.includes('+50 XP'));assert(plain.includes('data-missions-refresh'));
let passReads=0;const noPassRoot=root(),noPass=mountMissions(noPassRoot,{accounts:{identity:()=>identity,missions:async()=>data,seasonPass:async()=>{passReads++;return pass;}},routine:true});await flush();assert.equal(passReads,0,'Hidden season does not read the pass');assert(noPassRoot.innerHTML.includes('daily_game'));noPass.destroy();
// Por defecto solo quedan las misiones especiales.
const only=missionsView({...data,especiales:[special,crush]},pass);
assert(!only.includes('daily_game'));assert(!only.includes('Misiones diarias'));assert(!only.includes('Misiones semanales'));assert(!only.includes('data-mission-period'));assert(!only.includes('missions-stats'));
assert(only.includes('Misiones especiales'));assert(only.includes('data-mission-claim="especial:cumlaude"'));assert(only.includes('data-mission-filter="completada"'));
console.log('Misiones: estados, countdown servidor, escape, identidad, claim único y respuesta autoritativa PASS');
