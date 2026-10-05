# Comunidad, ranking y misiones

## Objetivo
Amigos por solicitud y aceptación, ranking global y misiones diarias/semanales persistentes con XP, integrados en Mi perfil.

## Contexto
Inicio limpio en release/v2.2.0. Existen cuentas Supabase, perfiles, resultados autoritativos y recibos idempotentes. Se trabaja en codex/comunidad-ranking-misiones sin commits ni publicación.

## Alcance y fuente de verdad
Motor Java conserva reglas y decide resultados. PostgreSQL deriva misiones de private.matches/match_participants y concede recompensas únicas. JWT determina actor de cuenta, token de sala determina actor de juego. Sin correo ni UUID de autenticación en listados públicos.

## Plan
- [x] Inspección inicial y reparto.
- [x] Migración y pruebas SQL.
- [x] Adaptador y rutas HTTP con pruebas.
- [x] Interfaz integrada y pruebas JS.
- [x] Integración, QA y revisión de archivos nuevos y diff.

## División multiagente y contrato
| Especialista | Área exclusiva | Contrato | Aceptación |
| --- | --- | --- | --- |
| Datos | supabase/migrations nueva, supabase/tests | RPC comunidad(), amistad(p_codigo,p_accion), ranking(p_criterio), misiones(), reclamar_mision(p_id) | RLS, actores propios, límites, recompensas únicas, ventanas UTC |
| Backend | CuentasSupabase.java, ServidorWeb.java, nuevas pruebas Java | GET /api/comunidad; POST /api/amigos {codigo,accion}; GET /api/ranking?criterio=xp/victorias/partidas; GET /api/misiones; POST /api/misiones/reclamar {id} | Autenticación, tipos estrictos, respuestas limitadas, errores útiles |
| Frontend | auth.js, account-panel.js, nuevo community-panel.js/css, index.html, pruebas JS nuevas | Consume rutas acordadas con Bearer de cuenta y timeout; nunca declara resultados | Estados vacío/error/carga, móvil, teclado, escape y respuestas obsoletas |
| Lead | Plan, documentación, integración, QA y revisión | Resolver dependencias y verificar resultado combinado | Suites, revisión y limitaciones documentadas |

DTOs: comunidad {codigo,amigos:[{codigo,nombre,nivel}],recibidas:[...],enviadas:[...]}; amistad devuelve comunidad. Ranking {criterio,entradas:[{posicion,codigo,nombre,nivel,xp,victorias,partidas,yo}],propia:entrada|null}. Misiones {diarias:[{id,titulo,objetivo,progreso,xp,completada,reclamada}],semanales:[...],reinicioDiario,reinicioSemanal}; reclamar devuelve misiones. Código estable de amistad público aleatorio (no UUID auth). Acciones solicitar/aceptar/rechazar/cancelar/eliminar. Ranking 50 posiciones + propia, orden estable y posición por métrica con empates. Misiones diarias jugar1/ganar1; semanales jugar3/jugar7/ganar3, recompensas 50/75/100/200/150 XP. Inicio diario 00:00 UTC y semanal lunes UTC; solo resultados desde activación de la migración.

## Criterios y riesgos
Amistad bilateral consentida, no autoamistad ni duplicados; top y posición propia fiables; misiones no retroactivas ni duplicables en concurrencia/reintentos; XP sin ventajas de juego. Mantener RLS de perfiles e historial privado. Publicación y migración remota quedan como paso de despliegue separado.

## Tests
- Baseline: 176 pruebas Java y 8 suites Node pasan.
- Final Java: `mvn "-Dmaven.repo.local=C:/Users/radeu/.m2/repository" test`, 179 pruebas, cero fallos/errores/omisiones. Maven por defecto falla al intentar escribir C:/.m2; caché existente correcta utilizada con escalación.
- Final JS: todas las 9 suites `tests/*.test.mjs` pasan con `node --experimental-vm-modules`. Incluye escape, headers/contrato, respuestas obsoletas/cierre, foco, errores de ranking, doble reclamo y carreras A→B/A→B→A/cambio silencioso SDK.
- SQL: `node supabase/tests/run-pglite.mjs` pasa ambas migraciones y suites; RLS, consentimiento, reintentos, top50/empates/propia, 5 recompensas, fecha UTC y exclusión de resultados antiguos/futuros. No prueba varias conexiones ni Supabase remoto.
- Navegador: `node tools/qa_community.mjs` con Playwright del runtime y Chrome, PASS; SDK/Auth y respuestas RPC simulados, servidor/HTML/JS/CSS locales reales. Amigos aceptar/enviar/cancelar/eliminar con confirmación, errores conservan entrada, ranking propia fuera50 y cambio criterio/foco, error ranking sin datos mal rotulados, misión reclamada una vez, regreso Escape y 9 capturas 1440/390/360 px sin overflow; sin errores JS. Evidencia en target/qa-community/results.json y PNG. Inspección visual manual de misiones escritorio y amigos 360 px satisfactoria.
- QA existente `tools/qa_profile.mjs` verifica perfil, alias, navegación, recargas y tres invitados con avance de fase/token conservado; después FAIL en aserción de cabecera móvil línea93. Comprobación separada con auth.js/account-panel.js originales de HEAD reproduce exactamente misma geometría (wordmarkRight245.953125/actionsLeft0) a360 px. Incidencia/aserción previa fuera de alcance, no reparada; resto del script posterior a esa aserción no ejecutado.
- `git diff --check` limpio; inspección de diff y nuevos archivos, revisión independiente del resultado combinado sin bloqueantes tras reparar carrera Auth.

## Decisiones finales
- Código público estable de amistad de 16 caracteres hexadecimales, máximo100 contactos incluyendo pendientes.
- Solicitud inversa conserva consentimiento receptor; interfaz ofrece actualizar y mensaje neutral sobre solicitudes.
- Recompensas cosméticas reclamables antes de reinicio; misión ID incluye ventana UTC. No se modifica registrar_resultado ni motor/salas/polling.
- Reviewer reprodujo acción A enviada con tokenB durante getSession. Corregida mediante generación de identidad y rechazo antes de fetch, comprobada con pruebas nuevas.
- Documentación de instalación en docs/COMUNIDAD_MISIONES.md y supabase/README.md. Sin nuevos secretos/dependencias de producción.

## Estado
Implementación terminada en codex/comunidad-ranking-misiones. El usuario autoriza el 2026-10-06 commit/push de la rama e integración en main de personal y origin. Referencias remotas actualizadas y ambos main coinciden con main local antes de integrar; no hace falta reescritura de historia. Procedimiento de publicación: commit de cambios revisados, push de rama a ambos remotos, merge en main sin modificar contenido validado, push de main a ambos y comprobación final de SHA remoto mediante git ls-remote. Evidencia de publicación e identificadores de commits en la entrega al usuario.

Migración remota aplicada el 2026-10-06 con autorización explícita del usuario en Supabase Tesis ncvyaxhfbcknviznucii (main/PRODUCTION). Preflight confirmó ausencia de nuevas tablas/código. SQL aplicado coincide exactamente con archivo local, transacción SUCCESS y verificación de solo lectura con diez controles verdaderos (RLS, RPC/anon, acceso privado, helpers, código protegido/válido/único, misiones, activación, XP). Evidencia docs/qa/comunidad/supabase-migracion-verificada.jpg; consulta supabase/tests/verificar_comunidad_instalacion.sql. No repetir migración. Pendiente desplegar esta revisión, flujo Auth/PostgREST real y concurrencia PostgreSQL multiconexión. No se crearon fixtures en producción. Servidor local de QA detenido.
