# Comunidad en la portada

## Objetivo
Dar acceso directo desde inicio a Amigos, Ranking global y Misiones con diseño integrado en la academia. Mantener el botón actual de Mi perfil y los formularios de sala.

## Contexto
Inicio limpio en main 8297dba, nueva rama codex/inicio-comunidad. Comunidad y migración ya implementadas. Usuario autoriza equipo, push rama a personal/origin y merge main ambos tras validar.

## Reparto y contrato
- Diseño: nuevo js/home-community.js export homeCommunity(), CSS nuevo home-community.css e index.html para enlazar. Tres enlaces href #amigos/#ranking/#misiones, iconos SVG propios sin assets externos, textos de utilidad, clases home-community*. Sin acceso a datos ni peticiones.
- Integración: app.js y account-panel.js, nueva prueba de navegación si es útil. Insertar homeCommunity() en home-copy entre features y showcase SOLO inicio. Navegación hashes #perfil/#amigos/#ranking/#misiones, acceso directo/restauración/back/forward y retorno con foco. Mantener elección tras login de invitado, cancelar respuestas antiguas al cambiar sección/cuenta. Mi perfil abre perfil siempre. No tocar motor/API/polling.
- QA/revisión: tools/qa_home_community.mjs, pruebas navegador reales sobre código local con Auth/RPC simulados, revisar diff combinado de solo lectura y comunicar correcciones. Lead mantiene plan, integra y publica.

## Criterios
Tres accesos visibles en portada y cómodos por teclado/táctil; Mi perfil conserva estilo y posición. 1440/1024/768/390/360 px sin overflow/solapamiento, reducción movimiento. Rutas directas y recarga/history fiables. Invitado inicia sesión y llega destino solicitado. Disponibilidad/error de cuentas no permite mostrar datos privados. Crear/unirse/volver a sala conserva identidad.

## Plan
- [x] Inspección, rama y contrato.
- [x] Diseño e integración.
- [x] QA y revisión combinada.
- [x] Preparar publicación autorizada: remotos sincronizados, alcance y archivos revisados.

## Tests y estado
Las 10 suites Node pasan. `tools/qa_home_community.mjs` pasa 19 comprobaciones en Chrome con Auth/API simulados: cinco anchuras, geometría, teclado, rutas/historial/recarga, login con destino, fallos de cuentas y crear/unirse/volver a sala. `tools/qa_community.mjs` también pasa. Revisión independiente del diff combinado y archivos nuevos sin bloqueantes; `git diff --check` correcto. Capturas en `docs/qa/inicio-comunidad/` y resultados detallados en `target/qa-home-community/`.

No hay cambios backend ni reglas; no se repiten pruebas Java/SQL ni se aplica de nuevo la migración. Las pruebas de navegador no verifican Supabase remoto ni el despliegue de Render.

La revisión detectó que el nuevo control de operaciones podía ocultar el mensaje tras un login correcto con fallo al cargar perfil. Corregido: solo la transición de identidad del propio login conserva la operación; otra cuenta, cierre o cambio de ruta descarta respuestas anteriores. Dos pruebas específicas verifican el mensaje y que una respuesta anterior no sobrescriba la nueva cuenta. Repetidas las 10 suites Node y las 19 comprobaciones de navegador tras la corrección, todas correctas.

## Publicación
El usuario autoriza commit, push de `codex/inicio-comunidad` a personal/origin y merge a main en ambos. Antes de publicar, fetch confirma main local y ambos remotos en 8297dba. La entrega final registra los SHA verificados con `git ls-remote`; no se usa force ni se borran ramas.

## Ajuste de altura y cabecera
Petición posterior: evitar scroll de portada en ordenador y mover el logo a la cabecera para que no aparezca cortado junto a su línea. Rama `codex/inicio-sin-scroll`, desde main fc3a1ac. Cabecera y pie pasan a filas en flujo en escritorio; espacios, tipografía y decoración se adaptan a la altura. Hasta 650 px de alto se omiten las cartas decorativas y textos de presentación redundantes del formulario, manteniendo todos los accesos y controles. Mi perfil conserva el botón y el lobby conserva su composición.

Validación: 10 suites Node y 28 comprobaciones Chrome con Auth/HTTP simulados pasan. Se comprueba ausencia de scroll vertical en 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1152×648, 1024×768 y 1024×600, también este último con Volver a mi sala. El logo queda dentro de la cabecera, sin solapamiento con el contenido; revisión visual de 1366×768, 1024×600 y móvil 390 px. Mantiene pruebas de navegación, teclado, sesión y salas. Diff revisado sin bloqueantes. Capturas actualizadas en docs/qa/inicio-comunidad. Publicación y fusión en ambos remotos autorizadas; SHA finales en la entrega.
