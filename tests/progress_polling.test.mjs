// node --experimental-vm-modules tests/progress_polling.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
let transitions=0,profileReads=0,phaseDialogs=0;
const nodes=new Map();
function element() {return {hidden:true,textContent:'',innerHTML:'',addEventListener(){},setAttribute(){},classList:{add(){},remove(){}}};}
const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element,
  body:{append(){},classList:{add(){},remove(){}}},querySelector:()=>({append(){}}),addEventListener(){}};
const context=vm.createContext({document,setTimeout,clearTimeout,console});
const exports={
  createMatchmaking:()=>({}),createRoomInvitations:()=>({refreshLobby(){}}),createRoomInteractions:()=>({reset(){},update(){}}),playInteraction:()=>Promise.resolve(),
  api:{identity:()=>null},accounts:{signedIn:()=>true,refreshProfile:async()=>{profileReads++;}},
  initAccountPanel:()=>{},startPresence:()=>{},progressText:p=>p?.estado==='CONFIRMADA'?`Guardado ${p.xp}`:p?.estado || '',
  homeCommunity:()=>'',
  img:()=>'',esc:String,board:()=>{},ideaCard:()=>{},ideaCardContents:()=>'',roleCard:()=>{},articleDescription:()=>'',studies:()=>{},articleChoices:()=>{},
  dialog:()=>{},closeDialog:()=>{},phaseDialog:()=>{phaseDialogs++;},reconcileDialog:()=>{},informationalDialogOpen:()=>false,
  endTurnWarning:()=>{},preview:()=>{},ideaUnavailableReason:()=>{},highlightTargets:()=>{},clearTargets:()=>{},
  notify:()=>{},feedback:()=>{},resetFeedback:()=>{},transition:async()=>{transitions++;},settled:()=>{},resetEffects:()=>{},
  chooseRole:()=>{},chooseVeto:()=>{},victory:()=>{}
};
const dependency=new vm.SyntheticModule(Object.keys(exports),function(){for(const [name,value] of Object.entries(exports))this.setExport(name,value);},{context});
const source=await readFile(new URL('../src/main/resources/static/js/app.js',import.meta.url),'utf8');
const module=new vm.SourceTextModule(source+'\nexport {applyRoom}; export function fixture(value){room=value;screen="game";}',{context});
await module.link(()=>dependency);await module.evaluate();
module.namespace.fixture({codigo:'ABCDE',revision:7,progreso:{estado:'PENDIENTE'}});
const next={codigo:'ABCDE',revision:7,partida:{fase:'FIN_PARTIDA'},progreso:{estado:'CONFIRMADA',xp:150}};
await module.namespace.applyRoom(next);
assert.equal(nodes.get('account-progress').textContent,'Guardado 150');
assert.equal(nodes.get('account-progress').hidden,false);
assert.equal(transitions,0);assert.equal(profileReads,1);
await module.namespace.applyRoom(next);assert.equal(profileReads,1);assert.equal(transitions,0);
await module.namespace.applyRoom({...next,revision:6,progreso:{estado:'PENDIENTE'}});
assert.equal(nodes.get('account-progress').textContent,'Guardado 150');
document.getElementById('account-panel').hidden=false;
await module.namespace.applyRoom({...next,revision:8,fase:'PARTIDA',partida:{fase:'FIN_RONDA',eventos:[],seleccion:[]}});
assert.equal(transitions,1,'El motor y la actualización visual siguen avanzando mientras se consulta el perfil');
assert.equal(phaseDialogs,0,'Los diálogos automáticos de partida no deben invadir la página de perfil');
console.log('Polling de progreso con misma revisión: actualiza recibo sin repetir efectos; descarta estado anterior');
