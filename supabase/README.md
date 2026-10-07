# Base de datos de Tesis 2.0.0

## Invitaciones a salas privadas (2026-10-07)

La migración `migrations/202610070003_invitaciones_amigos.sql` añade exclusivamente el resolver `resolver_amigo_en_linea(p_actor uuid,p_codigo text)`, ejecutable por `service_role`. Devuelve internamente el UUID de un amigo aceptado con presencia de los últimos 90 segundos, o `destino: null`; nunca está disponible para `anon` ni `authenticated`. El actor lo obtiene Java del JWT autenticado, no del JSON del navegador. No se ha aplicado esta migración al remoto desde este cambio. La suite `tests/invitaciones_amigos.sql` verifica permisos, consentimiento y caducidad; PGlite aplica cinco migraciones.

Las invitaciones viven en memoria junto a las salas, caducan tras cinco minutos y se pierden al reiniciar. `POST /api/salas/{codigo}/invitar` requiere token Bearer de sala, JWT en `X-Tesis-Account-Authorization`, `X-Tesis: 1` y cuerpo `{ "codigo": "16HEX" }`. Solo el anfitrión con su misma cuenta vinculada puede enviarlas mientras la sala siga en lobby, con plazas libres y sin el destinatario dentro. La amistad y actividad se resuelven con credenciales de servidor; tras esa consulta la autorización y estado de sala se vuelven a comprobar. Respuesta: `{id,enviada:true}`. Repetir un envío pendiente devuelve el mismo ID. Hay como máximo 20 invitaciones por destinatario, 100 por sala y 25600 globales; un par sala/destinatario debe esperar 60 segundos para reenviar tras rechazo. La memoria de ese cooldown también está acotada y caduca.

`GET /api/invitaciones` requiere Bearer de cuenta y devuelve `{invitaciones:[{id,codigoSala,nombreAnfitrion}]}`, solo para ese destinatario y con sala todavía viable. `POST /api/invitaciones/{id}/aceptar` con `{}` une usando el nombre público de la cuenta y devuelve `AccesoSala`; el token de sala solo se entrega a quien acepta. Aceptación y consumo se serializan: repetir o aceptar con otra cuenta produce 404. `POST .../rechazar` con `{}` devuelve `{}`. No admite actor ni nombre enviados por el cliente. Sala iniciada, llena, caducada o cuenta ya incorporada invalida la invitación. No hay reservas de plaza: la capacidad se comprueba al aceptar bajo el bloqueo de la sala. El flujo manual para compartir código/unirse conserva su comportamiento.

## Perfiles públicos (2026-10-07)

La migración `migrations/202610070002_perfiles_publicos.sql` añade `perfil_publico(p_codigo)` después de presencia/sugerencias. Aplicada y verificada el 2026-10-07 en Tesis `ncvyaxhfbcknviznucii` main/PRODUCTION por SQL Editor. No repetir su aplicación. La RPC real devuelve los ocho campos públicos esperados; rechaza actor ausente y se verificaron grants autenticados, bloqueo anónimo y SECURITY DEFINER con search_path vacío. La comprobación funcional se revirtió con rollback. `GET /api/perfil-publico?codigo=16HEX` requiere cuenta autenticada y un único parámetro sin escapes, acepta hexadecimal en ambos casos y devuelve `{codigo,nombre,xp,nivel,partidasTerminadas,victorias,enLinea,presenciaDisponible}`. Código inválido produce 400; perfil inexistente, 404. No permite consultar por UUID ni devolver correo, fecha de actividad u otros datos privados.

La RPC utiliza `auth.uid()`, `SECURITY DEFINER` y `search_path` vacío; ejecución revocada para `anon`. Las estadísticas son los mismos datos públicos del ranking. `presenciaDisponible` solo es verdadera para la cuenta propia o una amistad aceptada; solicitudes pendientes y desconocidos obtienen ambos indicadores de presencia falsos, aunque el perfil esté conectado. La marca caduca a los 90 segundos. La suite `tests/perfiles_publicos.sql` comprueba esas proyecciones, permisos, caducidad, códigos y autenticación; el runner PGlite aplica cuatro migraciones. Sigue pendiente verificar Auth/PostgREST y despliegue reales.

