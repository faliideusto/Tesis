# Recompensas y temporadas de tres meses

## Objetivo y contexto
Rama codex/infra-pase-temporada, limpia al empezar, HEAD eec6c3a; main remoto e59dbfc. Misiones de temporada ×10; diarias/semanales ×2; partidas 200 XP +100 victoria. Pase de partidas 200 base +200 victoria o100 segundo. Temporadas compartidas con ranking de tres meses; renovación visible mediante contadores. Publicar rama y fusionar main en origin/personal al terminar.

## Fuente de verdad y alcance
SQL privado Supabase gobierna recibos, progreso y clasificación; CuentasSupabase valida DTO. Frontend consume fechas y recompensas del servidor. Mantener IDs, cosméticos, recibos, autenticación e idempotencia; migración nueva sin reescribir las anteriores. La temporada iniciada octubre2026 conserva identidad y amplía su cierre hasta enero2027; revisar continuidad histórica.

## División
- rewards_seasons: SQL, Java cuentas y sus tests; contrato existente, separación explícita XP/puntos.
- countdown_ui: Misiones/Ranking y tests JS propios; contadores basados en fin del servidor con limpieza de temporizadores.
- Lead: textos de perfil, documentación, QA combinada, migración remota y publicación.

## Plan
- [x] Inspección y confirmación de las misiones de la foto.
- [x] Backend/calendario/recompensas.
- [x] Frontend/contadores/textos coherentes.
- [x] Tests SQL/Java/Node y navegador; revisión del diff.
- [x] Migración010 aplicada y verificada en Supabase. Publicación autorizada: commit/push de rama, merge y push de ambos main y verificación de Render al finalizar la entrega.

## Riesgos y aceptación
No duplicar recompensas históricas ni modificar XP al reclamar cosméticos. Preservar temporadas/inventario previos; segundos y empates derivados de clasificación real. Todos los ámbitos temporales cuentan hacia la fecha servidor; refresco al caducar sin reintentar mutaciones. Documentar pruebas reales frente a fixtures.

## Estado
Implementación y revisión terminadas, lista para publicación autorizada. Validación: Maven230PASS,21suitesNodePASS,12migracionesSQLPASS; QA navegador Misiones6capturas y Ranking14capturas con fixtures. Supabase remoto:010 aplicada, SHA256 E060F1CB9179922766C5F3AAB9F1F8E13D878089D675923DC5072E03A95B58A0,10controles de sololectura PASS. No se reclamaron recompensas sobre cuentas reales; no se verificó concurrencia PostgREST con varias conexiones. Revisión combinada sin bloqueantes.
