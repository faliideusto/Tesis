---
name: tesis-frontend
description: "Modificar HTML, CSS, módulos JavaScript y UX de Tesis: tablero, cartas, controles, feedback, accesibilidad y adaptación móvil."
---

# Frontend y UX de Tesis

Leer `AGENTS.md`. Frontend sin framework ni pipeline npm en `src/main/resources/static/`:

- `index.html` carga `css/game.css`, `effects.css`, `table.css` y `js/app.js`; verificar imports antes de asumir que una hoja como `cards.css` está activa.
- `app.js`: navegación, lobby, acciones, polling y cola visual; `api.js`: HTTP, revisión de sala e identidad.
- `board.js`, `players.js`, `cards.js`: tablero, academias, estudios y cartas; `dialogs.js`, `decisions.js`: consultas y confirmaciones.
- `feedback.js`, `effects.js`: narración, avisos y animaciones; `dom.js`: escape, rutas y actualización DOM.
- `assets/Tesis-assets/`: WebP y referencias PNG; mantener mayúsculas exactas e identidad visual existente.

## Respetar el contrato

El motor Java gobierna reglas. Consumir acciones/opciones/motivos/previsualizaciones del servidor. No reimplementar validación crítica ni decidir costes, publicación, turno o inmunidad desde JS. Si faltan datos, proponer al Lead el DTO requerido y coordinar con backend; no inferir una regla nueva.

El usuario local (`yo`) y el jugador actual (`actual`) son distintos. No mostrar manos/roles privados ajenos ni recuperar información que el servidor ocultó. Revisar datos recibidos y eventos además de lo renderizado. La revisión enviada es la exterior de sala y los índices pertenecen a esa perspectiva/revisión.

Conservar `sessionStorage` por pestaña, peticiones encoladas, timeout, generaciones de polling y descarte de respuestas antiguas. No reintentar acciones automáticamente tras fallo ambiguo. Un cambio de revisión invalida decisiones; las consultas informativas mantienen su snapshot/aviso. No cerrar modales ni repetir animaciones por polling sin cambios. Las animaciones no mutan la partida y deben tolerar cancelación y movimiento reducido.

## Validar y entregar

Usar `dom.js` para escape de contenido y componentes existentes para cartas/estudios. Comprobar teclado/foco, etiquetas, estados deshabilitados, pantallas pequeñas, scroll, solapamientos y feedback de reconexión cuando corresponda.

Ejecutar las pruebas Node relevantes de `tests/*.test.mjs` con `node --experimental-vm-modules`; son contratos DOM simulados, no evidencia de geometría real. Para cambios visuales relevantes, usar navegador y los scripts existentes de `tools/` con servidor/Playwright/Chrome disponibles; `qa_multiplayer.mjs` cubre juego por identidades, `qa_article_boxes.mjs` geometría. No introducir framework nuevo por defecto. Comunicar rutas tocadas, contrato requerido, resoluciones comprobadas, resultados y escenarios no ejecutados.
