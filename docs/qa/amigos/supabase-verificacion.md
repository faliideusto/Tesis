# Activación de presencia y sugerencias en Supabase

Fecha: 2026-10-07, aproximadamente 00:14 UTC. Proyecto Tesis, referencia `ncvyaxhfbcknviznucii`, rama main/PRODUCTION. Autorización del usuario: «vale hagamos lo de supabase».

SQL Editor autenticado: se comprobó que profiles, friendships y actor_comunidad existían, mientras account_presence y presencia() no existían. Se aplicó la transacción de `202610070001_amigos_presencia_sugerencias.sql`: «Success. No rows returned». No se modificaron amistades, perfiles ni XP existentes.

La consulta `supabase/tests/verificar_amigos_instalacion.sql` devuelve diez filas, todas `correcto=true`:

- Actor autenticado en ambas RPC.
- Dos RPC autenticadas y sin acceso anónimo.
- Dos RPC SECURITY DEFINER con search_path vacío.
- Presencia caduca a los 90 segundos.
- Servidor con acceso a presencia.
- Sin acceso directo del navegador.
- Sugerencias limitadas y excluyen relaciones.
- Sugerencias y disponibilidad instaladas.
- Tabla privada con RLS.
- Una presencia por perfil y clave foránea.

Prueba funcional SQL con perfil existente, sin publicar identificadores: presencia() responde activa=true; dos llamadas conservan una única marca; comunidad() declara disponibilidad, limita a doce candidatos, excluye actor y relaciones, y no revela presencia de desconocidos ni campos privados. presencia() rechaza actor ausente. Se ejecutó dentro de BEGIN/ROLLBACK: todas las marcas temporales se revirtieron. Resultado visible: «RPC reales, heartbeat repetido, sugerencias, privacidad y actor: OK; cambios revertidos».

No existe registro de migraciones CLI en este proyecto. La instalación manual queda registrada aquí y en el historial de SQL Editor. No repetir la migración; reconciliar instalaciones previas antes de adoptar db push.

Límites: prueba directa SQL; no se certifican sesión Auth/PostgREST, concurrencia entre conexiones ni despliegue del código de aplicación. La captura de los diez controles se mostró durante la ejecución; la herramienta de navegador denegó su exportación al filesystem, por lo que no se incluye un JPEG en el repositorio.

## Perfiles públicos

El mismo día se aplicó `202610070002_perfiles_publicos.sql` en el mismo proyecto para completar la apertura de perfiles desde personas visibles. Antes de aplicar, `perfil_publico(text)` no existía y account_presence sí existía. SQL Editor confirmó «Success. No rows returned».

## Invitaciones a salas privadas

2026-10-07: aplicada manualmente `202610070003_invitaciones_amigos.sql` en Tesis main/PRODUCTION (`ncvyaxhfbcknviznucii`). SQL Editor confirmó «Success. No rows returned». Consulta posterior devuelve cinco controles true: función instalada, ejecución permitida a service_role, anon bloqueado, authenticated bloqueado y destino null para actor/código inexistentes. No se crearon perfiles, amistades ni invitaciones reales. No repetir la migración manual. La aplicación mantiene salas e invitaciones en memoria; esta comprobación SQL no equivale a despliegue web ni a prueba entre cuentas Auth reales.

Prueba funcional dentro de BEGIN/ROLLBACK con un perfil existente: devuelve exactamente ocho campos, código correcto, presencia propia disponible, sin UUID/correo/token/fecha privada. Rechaza actor ausente. Grants posteriores: authenticated=true, anon_bloqueado=true, funcion_segura=true (definer y search_path vacío). Resultado «Contrato de 8 campos, RPC real y actor ausente: OK». No se publicaron identificadores ni se modificaron perfiles o amistades. No repetir esta migración manual; documentada aquí junto a las anteriores.
