import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const elements=new Map();
let targets=[];
const modal={open:false,dataset:{},scrollTop:0,querySelector:()=>null,
  close(){this.open=false;},showModal(){this.open=true;},addEventListener(){}};
elements.set('modal',modal);elements.set('modal-content',{innerHTML:''});
let restored=0;
const context=vm.createContext({document:{getElementById:id=>elements.get(id),activeElement:{focus(){restored++;}},
  querySelectorAll:()=>targets,createElement:()=>({setAttribute(){}})}});
const modules=new Map();
async function load(name){if(!modules.has(name))modules.set(name,new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context}));return modules.get(name);}
const decisions=await load('decisions.js');await decisions.link(name=>load(name.slice(2)));await decisions.evaluate();
const {endTurnWarning,ideaUnavailableReason,preview,highlightTargets,clearTargets}=decisions.namespace;
const state={yo:'Ana',actual:'Ana',accionesRestantes:2,jugadores:[{nombre:'Ana',monedas:1}],acciones:[{id:'INICIAR',disponible:true},{id:'HABILIDAD',disponible:false}]};
assert.match(endTurnWarning(state),/2 acciones base/);
assert.equal(endTurnWarning({...state,accionesRestantes:0}),'');
assert.match(endTurnWarning({...state,accionesRestantes:0,acciones:[{id:'HABILIDAD',disponible:true}]}),/habilidad/);
assert.match(ideaUnavailableReason(state,{coste:4}),/3 monedas/);
assert.match(ideaUnavailableReason({...state,actual:'Bruno',acciones:[]},{coste:1}),/Espera a tu turno/);
assert.equal(ideaUnavailableReason({...state,acciones:[{id:'INICIAR',disponible:false,motivo:'Resuelve el Comité'}]},{coste:4}),'Resuelve el Comité');
assert.match(preview({previsualizacion:'2/3 → 3/3 · PUBLICARÁS · +5 prestigio'}),/PUBLICARÁS/);
assert(!preview({previsualizacion:'<script>'}).includes('<script>'));
const dialogs=await load('dialogs.js');await dialogs.link(name=>load(name.slice(2)));await dialogs.evaluate();
const {dialog,reconcileDialog,informationalDialogOpen}=dialogs.namespace;
dialog('Reglas','<p>Texto</p>',{kind:'info'});modal.scrollTop=80;
const original=elements.get('modal-content').innerHTML;
reconcileDialog(true);
assert(informationalDialogOpen());assert.equal(modal.scrollTop,80);assert.equal(elements.get('modal-content').innerHTML,original);assert.equal(restored,0);
reconcileDialog(false);assert.equal(modal.open,false);
dialog('Confirmar','<button>Ejecutar</button>');reconcileDialog(true);assert.equal(modal.open,false);
const notes=[];
modal.querySelector=selector=>selector==='.dialog-body'?{append:note=>notes.push(note)}:notes[0];
dialog('Crónica','<p>Datos consultados</p>',{kind:'info',snapshot:true});modal.scrollTop=40;
reconcileDialog(true);reconcileDialog(true);
assert.equal(notes.length,1);assert.match(notes[0].textContent,/conserva la información/);assert.equal(modal.scrollTop,40);
function target(owner,index,hand=false) {
  return {dataset:{player:owner,index:String(index)},valid:false,closest:()=>hand?{}:null,
    classList:{remove(){this.owner.valid=false;},toggle(name,value){this.owner.valid=value;}}};
}
targets=[target('Ana',0),target('Bruno',0),target('Ana',0,true),target('Bruno',1)];
for(const t of targets)t.classList.owner=t;
highlightTargets({id:'HABILIDAD',disponible:true,opciones:[{indice:0,objetivo:'Bruno'}]},state);
assert.deepEqual(targets.map(t=>t.valid),[false,true,false,false]);
highlightTargets({id:'INICIAR',disponible:true,opciones:[{indice:0}]},state);
assert.deepEqual(targets.map(t=>t.valid),[false,false,true,false]);
highlightTargets({id:'INICIAR',disponible:false,opciones:[{indice:0}]},state);
assert(targets.every(t=>!t.valid));clearTargets();
console.log('Decisiones: advertencias, bloqueos, previsualizaciones y conservación/invalidez de diálogos verificadas');
