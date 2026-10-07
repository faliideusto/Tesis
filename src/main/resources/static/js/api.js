import {accounts} from './auth.js';
const KEY = 'tesis.sala';
let identity;
const MATCH_KEY = 'tesis.matchmaking';
let matchIdentity;
try { matchIdentity = JSON.parse(sessionStorage.getItem(MATCH_KEY) || 'null'); } catch { matchIdentity = null; }
try { identity = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { identity = null; }
let queue = Promise.resolve();
function searchToken() {
  // getRandomValues también funciona al jugar por HTTP dentro de la red local.
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function request(path, body, authenticated = false, account = false, token = null, independent = false) {
  const task = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = body === undefined ? {} : {'Content-Type':'application/json', 'X-Tesis':'1'};
      if (authenticated && identity) headers.Authorization = `Bearer ${identity.playerToken}`;
      if (token) headers.Authorization = `Bearer ${token}`;
      if (account) {
        const actor=accounts.identity?.();
        const token=await accounts.accessToken();
        if(independent&&actor!==accounts.identity?.())throw new Error('La cuenta ha cambiado. Vuelve a abrir tu sesión.');
        if (token) headers['X-Tesis-Account-Authorization']=`Bearer ${token}`;
      }
      const response = await fetch(`/api/${path}`, {
        method: body === undefined ? 'GET' : 'POST', cache:'no-store', headers,
        signal:controller.signal, body:body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la solicitud.'); error.status=response.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  };
  if(independent)return task();
  const result = queue.then(task, task); queue = result.catch(() => {}); return result;
}
async function enter(path, nombre) {
  const access = await request(path, {nombre},false,true);
  return accept(access);
}
function accept(access) {
  identity = {codigo:access.codigo, playerToken:access.playerToken};
  sessionStorage.setItem(KEY, JSON.stringify(identity));
  return access.sala;
}
const route = suffix => `salas/${encodeURIComponent(identity.codigo)}/${suffix}`;
export const api = {
  matchIdentity: () => matchIdentity,
  matchForget: () => { matchIdentity=null; sessionStorage.removeItem(MATCH_KEY); },
  matchSearch: (nombre,jugadores) => {
    if (matchIdentity) throw new Error('Ya tienes una búsqueda pendiente. Recupérala o cancélala primero.');
    matchIdentity={token:searchToken(),nombre,jugadores};
    sessionStorage.setItem(MATCH_KEY,JSON.stringify(matchIdentity));
    return request('matchmaking',{nombre,jugadores},false,true,matchIdentity.token);
  },
  matchState: () => request('matchmaking/estado',undefined,false,false,matchIdentity?.token),
  matchConfirm: grupo => request('matchmaking/confirmar',{grupo},false,false,matchIdentity?.token),
  matchCancel: () => request('matchmaking/cancelar',{},false,false,matchIdentity?.token),
  matchAccept: access => { const sala=accept(access); api.matchForget(); return sala; },
  identity: () => identity,
  forget: () => { identity=null; sessionStorage.removeItem(KEY); },
  create: nombre => enter('salas',nombre),
  join: (codigo,nombre) => enter(`salas/${encodeURIComponent(codigo.trim().toUpperCase())}/unirse`,nombre),
  inviteFriend: codigo => request(route('invitar'),{codigo},true,true),
  acceptInvitation: async id => {
    const token=await accounts.accessToken(), actor=accounts.identity();
    if(!token)throw new Error('Inicia sesión para aceptar la invitación.');
    const access=await request(`invitaciones/${encodeURIComponent(id)}/aceptar`,{},false,false,token);
    if(actor!==accounts.identity()||!accounts.signedIn())throw new Error('La cuenta ha cambiado. Vuelve a abrir tu sesión.');
    return accept(access);
  },
  state: () => request(route('estado'),undefined,true),
  interacciones: desde => request(route(`interacciones${desde===undefined?'':`?desde=${encodeURIComponent(desde)}`}`),undefined,true,false,identity?.playerToken,true),
  interactuar: (interactionId,objetivo) => request(route('interacciones'),{interactionId,objetivo},true,true,identity?.playerToken,true),
  start: revision => request(route('iniciar'),{revision},true),
  action: (revision,tipo,option={}) => request(route('accion'),{revision,tipo,...option},true)
};
