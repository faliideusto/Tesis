async function request(path, body) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : {'Content-Type':'application/json', 'X-Ciudadela':'1'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la solicitud.');
    error.status = response.status; throw error;
  }
  return data;
}
export const api = {
  config: () => request('config'), state: () => request('game/state'),
  create: nombres => request('game', {nombres}),
  reveal: revision => request('game/reveal', {revision}),
  lock: revision => request('game/lock', {revision}),
  action: (revision, tipo, option = {}) => request(tipo === 'SELECCIONAR' ? 'game/select-role' : 'game/action', {revision, tipo, ...option})
};
