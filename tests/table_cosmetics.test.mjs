import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({document:{addEventListener(){}},window:{addEventListener(){}}});
const modules=new Map();
async function module(name){if(!modules.has(name))modules.set(name,new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context}));return modules.get(name);}
const players=await module('players.js');await players.link(spec=>module(spec.replace('./','')));await players.evaluate();
const effects=await module('effects.js');await effects.link(async spec=>{if(spec==='./feedback.js')return new vm.SourceTextModule('export function showActivity(){}',{context});return module(spec.replace('./',''));});await effects.evaluate();
const {rival,localPlayer,rolePreview}=players.namespace,{ownerCardBack}=effects.namespace;
const cosmetic=(tipo,asset)=>({id:`test_${tipo}`,tipo,nombre:'Cosmético público',asset,rareza:'comun'});
const avatar='/assets/seasons/cronicas/avatar/aprendiz.png',frame='/assets/seasons/cronicas/marco/pergamino.png',back='/assets/seasons/cronicas/reverso/archivo.png';
const base={nombre:'Ana',rol:null,prestigio:2,monedas:3,cartas:4,estudios:[],activo:false};
let html=rival(base);assert(html.includes('reserved-scholar.webp'));assert(html.includes('cartas/reverso_idea.webp'));assert(!html.includes('player-avatar-frame'));
const custom={...base,cosmeticos:{avatar:cosmetic('avatar',avatar),marco:cosmetic('marco',frame),reverso:cosmetic('reverso',back),interaccion:{...cosmetic('interaccion','/assets/seasons/cronicas/sello.png'),assets:{mesa:'/assets/seasons/cronicas/private-piece.png'}}}};
html=rival(custom);assert(html.includes(`src="${avatar}"`));assert(html.includes(`src="${frame}"`));assert(html.includes(`src="${back}"`));assert(!html.includes('/assets/Tesis-assets//assets'));assert(!html.includes('sello.png'));assert(!html.includes('private-piece.png'));
assert.equal(rolePreview(custom),'','Avatar/loadout never reveals a hidden role');assert(html.includes('Personaje reservado'));
assert.equal((html.match(/player-avatar-frame/g)||[]).length,1,'One frame surrounds the portrait only');assert(/rival-portrait[^]*player-avatar-frame[^]*<\/span>\s*<span class="rival-body"/.test(html));
const role={nombre:'Decana',habilidad:'Inmunidad',arte:'personajes/05_decana.webp',orden:4};
html=localPlayer({...custom,rol:role},{fase:'TURNO_JUGADOR',accionesRestantes:1});assert(html.includes('local-role-button'));assert(html.includes('player-role-preview'));assert(html.includes('Decana'));assert(html.includes(avatar));
for(const bad of ['https://evil.test/a.png','/assets/seasons/../secret.png','/assets/seasons/a.png?tracker=1','/assets/seasons/a.png" onerror="bad','/assets/seasons/%2e%2e/a.png']){
 const invalid={...base,cosmeticos:{avatar:cosmetic('avatar',bad),marco:cosmetic('marco',bad),reverso:cosmetic('reverso',bad)}};
 html=rival(invalid);assert(html.includes('reserved-scholar.webp'));assert(html.includes('cartas/reverso_idea.webp'));assert(!html.includes('player-avatar-frame'));assert.equal(ownerCardBack({jugadores:[invalid]},'Ana'),'/assets/Tesis-assets/cartas/reverso_idea.webp');
}
const state={yo:'Ana',jugadores:[custom,{...base,nombre:'Bruno',cosmeticos:{reverso:cosmetic('reverso','/assets/seasons/cronicas/reverso/otro.png')}}]};
Object.defineProperty(state,'mano',{get(){throw Error('Hidden card backs must not inspect hands');}});
assert.equal(ownerCardBack(state,'Ana'),back);assert.equal(ownerCardBack(state,'Bruno'),'/assets/seasons/cronicas/reverso/otro.png');assert.equal(ownerCardBack(state,'Unknown'),'/assets/Tesis-assets/cartas/reverso_idea.webp');
assert.equal(ownerCardBack({jugadores:[{...custom,cosmeticos:{reverso:cosmetic('avatar',back)}}]},'Ana'),'/assets/Tesis-assets/cartas/reverso_idea.webp');
console.log('Mesa: defaults, propietario, rutas locales, marco sólo avatar y privacidad de roles/manos PASS');
