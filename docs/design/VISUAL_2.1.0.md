# Dirección visual 2.1.0

Paleta: tinta azul, cobre, marfil y verde mineral. Portada editorial con biblioteca nocturna, personajes en abanico, acceso destacado y lobby con lista legible. Mesa con superficies limpias y profundidad; cartas e ilustraciones originales conservadas.

La frase principal conserva «Construye tu legado científico.». El acceso «Mi perfil» permanece visible en escritorio y móvil. Perfil con carnet, tarjetas de estadísticas, progreso y siete rangos; acceso y registro con formularios en marfil. El servidor sin cuentas muestra un estado explícito y el catálogo de distinciones, sin simular identidad ni progreso.

## Asset propio

`src/main/resources/static/assets/Tesis-assets/visual-v2/academy-night.webp` — 1672 × 940, WebP, 233 246 bytes. Generado con la herramienta integrada ImageGen; convertido a WebP con Pillow, calidad 88. No incorpora textos ni controles: la interfaz es HTML real.

Prompt de generación:

> Use case: stylized-concept. Asset type: wide cinematic background artwork for the landing page of Tesis, an academic research strategy card game. Scene: a magnificent university library at blue hour, towering dark walnut bookshelves and tall arched windows, deep midnight blue atmosphere, glowing amber desk lamps, a polished research desk with papers, open book, brass microscope and an orrery subtly on the right. Style: sophisticated realistic painterly concept art, extraordinarily detailed materials, premium board game illustration. Composition: wide 16:9 landscape; the left third mostly dark and tranquil negative space for live HTML heading; architectural depth and warm pools of light concentrated center-right; no people. Palette: ink navy, muted teal, antique copper, restrained ivory. Lighting: volumetric shafts of cool moonlight and warm brass lamps, quiet intellectual wonder. Constraints: no text, no letters, no UI, no logos, no card frames, no watermark. This is only background art, not a UI screenshot. Save the generated artifact and return its filesystem path if available.

## Evidencia

El retrato reservado usa `src/main/resources/static/assets/Tesis-assets/visual-v2/reserved-scholar.webp` (256 × 256, 5 990 bytes). Sustituye el reverso de carta recortado por un libro y una estrella, sin texto ni pistas del personaje. Generado con ImageGen integrado y optimizado con Pillow. El rol revelado conserva su ilustración original.

Prompt del retrato:

> Use case: stylized-concept. Asset type: small square avatar emblem for a hidden, not yet revealed player character in the academic research card game Tesis. Primary request: an elegant, extremely readable academic insignia: a single open ivory book with a small five-point copper guiding star hovering above it, finely engraved three-dimensional brass and ivory relief on a smooth deep midnight navy background. Centered symmetrical composition, strong simple silhouette, fills central 65 percent of square with generous breathing room, designed to remain legible at only 48px. Premium restrained materials, soft warm lighting, subtle realistic depth. Palette navy #0a1825, warm ivory #f4ead9 and antique copper #c39870. Constraints: no letters, no text, no logos, no human face, no character clues, no ribbon, no tiny ornament, no laurel, no extra symbols, no border or frame (CSS supplies a circular rim), no watermark. Clean square artwork, background dark navy everywhere.

El script `tools/qa_visual_v210.mjs` captura inicio, ayuda, lobby, selección, mesa y detalle de carta con tres identidades reales. Resultados y capturas en `target/qa-v210/` (archivos de QA ignorados por Git). Las capturas con fixtures de geometría se guardan separadamente en `target/qa-article-boxes/`.

La galería `target/qa-v210/report.html` reúne las comparaciones de antes/después y distingue datos de ejemplo de las partidas reales. Para reproducir, arrancar servidor en 8091 y ejecutar `node tools/qa_visual_v210.mjs` con `PLAYWRIGHT_MODULE` apuntando a una instalación existente si no hay paquete local. `TESIS_VISUAL_BASELINE=1` sirve los recursos de HEAD mediante interceptación de navegador; `TESIS_VISUAL_OUT=target/qa-v210/before` separa sus resultados.

`tools/qa_academy_v210.mjs` verifica acceso visible, navegación y estado real de cuentas; los escenarios habilitados usan SDK y configuración simulados y datos de perfil de ejemplo. No realiza llamadas externas. Sus 14 capturas y resultados están en `target/qa-v210/academy/report.html`.

## Validación automática y revisión

- `mvn test`: correcto; sin cambios Java en este trabajo.
- Siete suites `tests/*.test.mjs` con `node --experimental-vm-modules`: correctas.
- Flujo Chrome real con tres identidades: crear, unirse, lobby, seleccionar personaje, turno y consultar carta; sin errores JavaScript ni desbordamiento horizontal.
- Revisión estática: plantillas conservan IDs, nombres de formulario, comandos y escape de jugadores; hojas de efectos originales sin editar.
- La prueba anterior `tools/qa_article_boxes.mjs` falla por `heading clipped` y un solapamiento academia/mano en 1920 × 1080. La misma configuración con recursos originales de HEAD reproduce ambos fallos. No se eliminaron ni modificaron sus aserciones. La nueva comprobación visual valida encabezados con el DOM actual, donde se encuentran dentro del soporte.
- 54 fixtures de mesa en 1920/1366/1024/768/390/360 px, para 3/4/5 jugadores y 0/3/10 artículos: sin overflow horizontal. Los 42 avisos de cobertura de encabezados coinciden exactamente entre la presentación original y la nueva; se conservan en `fixture-findings.json` como diagnóstico pendiente del layout anterior.
- Academia: teclado, Escape, hash #perfil, regreso y foco; perfiles Madera/Oro/Eterno y acceso/registro en escritorio y móvil. Los escenarios habilitados están simulados; el servidor real de pruebas devuelve cuentas deshabilitadas.

