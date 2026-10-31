// Disposición de la partida para móviles táctiles.
// Solo se activa en teléfonos (puntero táctil sin hover y pantalla pequeña):
// en ordenador no añade clases, botones ni estilos.
const root = document.documentElement;
const PORTRAIT_OK = 'tesis.vertical';

export function isMobileDevice(win = window) {
  const touch = win.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  const shortSide = Math.min(win.screen?.width || 0, win.screen?.height || 0);
  return Boolean(touch && shortSide > 0 && shortSide <= 600);
}

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canFullscreen = () => Boolean(root.requestFullscreen || root.webkitRequestFullscreen);

async function enterLandscape() {
  try {
    if (!fullscreenElement()) {
      if (root.requestFullscreen) await root.requestFullscreen({navigationUI:'hide'});
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    }
  } catch { /* El navegador puede negarlo; seguimos con el giro. */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* iOS y algunos navegadores no permiten bloquear. */ }
}

async function exitFullscreen() {
  try { screen.orientation?.unlock?.(); } catch { /* sin bloqueo activo */ }
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else document.webkitExitFullscreen?.();
  } catch { /* ya no estaba en pantalla completa */ }
}

function syncButton() {
  const active = Boolean(fullscreenElement());
  for (const button of document.querySelectorAll('.mobile-fullscreen')) {
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Pantalla completa en horizontal');
    button.querySelector('span').textContent = active ? '⤡' : '⤢';
  }
}

function fullscreenButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mobile-fullscreen';
  button.dataset.mobile = 'fullscreen';
  button.innerHTML = '<span aria-hidden="true">⤢</span>';
  return button;
}

function rotatePrompt() {
  const prompt = document.createElement('div');
  prompt.className = 'mobile-rotate';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Gira el móvil para jugar');
  prompt.innerHTML = `<div class="mobile-rotate-card"><span class="mobile-rotate-icon" aria-hidden="true">📱</span>
    <strong>Gira el móvil</strong><p>La mesa se juega mejor en horizontal y sin hacer scroll.</p>
    ${canFullscreen() ? '<button type="button" class="gold-button" data-mobile="landscape">Pantalla completa en horizontal</button>' : '<p class="mobile-rotate-tip">Pon el móvil en horizontal. Para ocultar la barra del navegador, añade Tesis a tu pantalla de inicio.</p>'}
    <button type="button" class="text-button" data-mobile="portrait">Seguir en vertical</button></div>`;
  return prompt;
}

function refresh() {
  const board = document.getElementById('board');
  root.classList.toggle('tesis-in-game', Boolean(board));
  const utility = board?.querySelector('.utility');
  if (utility && !utility.querySelector('.mobile-fullscreen') && canFullscreen()) {
    utility.prepend(fullscreenButton());
    syncButton();
  }
}

export function initMobileGame() {
  if (!isMobileDevice()) return false;
  root.classList.add('tesis-mobile');
  try { if (sessionStorage.getItem(PORTRAIT_OK) === '1') root.classList.add('tesis-portrait-ok'); } catch { /* almacenamiento bloqueado */ }
  document.body.append(rotatePrompt());
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-mobile]');
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    const command = control.dataset.mobile;
    if (command === 'landscape') void enterLandscape();
    if (command === 'fullscreen') void (fullscreenElement() ? exitFullscreen() : enterLandscape());
    if (command === 'portrait') {
      root.classList.add('tesis-portrait-ok');
      try { sessionStorage.setItem(PORTRAIT_OK, '1'); } catch { /* almacenamiento bloqueado */ }
    }
  }, true);
  document.addEventListener('fullscreenchange', syncButton);
  document.addEventListener('webkitfullscreenchange', syncButton);
  new MutationObserver(refresh).observe(document.getElementById('app'), {childList:true, subtree:true});
  refresh();
  return true;
}

if (typeof document !== 'undefined' && document.getElementById?.('app')) initMobileGame();
