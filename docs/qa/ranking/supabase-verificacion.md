# Ranking mensual: verificación Supabase

2026-10-07: migración `202610070004_ranking_periodos.sql` aplicada manualmente con SQL Editor al proyecto Tesis (`ncvyaxhfbcknviznucii`), main/PRODUCTION. Resultado visible «Success. No rows returned». Función antigua `ranking(text)` conservada.

Smoke funcional dentro de BEGIN/ROLLBACK con un perfil existente y actor de sesión SQL: RPC nueva devuelve los cuatro ámbitos global/amigos/semanal/temporada, criterio solicitado, top máximo50 y entrada propia marcada. Proyección propia no contiene id/user_id/email/token. Límites de temporada comprobados contra mes natural Europe/Madrid. Permisos authenticated activo y anon bloqueado. Cinco controles finales true y cambios temporales revertidos. No se registraron partidas, recompensas ni perfiles.

Pruebas locales PGlite verifican seis migraciones, amistades aceptadas, empates, propia fuera50, misión+ledger autoritativo, año/bisiesto/DST y frontera temporal inclusiva/exclusiva. Esta comprobación SQL no equivale a probar Auth/PostgREST entre cuentas reales ni a desplegar la aplicación web. No repetir una migración instalada; reconciliar instalación manual antes de adoptar db push.