No se verificó acceso a cuentas externas de Supabase ni una partida completa hasta victoria. El escenario de tres jugadores es real; las composiciones para otros tamaños de mesa usan datos de ejemplo y no acreditan partidas reales con cuatro o cinco personas.

## Límites del cambio

Hover del personaje propio: el botón coincide con la superficie visible de la placa (`inset: 0 0 25%`) y el resaltado se dibuja en el mismo pseudo-elemento que su borde. Se elimina el segundo rectángulo interior desalineado. Verificado en Chrome a 1920/1366/390/360 px, conservando vista previa con ratón y teclado. Captura en `target/qa-v210/badge-hover/hover-desktop.png`.

Ajuste posterior solicitado: retrato y bloque de texto centrados respecto a la superficie visible de la placa (75 % de su caja); rayos ampliados a 15–22 × 22–31 px y desplazados a la derecha. Validación Chrome sobre 10 composiciones visuales de 3/5 jugadores en 1920/1366/768/390/360 px: centrado, separación del borde inferior y tamaño de rayos correctos. Capturas de detalle en `target/qa-v210/badges/`. Solo cambia premium.css.

Sin cambios de motor, API, autenticación, privacidad, revisión de sala o polling. Los templates de inicio/lobby conservan los formularios y comandos existentes; las hojas nuevas se cargan después de las actuales. Las animaciones decorativas nuevas respetan movimiento reducido.

## Ajustes de mesa tras revisión del usuario

Los marcos de personajes incorporan doble moldura de latón y esquinas grabadas. `visual-v2/frame-academia.svg` es la fuente vectorial; `frame-academia.webp` es su exportación transparente para el servidor actual. La superficie conserva el mismo contorno de hover.

Se recupera la imagen del tablero sin velos oscuros ni viñeta añadida, y se elimina la línea inferior del encabezado. En escritorio el botón TESIS coincide con el emblema pintado en el fondo (16 vw × 10 svh, centrado, a 3 svh del borde superior), con indicación de ratón y foco.

La petición final sustituye el diseño con desplazamiento horizontal: todas las cartas de cada zona se muestran simultáneamente. `tableStudies` informa únicamente de la cantidad de artículos públicos de esa zona; CSS reparte el ancho disponible entre ellos, con separación decreciente y un máximo según viewport y número de jugadores. No hay huecos adicionales cuando existen cartas. Las zonas vacías muestran dos huecos decorativos. El tamaño se calcula independientemente para desarrollo/publicaciones y para cada academia; la consulta de cada carta y sus índices se conservan. Las filas laterales de cuatro y cinco jugadores se separan de los estudios propios para evitar que sus soportes se cubran.

Validación final de este ajuste: siete suites Node aprobadas y revisión estática sin bloqueantes. `qa_ornate_v210.mjs` verifica 147 composiciones Chrome con datos de ejemplo: 1920×1080, 1918×944, 1366×768, 1024×768, 768×1024, 390×844 y 360×800; 3/4/5 jugadores; 0/1/2/3/6/10/20 cartas por zona. Cero fallos en contención y visibilidad horizontal de todas las cartas, tamaño no creciente al añadirlas, contacto entre soportes propios/rivales o crónica, vista previa y acceso al emblema. Galería actual en `target/qa-v210/ornate/report.html`; el escenario de 20 cartas es una prueba extrema de distribución, sin acreditar una partida real con esa cantidad.

Seguimiento de recursos: prestigio en la fila superior, a la derecha del nombre; fila inferior solo monedas e ideas en mano. Se reserva separación con los rayos y los nombres largos se truncan. Dos selectores de destino en `effects.js` pasan a apuntar explícitamente al recurso inferior para conservar la animación de monedas tras reordenar el DOM; tiempos, trayectorias y reglas de animación intactos. Pruebas de selección y 18 pruebas de efectos aprobadas.

Botones de acciones: término medio solicitado entre el marco ilustrado anterior y la claridad del nuevo diseño. Contorno dorado biselado con esquinas angulares y grabados finos dibujados en CSS/SVG, conservando el área interior, iconos grandes y tipografía de interfaz. Superficie ámbar para terminar turno y violeta para habilidad. Solo cambia `premium.css`; estados y eventos intactos. QA Chrome: 15 escenarios (1920/1366/1024/390/360 px; estados disponibles, no disponibles y resultado de partida), texto contenido, separación entre icono y etiqueta, foco de teclado y hover comprobados. Capturas en `target/qa-v210/action-bar/`.
