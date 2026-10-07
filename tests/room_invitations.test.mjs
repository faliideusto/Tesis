// node --experimental-vm-modules tests/room_invitations.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({setTimeout,clearTimeout,Intl,Date});
const modules=new Map();
async function module(name){if(modules.has(name))return modules.get(name);const item=new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context});modules.set(name,item);await item.link(spec=>module(spec.replace('./','')));await item.evaluate();return item;}
const {onlineFriends,roomFriendsView,invitationInboxView,createRoomInvitations}=(await module('room-invitations.js')).namespace;
const hostile='<img src=x onerror="bad()">';
const data={presenciaDisponible:true,amigos:[{codigo:'A',nombre:hostile,nivel:10,enLinea:true},{codigo:'B',nombre:'Desconectado',nivel:1,enLinea:false}]};
assert.equal(onlineFriends(data).length,1);assert.equal(onlineFriends({...data,presenciaDisponible:false}).length,0);assert.equal(onlineFriends({...data,presenciaDisponible:undefined}).length,0);
const friends=roomFriendsView(data,{expanded:true,statuses:{A:{busy:true,message:hostile}}});assert.ok(!friends.includes('<img src=x'));assert.ok(!friends.includes('Desconectado'));assert.match(friends,/data-room-invite-send="A" disabled/);assert.match(friends,/data-public-profile="A"/);
assert.match(roomFriendsView(data),/Invitar amigos/);assert.ok(!roomFriendsView(data).includes('data-room-invite-send'));
const item={id:hostile,codigoSala:hostile,nombreAnfitrion:hostile};assert.ok(!invitationInboxView([item]).includes('<img src=x'));assert.match(invitationInboxView([{id:'one',codigoSala:'ABC',nombreAnfitrion:'Ana'}],'one'),/data-room-invitation-accept="one" disabled/);
let identity='one',finish,reads=0,changed,unsubscribed=false;const account={signedIn:()=>identity!==null,identity:()=>identity,onChange:callback=>{changed=callback;return()=>{unsubscribed=true;};},invitations:()=>{reads++;return new Promise(resolve=>finish=resolve);}};
const tasks=[],controller=createRoomInvitations({accounts:account,api:{},getRoom:()=>null,document:null,schedule:fn=>{tasks.push(fn);return tasks.length;},cancel(){}});
const first=controller.refreshInbox();await Promise.resolve();await controller.refreshInbox();assert.equal(reads,1,'Las lecturas concurrentes no se superponen');identity='two';finish({invitaciones:[{id:'old',codigoSala:'ABC',nombreAnfitrion:'Cuenta anterior'}]});await first;
const second=controller.refreshInbox();await Promise.resolve();assert.equal(reads,2);controller.destroy();finish({invitaciones:[]});await second;
assert.equal(unsubscribed,true,'Destroy elimina la suscripción a cambios de cuenta');
const callbacks=[];let visibleReads=0;
const immediate=createRoomInvitations({accounts:{signedIn:()=>identity!==null,identity:()=>identity,onChange:callback=>{changed=callback;return()=>{};},invitations:async()=>{visibleReads++;return {invitaciones:[]};}},api:{},document:null,schedule:fn=>{callbacks.push(fn);return callbacks.length;},cancel(){}});
identity='three';changed();await Promise.resolve();assert.equal(visibleReads,1,'Cambio de cuenta consulta la identidad nueva inmediatamente');identity=null;changed();await Promise.resolve();assert.equal(visibleReads,1,'Cerrar sesión deja de consultar invitaciones');immediate.destroy();
console.log('Invitaciones: presencia real, escape, límites de UI, lecturas concurrentes y cambio de identidad verificados');
