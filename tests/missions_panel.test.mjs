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
const html=missionsView(data,pass,{expanded:true});
assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(!html.includes('evil.test'));
assert(html.includes('data-mission-claim="daily_game"'));assert(html.includes('data-season-claim="badge"'));assert(html.includes('50 puntos para el siguiente nivel'));
const expired={...pass,temporada:{...pass.temporada,fin:'2000-01-01T00:00:00Z',activa:true}};
assert.match(missionsView(data,expired),/data-season-claim="badge" disabled/,'Stale active season cannot expose an enabled claim after its end');
assert.equal(missionState({...mission,reclamada:true}),'reclamada');
assert.equal(seasonCountdown(null),'Fecha pendiente de confirmar');assert.equal(seasonCountdown('2026-10-31T23:00:00Z',Date.parse('2026-10-07T12:00:00Z')),'24 días · 11 h restantes');assert.equal(seasonCountdown('2026-01-01',Date.parse('2026-10-07')),'Temporada finalizada');
let identity='one',resolve;
const staleRoot=root(),stale=mountMissions(staleRoot,{accounts:{identity:()=>identity,missions:()=>new Promise(done=>resolve=done),seasonPass:async()=>pass}});await flush();stale.destroy();resolve(data);await flush();assert(!staleRoot.innerHTML.includes('daily_game'));assert.equal(staleRoot.listeners.size,0);
let reads=0,claims=0,rewards=0;
const activeRoot=root(),active=mountMissions(activeRoot,{accounts:{identity:()=>identity,missions:async()=>{if(reads++>0)throw Error('lectura interrumpida');return data;},seasonPass:async()=>pass,claimMission:async()=>{claims++;return {...data,diarias:[{...mission,reclamada:true}]};}},onReward:()=>rewards++});await flush();
const button={disabled:false,dataset:{missionClaim:mission.id},hasAttribute:key=>key==='data-mission-claim'};
const click=()=>activeRoot.listeners.get('click')({target:{closest:()=>button}});
click();click();await flush();assert.equal(claims,1);assert.equal(rewards,1);assert(activeRoot.innerHTML.includes('is-claimed'),'Authoritative claim response survives a failed follow-up read');assert(activeRoot.innerHTML.includes('lectura interrumpida'));
click();await flush();assert.equal(claims,1,'Already claimed reward cannot be resubmitted');active.destroy();
const partialRoot=root(),partial=mountMissions(partialRoot,{accounts:{identity:()=>identity,missions:async()=>data}});await flush();assert(partialRoot.innerHTML.includes('daily_game'),'Missing pass endpoint cannot hide available missions');assert(partialRoot.innerHTML.includes('No se ha podido actualizar el pase'));partial.destroy();
console.log('Misiones: estados, countdown servidor, escape, identidad, claim único y respuesta autoritativa PASS');
