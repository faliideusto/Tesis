# Infraestructura del pase mensual

## Objetivo y contexto
Preparar temporadas mensuales compartidas con ranking, progreso por cuenta/temporada, catálogo por nivel, reclamación única, inventario permanente y equipamiento de avatar/marco/título/insignia/reverso/placa. Sin modificar UI de Misiones ni crear arte definitivo. Rama nueva codex/infra-pase-temporada. Ranking anterior guardado por petición del usuario en commit 553212c; punto de partida limpio.

## Autoridad y arquitectura
Java HTTP del JDK/CuentasSupabase valida JWT y DTO; Supabase PostgreSQL guarda recibos autoritativos, misiones y progreso. Reutilizar private.actor_comunidad(), reward_ledger, matches, mission_claims y calendario de ranking. Ninguna XP/puntos/identidad enviados por navegador. No cambios al motor, turnos o recompensas vitalicias.

## Contrato
RPC pase_temporada(p_temporada nullable), reclamar_recompensa_temporada(p_temporada,p_id), cosmeticos(), equipar_cosmetico(p_tipo,p_id nullable). GET /api/pase [?temporada=temporada:YYYY-MM], POST /api/pase/reclamar {temporada,id}, GET /api/cosmeticos, POST /api/cosmeticos/equipar {tipo,id nullable}. Bearer de cuenta y controles de origen/método/JSON existentes, sin actor en cuerpo.

Pase {temporada:{id,nombre,inicio,fin,zonaHoraria,activa,gratuita},progreso:{puntos,nivel,puntosSiguienteNivel,maxNivel,puntosPorNivel},recompensas:[{id,nombre,nivel,cosmeticos:[{id,tipo,nombre,asset,rareza}],reclamada,desbloqueada}]}. PuntosSiguienteNivel es umbral absoluto o null al máximo. Cosméticos {inventario:[Cosmetico],equipamiento:{avatar,marco,titulo,insignia,reverso,placa}} con ids o null.

## Decisiones
Calendario mensual Europe/Madrid, mismo id/límites de ranking. Puntos de pase independientes, provisionalmente 1:1 desde XP de recibos de partidas y misiones; no añade otra XP ni altera ranking. Inicio nivel 1, 500 puntos entre niveles, máximo 10, curva comunicada por API. Usuario definió Crónicas del Archivo, pase gratuito y catálogo de diez recompensas detallado en docs/pase-temporada.md: once cosméticos, nivel 10 bundle legendario marco+insignia y sexto tipo placa. Recibos por fuente impiden doble abono. Inventario y loadout no están ligados a temporada ni se eliminan al cerrar mes. Historia conservada; recompensas ganadas de temporadas registradas anteriores siguen reclamables. Catálogo por temporada conserva snapshot de identidad/presentación; asset se resuelve desde catálogo actual y puede sustituirse. Futuros/desconocidos rechazados. Reutilizar avatar actual y asset genérico; sin selector ni equipamiento visual aún.

## Equipo y propiedad
SQL: friends_backend sólo migración005, SQLtests/run-pglite/README. Java: friends_frontend sólo CuentasSupabase/ServidorWeb y nuevoHTTPtest. Lead: plan, documentación modelo, assetsplaceholder, auth.js y pruebas cliente, integración y review. QA/revisión final después de resultado combinado, sin escritores simultáneos sobre archivos compartidos.

## Pasos
- [x] Arquitectura, rama nueva y commit de seguridad.
- [x] Contrato entre capas y alcance sin UI.
- [x] Tablas/recibos/triggers/RPC con calendarios compartidos.
- [x] Java/API y transporte cliente.
- [x] Pruebas idempotencia/ownership/mes/DST/RLS y regresiones.
- [x] Revisión combinada y documentación de integración.

## Aceptación y límites
Cada cuenta accede sólo a su pase/inventario/loadout. Claim atómico único incluso ante solicitudes simultáneas; sólo recompensa desbloqueada, consistente en temporada/catálogo. Equipar sólo cosmético poseído del tipo correcto o vaciar slot. Nuevos meses empiezan con progreso0 sin borrar anteriores/equipamiento. Recibos repetidos no suman, fuente futura no acredita antes de tiempo, premios no otorgan XP adicional. Tablas privadas/RLS/grants restrictivos, IDs y rutas acotados, DTO sin UUID/correo/token. SQL transaction/locks respetan registro de resultados y reclamo de misión. No UI de Misiones/CSS/arte definitivo, no aplicación remota de placeholders, no commit del pase ni push sin nueva petición.

## Estado
Implementación terminada y revisada sin bloqueantes. Migración aplicada el 2026-10-07 a Supabase Tesis main por petición posterior explícita; quince controles remotos de sólo lectura pasan. No se modificó la UI de Misiones ni se creó un commit del pase.

## Evidencia y límites de verificación
- `mvn test`: 209 pruebas, cero fallos/errores, ejecutado por el especialista Java con autorización de loopback; informes en target/surefire-reports, inspeccionados por el Lead.
- Quince suites Node ejecutadas por QA, incluido season_pass_client.test.mjs: pasan.
- `node supabase/tests/run-pglite.mjs`: siete migraciones y suites SQL pasan, incluido backfill del mes vigente antes de instalar el pase. Ejecución independiente de QA tras cerrar SQL.
- Revisión estática conjunta de contratos, privacidad, locks, snapshots y nuevas rutas. Corregidos cambios de tipo histórico y omisión de ítems de bundles mal configurados; regresiones añadidas.
- `git diff --check` pasa; archivos nuevos revisados. Documentación en docs/pase-temporada.md y docs/qa/pase-temporada/revision.md.
- Sin QA visual del juego porque no cambia renderizado. Aplicación remota verificada mediante supabase/tests/verificar_pase_instalacion.sql. Sin integración Auth/PostgREST real ni concurrencia entre sesiones; PGlite usa una conexión. PostgreSQL nativo no disponible, sin instalar servicios.
