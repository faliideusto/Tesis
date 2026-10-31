// node --experimental-vm-modules tests/ranking.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({Intl,Date});
const modules=new Map();
async function module(name){if(modules.has(name))return modules.get(name);const item=new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context});modules.set(name,item);await item.link(spec=>module(spec.replace('./','')));await item.evaluate();return item;}
const {rankingView,rankingPeriodLabel}=(await module('ranking-panel.js')).namespace;
const hostile='<img src=x onerror="bad()">';
const entries=[{posicion:1,codigo:'A',nombre:hostile,nivel:20,xp:100,victorias:1,partidas:2},{posicion:2,codigo:'B',nombre:'Dos',nivel:10,xp:50,victorias:0,partidas:1},{posicion:3,codigo:'C',nombre:'Tres',nivel:5,xp:0,victorias:0,partidas:0},{posicion:4,codigo:'D',nombre:'Mi cuenta',nivel:1,xp:0,victorias:0,partidas:0,yo:true}];
const profile={nivel:1,xp:350,victorias:4,partidasTerminadas:12};
const result=rankingView({entradas:entries,propia:entries[3]},'victorias',{ambito:'semanal',profile});
assert.ok(!result.includes('<img src=x'));
assert.ok(result.indexOf('podium-place-2')<result.indexOf('podium-place-1'),'Podio visual segundo, primero, tercero');
assert.ok(result.indexOf('podium-place-1')<result.indexOf('podium-place-3'));
assert.match(result,/data-ranking-scope="semanal" aria-current="page"/);
assert.match(result,/option value="victorias" selected/);
assert.match(result,/ranking-self/);assert.match(result,/Rango<\/th>/);
assert.match(result,/350 \/ 500 XP/,'El progreso conserva XP vitalicia en un ranking semanal sin XP propia');
assert.match(result,/data-public-profile="A"/);assert.match(result,/Distinción Postdoctoral/);
const zero=rankingView({entradas:[],propia:null});assert.ok(!zero.includes('podium-place-1'));assert.match(zero,/aún no tiene investigadores/);assert.match(zero,/Tu posición aparecerá/);
const one=rankingView({entradas:entries.slice(0,1),propia:null},'xp',{profile});assert.ok(one.includes('podium-place-1'));assert.ok(!one.includes('podium-place-2'));
const tied=rankingView({entradas:[entries[0],{...entries[1],posicion:1}],propia:null});assert.equal((tied.match(/aria-label="Posición 1"/g)||[]).length,2,'Empates de posición conservan la posición entregada por el servidor');
const period={inicio:'2026-10-01T00:00:00+02:00',fin:'2026-11-01T00:00:00+01:00'};
const now=Date.parse('2026-10-07T12:00:00Z');assert.match(rankingPeriodLabel(period,'temporada',now),/Temporada de 3 meses/);assert.match(rankingPeriodLabel(period,'temporada',now),/24 días · 11 h · 0 min · 0 s restantes/);assert(!rankingPeriodLabel(period,'temporada',now).includes('Madrid'));assert.match(rankingView({entradas:[],periodo:period},'xp',{ambito:'semanal'}),/data-countdown-end="2026-11-01T00:00:00\+01:00"/);assert.equal(rankingPeriodLabel(period,'global'),'');assert.equal(rankingPeriodLabel({inicio:'invalid',fin:'invalid'},'semanal'),'');
console.log('Ranking: ámbitos, countdown servidor, escape, podio real, rangos vitalicios y vacíos verificados');
