export const asset = path => `/assets/Ciudadelas-assets/${path}`;
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const img = (path, cls = '', alt = '') => `<img class="${cls}" src="${asset(path)}" alt="${esc(alt)}" draggable="false">`;
export function update(id, html) {
  const element = document.getElementById(id);
  if (element && element.innerHTML !== html) element.innerHTML = html;
}
export const resource = (name, value, label) => `<span class="resource" data-tip="${esc(label)}">${img(`recursos/${name}.png`)}<b>${esc(value)}</b><span class="sr-only"> ${esc(label)}</span></span>`;
