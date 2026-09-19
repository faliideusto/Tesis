const KEY = 'tesis.sala';
let identity;
try { identity = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { identity = null; }
let queue = Promise.resolve();
function request(path, body, authenticated = false) {
  const task = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = body === undefined ? {} : {'Content-Type':'application/json', 'X-Tesis':'1'};
      if (authenticated && identity) headers.Authorization = `Bearer ${identity.playerToken}`;
      const response = await fetch(`/api/${path}`, {
        method: body === undefined ? 'GET' : 'POST', cache:'no-store', headers,
        signal:controller.signal, body:body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'No se pudo completar la solicitud.'); error.status=response.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  };
  const result = queue.then(task, task); queue = result.catch(() => {}); return result;
}
async function enter(path, nombre) {
  const access = await request(path, {nombre});
  identity = {codigo:access.codigo, playerToken:access.playerToken};
  sessionStorage.setItem(KEY, JSON.stringify(identity));
  return access.sala;
}
const route = suffix => `salas/${encodeURIComponent(identity.codigo)}/${suffix}`;
export const api = {
  identity: () => identity,
  forget: () => { identity=null; sessionStorage.removeItem(KEY); },
  create: nombre => enter('salas',nombre),
  join: (codigo,nombre) => enter(`salas/${encodeURIComponent(codigo.trim().toUpperCase())}/unirse`,nombre),
  state: () => request(route('estado'),undefined,true),
  start: revision => request(route('iniciar'),{revision},true),
  action: (revision,tipo,option={}) => request(route('accion'),{revision,tipo,...option},true)
};
