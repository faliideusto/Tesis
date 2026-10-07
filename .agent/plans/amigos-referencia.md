# Amigos: referencia visual, presencia y sugerencias

## Objetivo
Reproducir la captura de Amigos del usuario: biblioteca nocturna, cabecera existente, cuatro contadores, invitación por código, tres bandejas ilustradas y sugerencias con rangos reales. Incorporar presencia autenticada y sugerencias reales.

## Contexto
Tras el merge anterior, main está limpio en b799109. El usuario pide esta misma rama: trabajar en main. No se autoriza por esta petición un nuevo commit/merge/push ni despliegue remoto. Amistades y Supabase ya existen; producción tiene las dos migraciones anteriores según supabase/README.md.

## Fuente de verdad y alcance
CuentasSupabase.java y RPC Supabase gobiernan amistades. Motor, XP y reglas permanecen. Frontend consume DTO autenticado y conserva generación/identidad/foco. Archivos: community-panel.js, nuevo friends.css, index.html, auth.js, presence.js y arranque app.js; adaptador cuentas y HTTP; migración nueva, tests y arte friends-v250.

## Contrato acordado
Comunidad conserva codigo/amigos/recibidas/enviadas y añade sugerencias (máximo12 perfiles públicos), amigos[].enLinea boolean, presenciaDisponible boolean. Sugerencias excluyen actor, todas relaciones y pendientes, orden proximidadnivel/código. No exponer UUID/email/tokens ni presencia de desconocidos. POST /api/presencia {} autentica por Bearer y actualiza RPC, responde activa:true. Señal cada30s sólo documento visible y cuenta autenticada; online últimos90s. No logout offline explícito: otra pestaña puede seguir abierta. Sin migración, presenciaDisponible false evita inventar usuarios en línea.

## Plan
- [x] Inspección y contrato.
- [x] Backend, migración y pruebas SQL/HTTP.
- [x] Frontend fiel, buscar/copia/sugerencias y actualización sin borrar formularios.
- [x] Assets e integración de presencia.
- [x] QA visual/funcional y revisión combinada.

## Equipo y propiedad
| Agente | Área exclusiva | Aceptación |
| --- | --- | --- |
| friends_backend | CuentasSupabase.java, ServidorWeb.java, testsJava cuentas/comunidad; nueva migración/SQL tests/run-pglite y README Supabase | Identidad segura, expiración, sugerencias reales, SQL RLS/permisos, testsmigración y adaptador |
| friends_frontend | community-panel.js, friends.css, index.html, tests/community.test.mjs | Datos reales, composición referencia, filtros/paginación/copia y acciones seguras |
| friends_qa | tools/qa_friends_reference.mjs y evidencias target | Capturas1672/1440/1280/390/360, vacío/poblado, UX/errores/CSP/privacidad y review final |
| Lead | auth.js/presence.js/app.js bootstrap, tests presencia, arte friends-v250 y plan | Heartbeat global visible/sesión, assets, integración y validación |

## Aceptación
Geometría próxima referencia: heading y142, stats y263/83px, código y361/153px, bandejas y529/292px, sugerencias y838 (1672x941). Móvil legible sin overflow. Online y sugerencias provienen del backend. Formularios/filtros no se pierden por actualización, respuestas obsoletas no restauran identidades ni vistas. Mantener amistad consentida y límite100 existentes.

## Validación y límites
Maven: 195 pruebas, cero fallos/errores/omitidas, BUILD SUCCESS (summary stdout; no sumar XML antiguos). Las 12 suites Node pasan. SQL PGlite: tres migraciones y suites pasan, incluidos permisos, actor, privacidad, expiración/renovación y sugerencias. Chrome con fixtures: 11 capturas Amigos en 1672/1440/1280/390/360, estados vacío/poblado/límite/sin sugerencias/presencia no disponible. Búsqueda, copiar/compartir, acciones, errores, recarga, respuestas tardías y Escape durante carga pasan. GET automático de 30 s conserva borrador, filtro, foco y selección. Regresión de perfil/ranking/misiones: 19 capturas y navegación pasan. Evidencias en target/qa-friends-reference y herramienta tools/qa_friends_reference.mjs. git diff --check limpio; revisión combinada sin bloqueantes.

Migración remota aplicada con autorización posterior del usuario el 2026-10-07, por SQL Editor de Tesis ncvyaxhfbcknviznucii main/PRODUCTION. Diez controles de instalación pasan; RPC reales y heartbeat repetido pasan en transacción con rollback. Se verificó ausencia de instalación previa antes de aplicar. Registro en docs/qa/amigos/supabase-verificacion.md; consulta reproducible en supabase/tests/verificar_amigos_instalacion.sql. No se certifican Auth/PostgREST remoto ni concurrencia entre conexiones. El navegador de QA usa datos simulados únicamente en la herramienta de pruebas; la aplicación consume perfiles reales. Arte generado reproduce atmósfera y composición; no es una copia exacta de las ilustraciones originales.

## Estado
Implementación, validación local y activación de base de datos terminadas en main, misma rama solicitada. Sin nuevo commit, push ni despliegue del código de aplicación. Backend, frontend y QA cerrados; Lead revisó también archivos nuevos, assets y evidencia final.

## Ampliación: perfiles públicos pulsables
Petición posterior: cualquier persona visible en amigos, solicitudes, sugerencias, ranking y búsqueda local abre su perfil público. Mantener lista/filtro/posición y devolver foco al cerrar; Escape cierra sólo el perfil. Modal de lectura con nombre/rango/nivel/XP/estadísticas/código; sin controles de cuenta propia. GET /api/perfil-publico?codigo=16HEX autenticado y RPC perfil_publico(p_codigo), DTO explícito sin identidad privada. Presencia sólo para amistades aceptadas o propia cuenta, nunca solicitudes o desconocidos.

Propiedad: friends_backend Java/SQL/JUnit/README; friends_frontend community-panel + modal; Lead completó CSS/index/auth/tests accounts/demo/integración/QA/activación remota tras interrupción de especialistas por cuota. QA preparó tools/qa_public_profiles.mjs, ejecutada y revisada por Lead. 196 pruebas Java, doce suites Node y cuatro migraciones/suites PGlite pasan. Chrome: siete capturas de perfiles desde amigos filtrados, recibidas, enviadas, sugerencias, ranking, error y móvil; Escape/foco/borrador/retry/respuesta tardía/destrucción pasan. Corregido tamaño del badge heredado y añadida aserción de geometría. Nueva migración aplicada a Supabase Tesis main/PRODUCTION: contrato público real, actor ausente y permisos verificados con rollback. Queda sin certificar Auth/PostgREST remoto y concurrencia entre conexiones. Código de aplicación no desplegado ni nuevo commit/push.
