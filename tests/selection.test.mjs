// node --experimental-vm-modules tests/selection.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});
const modules=new Map();
async function module(name) {
  if (!modules.has(name)) modules.set(name,new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context}));
  return modules.get(name);
}
const players=await module('players.js');
await players.link(name=>module(name.replace('./',''))); await players.evaluate();
const {rolePreview,actionBolts,articleChoices,rival}=players.namespace;
const {roleCard}=modules.get('cards.js').namespace;
const role={indice:-1,orden:4,nombre:'Decana',habilidad:'Inmunidad.',arte:'personajes/05_decana.png'};
assert.equal(rolePreview({rol:null}), '');
assert.match(rolePreview({rol:role,nombre:'Ana'}),/marco_personaje.png/);
assert.match(rolePreview({rol:role,nombre:'Ana'}),/Inmunidad/);
const unavailable=roleCard(role,{unavailable:true,command:'unavailable-role'});
assert.match(unavailable,/No disponible/); assert.match(unavailable,/unavailable-role/);
assert.doesNotMatch(unavailable,/descartado|escogido|confirm-role/);
for(const remaining of [2,1,0,2]) {
  const html=actionBolts({activo:true},{fase:'TURNO_JUGADOR',accionesRestantes:remaining});
  assert.equal((html.match(/<svg/g)||[]).length,2);
  assert.equal((html.match(/action-bolt available/g)||[]).length,remaining);
}
for (const [active,phase] of [[false,'TURNO_JUGADOR'],[true,'SELECCION_ROLES'],[true,'FIN_RONDA'],[true,'FIN_PARTIDA']]) {
  const html=actionBolts({activo:active},{fase:phase,accionesRestantes:2});
  assert.equal((html.match(/<svg/g)||[]).length,2);
  assert.equal((html.match(/action-bolt spent/g)||[]).length,2);
  assert.match(html,/Fuera de turno/);
}
const card={nombre:'Artículo <idéntico>',coste:1,trabajo:3,prestigio:2,arte:'articulo.png',marco:'marco.png'};
const state={yo:'Ana',jugadores:['Ana','Bruno'].map((nombre,i)=>({nombre,estudios:[{indice:0,carta:card,trabajo:i+1}]}))};
const html=articleChoices({opciones:[{indice:0,objetivo:'Bruno'},{indice:0}]},state);
assert.match(html,/Bruno/); assert.match(html,/Ana/);
assert.match(html,/2 \/ 3 trabajo/); assert.match(html,/1 \/ 3 trabajo/);
assert.match(html,/data-index="0"/); assert.match(html,/data-index="1"/);
assert.equal((html.match(/card-frame/g)||[]).length,2);
assert.doesNotMatch(html,/<idéntico>/);
const p={nombre:'Bruno',rol:null,estudios:[],cartas:2};
assert.match(rival({...p,activo:true}),/class="rival active"/);
assert.doesNotMatch(rival({...p,activo:false}),/class="rival active"/);
for (const remaining of [2,1,0,2]) {
  const html=rival({...p,activo:true},{fase:'TURNO_JUGADOR',accionesRestantes:remaining});
  assert.equal((html.match(/action-bolt available/g)||[]).length,remaining);
  assert.equal((html.match(/<svg/g)||[]).length,2);
}
console.log('Selección, privacidad, artículos y estados de turno: comprobaciones superadas');
