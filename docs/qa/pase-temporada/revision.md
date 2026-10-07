# Revisión de la infraestructura del pase mensual

Revisión de SQL, adaptador Java/HTTP y transporte cliente en la rama `codex/infra-pase-temporada`. No se ha realizado QA visual del juego: este cambio prepara infraestructura sin UI. La migración se aplicó al remoto el 2026-10-07 tras autorización explícita del usuario; ver sección de activación.

## Pruebas ejecutadas por QA

- `node supabase/tests/run-pglite.mjs`: pasan siete migraciones y las suites SQL, incluida `pase_temporada.sql`, en PostgreSQL WASM local. Comprueba aislamiento, permisos/RLS, progreso desde recibos, fuentes futuras, repetición de claims, temporadas cerradas, inventario, equipamiento y sustitución del asset.
- Las 15 suites `tests/*.test.mjs` pasan con `node --experimental-vm-modules`; el transporte del pase conserva autenticación y token de sala, admite vaciar slots y no reintenta claims ambiguos.
- La suite Maven completa pertenece al agente Java; el resultado final se recoge en el informe del Lead. QA no ha repetido Maven.

## Revisión del contrato y derechos

El catálogo «Crónicas del Archivo» define diez niveles gratuitos y seis tipos: avatar, marco, título, insignia, reverso y placa. El nivel 10 entrega dos cosméticos mediante un solo claim. SQL guarda recibos únicos por cuenta/tipo de fuente/clave, y claims únicos por cuenta/temporada/recompensa. Las inserciones del claim y del inventario pertenecen a la misma transacción.

Los puntos provienen exclusivamente de `reward_ledger` y `mission_claims`. No se modifican XP, estadísticas vitalicias ni recompensas del motor. La suma es provisionalmente 1:1 respecto a la XP autoritativa y `puntosPorNivel` procede de la configuración de temporada.

Los snapshots conservan identidad, nombre, tipo y rareza. Los triggers impiden reinterpretar o borrar catálogo, plantillas y temporadas existentes. Únicamente el asset admite sustitución administrativa; inventario y premios históricos proyectan su ruta actual, sin cambiar los derechos adquiridos. El equipamiento usa una FK compuesta hacia el inventario del actor y tipo correspondiente; `id:null` retira el equipo sin borrar posesión.

El actor se obtiene del Bearer verificado y de `auth.uid()`. Las rutas rechazan actor, puntos y parámetros ajenos. DTOs explícitos omiten UUID, correo, tokens y detalles remotos. Las rutas de assets se limitan al árbol local de Tesis y extensiones SVG/PNG/WebP, sin URL externa, traversal, query ni fragmento.

## Calendario e historial

Pase y ranking mensual comparten metadatos de temporada y límites civiles de Europe/Madrid; los tests cubren DST y meses históricos. Las recompensas desbloqueadas de temporadas registradas cerradas siguen reclamables. El inventario y los slots no caducan al cambiar de mes.

La instalación sincroniza sólo el mes actual, incluidos recibos de ese mes anteriores a la activación del pase. No crea todos los meses del histórico existente. Un nuevo recibo autoritativo tardío con fecha de un mes anterior sí registra esa temporada y acredita sus puntos. Una fuente futura no acredita anticipadamente y se sincroniza cuando su fecha pasa a ser válida.

## Concurrencia y límites

La revisión estática encuentra orden compatible: perfil primero; el registro de resultados bloquea todos los perfiles en orden de UUID antes de insertar recibos, y misiones/pase bloquean sólo el perfil del actor. PKs y FKs refuerzan unicidad y ownership; los triggers vuelven a bloquear el perfil que la transacción ya posee.

PGlite utiliza una conexión: **no certifica concurrencia real entre varias sesiones, deadlocks bajo carga ni integración Supabase Auth/PostgREST**. No hay `postgres`, `psql` ni `pg_ctl` en PATH, instalación PostgreSQL en Program Files ni runtime nativo disponible en el bundle. No se instalaron servicios para esta revisión.

Antes de una validación de producción siguen siendo pertinentes dos conexiones: claim repetido simultáneo, bundle simultáneo, claim junto a registro de resultado/misión y resultados distintos con participantes compartidos. Tampoco se ha comprobado el arte definitivo ni su integración visual.

## Hallazgos durante la implementación

1. La primera versión permitía que cambiar el tipo del catálogo reinterpretase un premio histórico antes de adquirirlo. Se resolvió con identidad/snapshots inmutables y sustitución exclusiva del asset.
2. Un bundle configurado con un ID desconocido podía omitirlo silenciosamente. Se resolvió con triggers de validación antes de insertar plantillas/premios: cardinalidad, existencia, ausencia de null/duplicados y correspondencia exacta del snapshot. El claim comprueba nuevamente la cardinalidad antes de guardar derechos. El runner final pasa los casos de ID desconocido, duplicado, null y snapshot parcial.

Revisión combinada final: no se encontraron bloqueantes pendientes. La ejecución independiente del runner final y `git diff --check` pasan; el aviso de normalización LF/CRLF no implica un error del diff. Los límites de concurrencia permanecen.

## Activación en Supabase (2026-10-07)

Proyecto Tesis `ncvyaxhfbcknviznucii`, rama main, SQL Editor con rol postgres. Se comprobó que `private.pass_seasons` no existía y que estaban instalados recibos, misiones y calendario de ranking. El contenido del editor se comparó íntegramente con el archivo local antes de ejecutar la transacción; Supabase devolvió `Success. No rows returned`. SHA256 del archivo aplicado: `23B79BB40C973669CEAB32236C2FAFA44B35B3CA096CB24A9A57944D5BA9C7CB`.

`supabase/tests/verificar_pase_instalacion.sql` produjo quince PASS: tablas privadas, RLS, acceso directo revocado, cuatro RPC autenticadas, helpers privados, temporada gratuita mensual, diez niveles, once cosméticos/seis tipos, set final, calendario compartido, triggers activos, recibos actuales recuperados, suma del progreso y coherencia de inventario/equipamiento. La consulta es sólo lectura, sin mostrar identidades ni modificar cuentas.

No se ejecutaron fixtures de usuarios ni reclamaciones sobre cuentas reales, ni pruebas de concurrencia real o integración HTTP/Auth/PostgREST. El editor queda abierto en la consulta de verificación. No repetir la migración.
