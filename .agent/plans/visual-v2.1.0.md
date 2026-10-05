# Tesis 2.1.0 — renovación visual

## Objetivo
Renovar de forma sustancial portada, lobby, mesa, selección y diálogos; entregar capturas reales del resultado en escritorio y móvil.

## Contexto
Inicio sobre main sin cambios locales. Rama inicial codex/v2.1.0 renombrada a release/v2.1.0 por petición explícita del usuario. Versión Maven inicial 2.0.0. Frontend sin framework.

## Alcance
Templates de portada/lobby, nuevas hojas CSS, arte propio para portada, integración y versión 2.1.0. Nuevas animaciones decorativas accesibles.

## Fuera de alcance
Motor Java, reglas, DTOs, identidad/API, polling y efectos existentes. Sin commit, merge ni publicación.

## Áreas afectadas
src/main/resources/static/{index.html,css,js/app.js,assets/Tesis-assets/visual-v2}; pom.xml; tools/qa_visual_v210.mjs.

## Fuente de verdad
Motor Java actual; no se modifica ninguna regla. API y renderers actuales se mantienen.

## Plan de implementación
- [x] Inspección y contratos; rama.
- [x] Implementación visual y assets.
- [x] Integración y validación proporcional.
- [x] Revisión del resultado combinado y capturas.

## División multiagente
| Especialista | Responsabilidad | Área exclusiva | Contrato | Aceptación |
| --- | --- | --- | --- | --- |
| portada | Portada/lobby | Templates app.js y landing.css | IDs y handlers conservados; no lógica | Escritorio y móvil accesibles |
| mesa | Partida y overlays | premium.css nuevo | Geometría/efectos/privacidad intactos | Jerarquía y contraste mejorados |
| QA | Baseline, escenarios y revisión | tools/qa_visual_v210.mjs | No frontend ni backend | Capturas y resultados verificables |
| Lead | Arte, integración y versión | index.html, assets visual-v2, pom.xml, plan | Hojas cargadas tras existentes | Resultado combinado revisado |

## Criterios de aceptación
Portada nueva con arte propio y animaciones decorativas; lobby y partida coherentes; efectos anteriores preservados; sin cambios de reglas ni API; responsive y movimiento reducido; capturas actuales e informe de validación.

## Tests
`mvn test`: 176 tests aprobados en el log de esta ejecución (otros XML antiguos permanecen en target). Siete suites Node aprobadas con `node --experimental-vm-modules`. Chrome: flujo real de tres identidades hasta turno y consulta de carta; 14 capturas generales más detalle de avatar; movimiento normal/reducido, teclado, hero HTTP 200 y viewport 1440/1366/1024/768/390/360. 54 composiciones de mesa con 3/4/5 jugadores y 0/3/10 artículos, sin overflow horizontal.

Academia: 14 capturas, acceso real visible y estado no disponible (servidor habilitado=false). Acceso con SDK simulado local y perfiles Madera/Oro/Eterno con datos de ejemplo, navegación #perfil/Escape/vuelta/foco verificados; sin llamadas externas. No se probó autenticación real de Supabase ni partida hasta victoria.

Prueba histórica qa_article_boxes falla por encabezados y solapamiento academia/mano; mismo caso reproduce fallos en HEAD original. Los 42 diagnósticos de cobertura de encabezados en fixtures son idénticos antes/después. No se modificaron aserciones históricas ni se atribuyen a la renovación.

Galerías: target/qa-v210/report.html y target/qa-v210/academy/report.html. Revisión combinada y git diff --check correctos. Placas nuevas corregidas para no ocultar encabezados; hojas de animaciones originales sin editar.

## Riesgos
Conflictos CSS, superposiciones, peso del arte y contratos DOM simulados. Mitigar con hojas acotadas y navegador.

## Decisiones
2026-10-05: estética academia nocturna, tinta/cobre/marfil; reutilizar ilustraciones de cartas que preservan identidad. Archivos separados entre escritores.
2026-10-05: usuario solicita rama release/v2.1.0, lema original «Construye tu legado científico.» y retrato reservado propio. Implementados.
2026-10-05: usuario prioriza acceso a sesión y Mi perfil. Se amplía rediseño a account-panel.js y academy.css; acceso siempre visible con estado honesto cuando cuentas deshabilitadas. No se habilita Supabase ni se modifican credenciales o backend. Mesa posee panel/perfil, portada header, QA script academia separado.

## Estado
Seguimiento visual: contenido de placas centrado en superficie y rayos ampliados por petición del usuario. Verificación de 10 composiciones Chrome en escritorio y móvil, sin modificar lógica ni efectos; detalles actuales en target/qa-v210/badges/.

Terminado. Resultado integrado en release/v2.1.0 sin commit/merge/publicación. Servidor local de QA en 8091 conserva las cuentas deshabilitadas; no se alteraron credenciales ni configuración Supabase. Los hallazgos de geometría anteriores y escenarios no ejecutados quedan documentados.

Seguimiento de mesa terminado: molduras ornamentales propias de Tesis, fondo original sin velos, eliminación de línea del encabezado y hotspot del emblema ajustado. Por petición posterior se sustituye cualquier desplazamiento de artículos por tamaño automático según cantidad en cada zona. Filas laterales de cuatro/cinco jugadores separadas de la academia propia; crónica ajustada para no tapar artículos. Siete suites Node aprobadas de nuevo; revisión estática sin bloqueantes. Chrome: 147 composiciones (7 resoluciones, 3/4/5 jugadores, 0/1/2/3/6/10/20 cartas por zona), cero fallos en visibilidad horizontal, contención, tamaño no creciente, contacto entre soportes o crónica; teclado y hotspot del logo comprobados. Capturas de ejemplos en target/qa-v210/ornate/report.html.

Recursos de personajes: prestigio arriba a la derecha del nombre, dinero y cartas abajo. Destinos de efectos de monedas ajustados al nuevo DOM, sin cambiar animaciones. Selección y 18 pruebas de efectos aprobadas. QA proporcional: ocho casos de 3/5 jugadores en 1920/1366/390/360 px, nombres largos, prestigio de dos dígitos, separación con rayos y vista previa con teclado; sin fallos. Capturas en target/qa-v210/plaque/.

Botones: marco dorado biselado y ornamentación fina, manteniendo la legibilidad y dimensiones actuales; ámbar para terminar turno, violeta para habilidad. QA proporcional de 15 estados en cinco resoluciones, texto/iconos contenidos, foco/hover y estados deshabilitados preservados. Capturas en target/qa-v210/action-bar/. Revisión visual y diff check correctos.
