# Rediseño integral del inicio 2.4.0

## Objetivo
Renovar inicio y todas sus secciones con navegación clara, matchmaking separado de salas privadas, slogans conservados y sin scroll de página en ordenadores y portátiles.

## Contexto
Árbol inicialmente limpio en main ce07135 (merge matchmaking v2.3.0). release/v2.3.0 actualizada mediante fast-forward al mismo commit como punto de retorno; nueva release/v2.4.0 desde ese estado. No se harán commits ni publicación no solicitados.

## Alcance y áreas
Inicio en app.js/home-community.js, nuevos estilos home-v240.css/academy-v240.css e index.html. Revisar perfil, amigos, ranking, misiones, autenticación, registro, recuperación, ayuda, salas privadas, matchmaking y reanudación. Motor, API y juego fuera de alcance.

## Fuente de verdad
Los módulos app.js, account-panel.js, community-panel.js, auth.js y matchmaking.js gobiernan navegación existente. El motor Java conserva autoridad sobre reglas. Reutilizar assets de producción, no las cartas ficticias de la referencia.

## Plan
- [x] Inspeccionar estado y guardar versión estable y rama siguiente.
- [x] Acordar división y contrato DOM.
- [x] Implementar estructura de inicio y separación de modos.
- [x] Implementar diseño visual de inicio y secciones.
- [x] Integrar y validar rutas, formularios, foco y geometría.
- [x] Revisar diff combinado y actualizar evidencia.

## Equipo
| Agente | Propiedad exclusiva | Contrato | Aceptación |
| --- | --- | --- | --- |
| home_structure | app.js, home-community.js | home-hub/home-layout/sidebar/copy/setup-panel, IDs API existentes | Todas rutas y modos accesibles, sin cambiar polling/privacidad |
| home_visual | home-v240.css, index.html | Clases acordadas con home_structure | Sin scroll desktop, responsive móvil, cartas reales |
| community_visual | academy-v240.css; account-panel.js/community-panel.js si necesario | IDs/handlers/hash intactos | Todas secciones y autenticación revisadas |
| Lead | Plan, integración, QA y revisión | Sin escritores simultáneos en áreas compartidas | Evidencia y correcciones proporcionales |

## Criterios de aceptación
Slogans «La diferencia está en la ciencia» y «Construye tu legado científico.» preservados. Buscar partida y salas privadas separados. Accesos a perfil, amigos, ranking, misiones, ayuda/login y reanudación. Desktop 1024x600, 1280x720, 1366x768, 1440x900 y 1920x1080 sin scroll de página ni cortes; móvil sin overflow horizontal. Datos largos pueden necesitar scroll dentro de su lista. Formularios y foco accesibles. Sin cambios de reglas ni autenticación/API.

## Tests y evidencia
Automático: las 11 suites Node (`node --experimental-vm-modules`) pasan. Navegador: `node tools/qa_home_community.mjs` pasa 105 comprobaciones con Chrome real y HTTP/Auth simulados, 8 resoluciones de escritorio (1920x1080,1536x864,1440x900,1366x768,1280x720,1152x648,1024x768,1024x600), 390x844/360x740 móvil, modos separados, todas rutas, foco, controles accesibles incluso dentro de listas, ausencia de solapes y scroll de página desktop, login/registro móvil, regreso tras login, reload, historial, borrador, crear/unirse/reanudar y errores/deshabilitado. Fixtures incluyen 12 amigos, solicitudes, ranking50, seis misiones.

Navegador + servidor Java real: `node tools/qa_matchmaking.mjs` pasa colas de3/4/5, cancelación, recarga, confirmación exacta, entrada al tablero e identidad por pestaña. Prueba independiente del especialista: perfil de rango eterno con nombre largo y editor en1024x600/1366x768/1920x1080/390x844.

Manual: revisadas capturas de inicio, perfil, amigos, login y editor; corregidos solapes de perfil y footer de inicio. Estática: `git diff --check`, revisión de archivos nuevos y diff combinado, sin bloqueantes.

Entorno: `mvn compile exec:java` falló por repositorio local C:\\.m2 no escribible. Arranque alternativo exitoso con `java -cp 'src/main/resources;target/classes;target/lib/*' es.tesis.web.ServidorWeb` en127.0.0.1:8091 usando clases existentes. Playwright reutilizado del runtime, sin instalar dependencias. No ejecutado mvn test (sin cambios Java), ni Supabase remoto ni partida completa; QA matchmaking verifica hasta selección real. Evidencias en target/qa-home-v240 y target/qa-matchmaking, ignoradas por Git.

## Riesgos
CSS histórico acumulado y selectores compartidos; estilos nuevos cargados al final y limitados al inicio/cuentas. Modos privados cambian DOM de formularios y requieren actualizar QA que asumía ambos visibles simultáneamente.

## Estado
El usuario autoriza commit, push de release/v2.4.0 y respaldo release/v2.3.0 a origin, e integración y push de main. Validaciones del rediseño completadas antes de esta publicación; comprobar referencias remotas al finalizar.
Seguimiento solicitado: ampliado menú lateral hacia la derecha de170 a230px (portátiles210px), y panel de juego hacia la izquierda de350 a410px (portátiles340px). Se conservan estilos móviles. QA completa de105 comprobaciones repetida tras ambos ajustes: PASS; captura1024x600 revisada y git diff --check limpio.

Terminado. Tres agentes implementaron áreas independientes; Lead integró y comprobó resultado. release/v2.3.0 permanece en ce07135; el rediseño se entrega en release/v2.4.0 y se integra en main por petición del usuario. No existen créditos independientes ni recuperación pública de contraseña; acceso mantiene explicación existente. README y comando QA público actualizados.
