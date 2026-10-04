# Base de datos de Tesis 2.0.0

Aplicar `migrations/202610050001_cuentas_progresion.sql` con el SQL Editor de Supabase, o con las migraciones de Supabase CLI. Revisar primero el SQL; contiene una transacción y no incluye secretos. No ejecutar dos veces manualmente: las migraciones deben quedar registradas. No se ha aplicado automáticamente a ningún proyecto remoto.

`public.profiles` relaciona cada perfil con `auth.users`. El trigger crea el perfil y la migración incluye cuentas preexistentes. `authenticated` puede leer su propio perfil y editar exclusivamente `display_name`; RLS y permisos de columna impiden modificar XP, partidas o victorias. El nombre público se valida a 1–24 caracteres, sin espacios exteriores. El nivel se deriva en Java: `1 + floor(xp / 500)`; no tiene efectos sobre el juego.

Las tablas `private.matches`, `private.match_participants` y `private.reward_ledger` no se exponen por Data API. Mantener `private` fuera de la lista de esquemas expuestos. Sus permisos están revocados para `PUBLIC`, `anon` y `authenticated`, con RLS habilitado y sin políticas de navegador. Solo `service_role` accede a ellas.

El backend llama `public.registrar_resultado` usando la clave secreta exclusivamente en servidor. La función usa permisos del invocador y su ejecución está revocada para el navegador. Requiere:

```json
{
  "p_match_id": "UUID de la partida, estable durante los reintentos",
  "p_result_hash": "SHA256 hexadecimal en minúsculas, 64 caracteres",
  "p_completed_at": "fecha ISO de finalización del motor",
  "p_version": 1,
  "p_participants": [
    {"seat": 0, "user_id": "UUID de cuenta o null", "display_name": "Ada", "prestige": 10, "winner": true},
    {"seat": 1, "user_id": null, "display_name": "Lin", "prestige": 7, "winner": false},
    {"seat": 2, "user_id": null, "display_name": "Invitado", "prestige": 5, "winner": false}
  ]
}
```

La respuesta es un array JSON `[{"user_id":"UUID","xp":150}]`. Los asientos son consecutivos desde cero, entre tres y cinco participantes. Las cuentas y asientos no se repiten. Todos los participantes con el máximo prestigio deben ser ganadores, incluidos invitados; todos los ganadores reciben el bonus en caso de empate. Cada cuenta obtiene 100 XP por terminar y 50 XP adicionales por ganar. Invitados no generan recibos ni contadores.

La PK de partida serializa reintentos concurrentes; la PK `(match_id,user_id)` del registro de recompensas refuerza la unicidad. Un resultado ya registrado con igual hash y versión devuelve sus recibos sin modificar contadores. Un hash diferente se rechaza. Inserción de partida, participantes, recibos e incremento de perfiles forman una única transacción: cualquier error revierte todo. Los perfiles se bloquean en orden de UUID para evitar bloqueos cruzados entre partidas distintas.

No se guardan manos, roles, acciones ni eventos. Borrar una cuenta elimina su perfil y recibos y desvincula su UUID de participantes; no borra el resultado de la partida. La eliminación de cuentas durante una entrega pendiente queda fuera del alcance inicial y puede requerir intervención: un nuevo resultado con una cuenta ya eliminada se rechaza por integridad referencial.

## Verificación SQL

En un proyecto de pruebas que ya tenga la migración, ejecutar como `postgres`:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/tests/cuentas_progresion.sql
```

La conexión se configura fuera del repositorio y del chat; no pegar contraseñas en comandos compartidos. El script usa identificadores reservados de prueba, comprueba el trigger, caracteres de control, empate, reintentos, contradicción, rollback completo, RLS y permisos, y termina con `ROLLBACK`. Ejecutarlo sobre un proyecto vacío de pruebas: la comprobación del número de recibos asume que no hay resultados previos.

También se puede ejecutar localmente con [PGlite](https://pglite.dev/docs/), PostgreSQL compilado a WASM, sin conectar a Supabase:

```powershell
npm.cmd --prefix target/sql-qa --cache target/sql-qa/npm-cache install --no-save --ignore-scripts @electric-sql/pglite@0.5.8
node supabase/tests/run-pglite.mjs
```

El runner crea una base en memoria y simula únicamente `auth.users`, `auth.uid()` y los roles de acceso; ejecuta la migración y los tests SQL originales. Esta prueba verifica SQL PostgreSQL real, RLS y rollback, pero no verifica la integración Auth/PostgREST de Supabase ni concurrencia entre conexiones. No añade dependencias al frontend ni archivos npm al repositorio: se descargan bajo `target/`, ignorado por Git.

Concurrencia real requiere dos conexiones independientes: enviar el mismo UUID/hash al RPC a la vez y comprobar una sola partida, un recibo por cuenta y un solo incremento. Repetir con dos partidas distintas y participantes en distinto orden para verificar los bloqueos ordenados. Estos escenarios no se pueden certificar mediante inspección estática ni mediante el script de una sola conexión.