## Amigos: presencia y sugerencias (2026-10-07)

La migración `migrations/202610070001_amigos_presencia_sugerencias.sql` fue aplicada el 2026-10-07 al proyecto Supabase Tesis `ncvyaxhfbcknviznucii` (main/PRODUCTION), mediante SQL Editor con autorización del usuario. **No volver a aplicarla en ese proyecto.** Diez controles posteriores pasan; consulta de solo lectura reproducible en `tests/verificar_amigos_instalacion.sql` y registro en `../docs/qa/amigos/supabase-verificacion.md`. También pasan las RPC reales con una cuenta existente, heartbeat repetido y comprobaciones de privacidad, sugerencias y actor ausente, dentro de una transacción revertida. El proyecto no tiene tabla `supabase_migrations.schema_migrations`: esta aplicación manual queda registrada aquí y en el historial de SQL Editor; una futura adopción de CLI deberá reconciliar las tres migraciones ya instaladas.

Añade `private.account_presence` con RLS y sin permisos de navegador, y la RPC autenticada `presencia()` sin argumentos: la identidad siempre procede de `auth.uid()`. El backend la expone como `POST /api/presencia` con cuerpo `{}` y respuesta `{ "activa": true }`. No admite identidad, estado ni fecha enviados por el cliente.

La UI envía una marca cada 30 segundos mientras está visible. `comunidad()` considera en línea una amistad aceptada con marca de los últimos 90 segundos y solo publica `enLinea`, nunca su fecha de actividad. Al ocultar, cerrar o abandonar una pestaña se deja de renovar; la marca caduca automáticamente. Cerrar una sesión no apaga otras pestañas o sesiones de la misma cuenta. Puede existir un retraso de hasta 90 segundos antes de figurar desconectado. Las lecturas no renuevan la presencia.

`comunidad()` también devuelve `presenciaDisponible: true` y hasta doce `sugerencias`, seleccionadas por proximidad de nivel y desempate estable por código público. Excluye la cuenta propia, amistades aceptadas y solicitudes pendientes en ambas direcciones. Cada propuesta contiene código, nombre y nivel; su `enLinea` siempre es falso, para no revelar actividad de desconocidos. La respuesta de `amistad()` usa la misma proyección, así que una solicitud retira inmediatamente su propuesta. Los datos provienen de perfiles reales. Sin la migración, el adaptador conserva el contrato antiguo y devuelve `presenciaDisponible: false`, sugerencias vacías y `enLinea: false`; la UI puede distinguir ausencia de datos de cero amigos conectados.

Validación local: `node supabase/tests/run-pglite.mjs` ejecuta las tres migraciones y suites SQL con rollback. La nueva suite verifica autenticación, permisos/RLS, caducidad/renovación, exclusión de relaciones, límite/orden de sugerencias y ausencia de UUID o fechas privadas. Para PostgreSQL de pruebas con las tres migraciones, ejecutar `psql -v ON_ERROR_STOP=1 -f supabase/tests/amigos_presencia_sugerencias.sql`. No certifica Auth/PostgREST remoto ni concurrencia entre conexiones.

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

## Comunidad, clasificación y misiones

Aplicada y verificada el 2026-10-06 en Supabase Tesis `ncvyaxhfbcknviznucii` (main/PRODUCTION), con autorización del usuario. No volver a aplicar `202610060001_comunidad_misiones.sql` en ese proyecto. Diez controles de instalación pasan; consulta de solo lectura reproducible en `tests/verificar_comunidad_instalacion.sql` y evidencia en `../docs/qa/comunidad/supabase-migracion-verificada.jpg`. Pendiente desplegar código y verificar Auth/PostgREST y concurrencia real.

