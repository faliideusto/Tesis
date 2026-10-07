# Invitaciones de amigos a salas privadas

## Objetivo y contexto
Anfitrión con cuenta invita amistades aceptadas conectadas desde su lobby privado. Destinatario ve invitación global y acepta o rechaza. El código de sala y entrada manual siguen disponibles según petición expresa. Misma rama main, cambios anteriores de Amigos/perfiles públicos sin commit; no sobrescribir ni mezclar responsables.

## Autoridad y contrato
SalaJuego autentica token de sala, anfitrión, estado y cuentas vinculadas. CuentasSupabase autentica cuenta y valida amistad/presencia mediante RPC exclusiva de servidor. Las salas e invitaciones viven en memoria; invitaciones duran cinco minutos y desaparecen al reiniciar. GET /api/invitaciones Bearer cuenta -> {invitaciones:[{id,codigoSala,nombreAnfitrion}]}; POST /api/invitaciones/{id}/aceptar {} devuelve AccesoSala, rechazar {} devuelve {}; POST /api/salas/{codigoSala}/invitar {codigo:16HEX} exige token sala + cuenta anfitrión vinculada y devuelve {id,enviada:true}. No UUID/fecha/token de otra persona en DTO. Aceptación consentida, sala abierta/capacidad, destinatario ligado a cuenta y consumo único.

## Equipo y propiedad
Backend: Java cuentas/salas/servidor/nuevo gestor, migración SQL/helper sólo service_role, pruebas SQL/JUnit y README. Frontend: módulo room-invitations.js, CSS y tests propios. QA: tools/qa_room_invitations.mjs y capturas. Lead: app.js/api.js/auth.js/index/pruebasbootstrap/demo/plan/integración/revisión final y Supabase.

## Pasos
- [x] Inspección y contrato.
- [x] Backend y SQL validación.
- [x] UI y notificación global, identidad/generación/foco/errores.
- [x] Integración app y comprobación de navegación al aceptar.
- [x] QA HTTP/SQL/Node y navegador desktop/móvil.
- [x] Revisión combinada y activación helper Supabase.

## Aceptación y límites
Sólo anfitrión con cuenta puede invitar; sólo amistad aceptada en línea recibe; no duplicados pendientes y límites acotados. Lista global sólo destinatario, sin actividad de desconocidos. Entrar explícito y sin reemplazar silenciosamente una partida activa o búsqueda. Confirmar cambio de lobby recuperable si procede. Rechazo/aceptación caducada/sala llena/partida iniciada informan, no reintentar mutaciones ambiguas. Código visible y entrada manual preservados. Pruebas de carreras, actor incorrecto, cuenta distinta, privacidad, caducidad, no resurrection y móviles. No commit/push/despliegue web sin petición.

## Resultado y evidencia
202 pruebas Maven pasan; cinco migraciones/suites PGlite pasan según ejecución del responsable backend. Trece suites Node completas pasan. Chrome real con dos contextos, Auth/API simulados: envío, rechazo, aceptación, token separado, sólo amigos online, teclado, entrada por código preservada, errores sin reintento, desktop1672/móvil390 y cuatro capturas en target/qa-room-invitations. Repetido tras correcciones de identidad/foco. QA perfiles públicos pasa siete capturas y geometría para descartar regresiones. git diff --check pasa. Revisión combinada: sin bloqueantes, mantiene motor, revisiones y privacidad; lecturas pendientes no sustituyen la bandeja durante una mutación.

Migración003 aplicada manualmente a Supabase Tesis main/PRODUCTION ncvyaxhfbcknviznucii el 2026-10-07. SQL Editor confirma éxito y cinco controles true (instalada, servidor, anon bloqueado, navegador bloqueado, desconocido sin destino). No se probó intercambio entre dos cuentas reales contra aplicación desplegada. Demo8092 ampliada con lobby, amigos invitados que se unen simuladamente y botón para simular aviso recibido; navegador abierto en lobby con amigos online. No es motor ni Supabase real. Sin commits ni despliegue de aplicación en esta tarea.
