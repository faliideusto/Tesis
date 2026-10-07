# Misiones y pase de temporada

## Objetivo
Pantalla de Misiones fiel al mockup, con progreso y reclamaciones autoritativos de Supabase, pase mensual y catálogo definitivo de Crónicas del Archivo.

## Contexto
Rama codex/infra-pase-temporada con trabajo local anterior que se conserva. Hay APIs de misiones diarias/semanales y pase, recibos únicos, inventario permanente y catálogo real. No existen retos mensuales en la RPC de misiones actual. Sin commit ni publicación Git solicitados en esta tarea.

## Alcance y fuente de verdad
RPC misiones/reclamar_mision y pase_temporada/reclamar_recompensa_temporada; CuentasSupabase y endpoints actuales. Progreso desde resultados guardados y recibos, nunca calculado/acreditado por el navegador. Misiones pueden conceder XP y puntos del pase según contrato existente; cosméticos conceden cero XP. Temporadas comparten Europe/Madrid con ranking. Motor y reglas de partida sin cambios.

## Áreas y equipo
| Responsable | Archivos exclusivos | Contrato y aceptación |
| --- | --- | --- |
| Backend | CuentasSupabase.java, migración009 y nuevas pruebas SQL/Java | Extensión compatible: descripcion, puntosPase, temporada[], reinicioTemporada; reclamo único y calendario compartido |
| Pantalla | missions-panel.js, missions.css, tests/missions_panel.test.mjs | mountMissions(root,{accounts,onReward}); APIs existentes, assets reales, estados y countdown, invalidación de sesión |
| QA | tools/qa_missions.mjs, docs/qa/misiones.md | Navegador reproducible, reclamaciones, persistencia, inventario, responsive y errores |
| Lead | community-panel.js, index.html, runner SQL, documentación, revisión | Integración, regresiones y estado de despliegue remoto explícito |

## Pasos
- [x] Inspección y contrato entre agentes.
- [x] Implementación de pantalla y extensión de retos mensuales.
- [x] Integración y validación SQL/HTTP/cliente/navegador.
- [x] Revisión conjunta y documentación.

## Criterios de aceptación
Diarias/semanales/temporada separadas, progreso objetivo y descripción, estados en progreso/completada/reclamada visibles, filtros sin ocultar reclamadas por defecto. Pase independiente con diez niveles, catálogo real y bundle legendario triple. Claims usan IDs y temporada del servidor, sin XP o identidad en cuerpos; reconsulta tras error ambiguo, sin reintento automático de mutaciones. Recarga conserva claims/inventario. Cosmetics aparecen en Personalización y no afectan ranking. Countdown usa fechas del servidor y renovación de mes real. Desktop y móvil sin desbordamiento horizontal, lectura y teclado adecuados.

## Tests y límites
Maven completo: 229 tests, cero fallos/errores. Las 20 suites Node pasan. PostgreSQL WASM: 11 migraciones y pruebas SQL pasan. QA navegador: desktop1672×941/1366×768, móvil390×844 y seis capturas; claims únicos, respuesta autoritativa conservada tras GET fallido, inventario en Personalización, 13 PNG, niveles, countdown y cosméticos sin XP. Revisión final JS/CSS/DTO/SQL sin bloqueantes. Fixtures sólo para QA; no sustituyen Auth/PostgREST ni concurrencia real entre sesiones.

Migración009 aplicada a Supabase Tesis ncvyaxhfbcknviznucii/main el 7-10-2026 mediante SQL Editor. Antes de ejecutar se confirmó ausencia del helper y se leyó íntegramente el SQL del editor, comparado con la migración revisada. Resultado Success. No rows returned. SHA256: 4DEFBED9A1D9898823AC024407792895C83DD26017AFA23BD79B47D7BA06B848. Consulta verificar_misiones_temporada.sql: cinco PASS (instalación, RPC/puntos, calendario compartido, permisos, trigger). No se crearon cuentas ni reclamaciones reales para pruebas remotas.

## Estado
Terminado. Pantalla conectada a las APIs reales. Migración mensual aplicada y verificada. Sin commit ni push; cambios previos conservados.