Aplicar también `migrations/202610060001_comunidad_misiones.sql`, después de la migración de cuentas. Añade códigos públicos estables de amistad de 16 caracteres hexadecimales aleatorios, separados del UUID de autenticación. Los códigos se pueden compartir; no permiten controlar otra identidad. Los listados públicos solo muestran código, nombre y nivel; el ranking incluye XP, victorias y partidas terminadas. No muestra correo ni UUID de autenticación. El código no es editable por el navegador.

Las nuevas RPC autenticadas son `comunidad()`, `amistad(p_codigo,p_accion)`, `ranking(p_criterio)`, `misiones()` y `reclamar_mision(p_id)`. Son `SECURITY DEFINER` con `search_path` vacío, comprueban `auth.uid()` y proyectan únicamente campos públicos. `anon` no puede ejecutarlas. Las tablas nuevas permanecen en `private`, con RLS y permisos revocados al navegador; tampoco se expone el helper de misiones.

Una solicitud puede aceptarla exclusivamente su receptor. Las acciones son `solicitar`, `aceptar`, `rechazar`, `cancelar` y `eliminar`. Las relaciones tienen una clave única con los dos UUID ordenados; una solicitud inversa conserva la solicitud original y no acepta automáticamente. Los reintentos de solicitar/aceptar/eliminar son seguros. Cada cuenta admite como máximo cien relaciones, contando amistades y solicitudes pendientes; esto limita las respuestas y evita una bandeja sin límite. Se bloquean ambos perfiles en orden de UUID antes de modificar relaciones o insertar claves foráneas, siguiendo el orden del registro de resultados.

El ranking admite `xp`, `victorias` y `partidas`, devuelve cincuenta entradas y la posición propia aunque quede fuera de ellas. Las posiciones usan `rank()` con empates (1, 1, 3); el orden dentro de un empate es estable por código público. Nivel: `1 + floor(xp / 500)`.

Las misiones diarias son jugar una partida (50 XP) y ganar una (75 XP); las semanales son jugar tres (100 XP), jugar siete (200 XP) y ganar tres (150 XP). Reinician a medianoche UTC y el lunes a medianoche UTC respectivamente. El progreso se deriva exclusivamente de resultados autoritativos persistidos en `private.matches` y `private.match_participants`, finalizados desde la activación de la migración y dentro de la ventana actual; las fechas futuras no cuentan. Las partidas de invitados no contribuyen a misiones de cuenta. No hay premios retroactivos.

Los IDs incluyen ventana y fecha: `diarias:jugar1:2026-10-06` o `semanales:jugar7:2026-10-05`. Solo se pueden reclamar misiones completadas de la ventana vigente. Reclamar bloquea primero el perfil e inserta un recibo único `(user_id,mission_id)`; añade XP únicamente cuando ese recibo es nuevo. Recibo y XP están en la misma transacción. No se bloquean filas de partidas durante el reclamo, evitando invertir el orden de bloqueos del registro de resultados. Los premios son acumulables y no cambian las reglas del juego. Se conservan recibos históricos para impedir duplicados y auditar recompensas.

La prueba local `node supabase/tests/run-pglite.mjs` aplica ambas migraciones y ejecuta ambas suites en una base efímera. Para PostgreSQL remoto de pruebas, ejecutar además `psql -v ON_ERROR_STOP=1 -f supabase/tests/comunidad_misiones.sql`. Esta suite usa IDs propios y revierte sus cambios. Comprueba consentimiento, solicitudes inversas, acciones inválidas, códigos/RLS, privacidad, ranking con empates y posición fuera del top, progreso, caducidad, misiones incompletas y reclamo repetido. La concurrencia real necesita varias conexiones: probar solicitudes inversas simultáneas, dos reclamos del mismo premio, reclamo simultáneo al registro de resultado y partidas distintas con usuarios compartidos; PGlite de una sola conexión no certifica esos escenarios.
