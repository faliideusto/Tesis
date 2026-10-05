# Amigos, ranking y misiones

**Instalación remota verificada el 2026-10-06:** migración `202610060001_comunidad_misiones.sql` aplicada en el proyecto Supabase Tesis (`ncvyaxhfbcknviznucii`), rama main/PRODUCTION, mediante SQL Editor. Transacción completada con éxito y diez comprobaciones posteriores correctas. No volver a aplicar esta migración. Quedan pendientes el despliegue del código y las pruebas del flujo real de cuentas y concurrencia.

Comprobación de solo lectura en `supabase/tests/verificar_comunidad_instalacion.sql`; evidencia visual en `docs/qa/comunidad/supabase-migracion-verificada.jpg`. Se verificaron RLS, permisos RPC, códigos válidos/únicos, cinco misiones, activación registrada y protección de XP/estadísticas. No se crearon cuentas ni resultados de prueba en producción.

La comunidad amplía las cuentas opcionales de Tesis. El juego como invitado sigue disponible. Amigos, ranking y misiones requieren sesión y la segunda migración de Supabase.

## Amigos

Cada perfil tiene un código público y estable para compartir. Introducir el código de otra persona envía una solicitud; solo su destinatario puede aceptarla. Ambas personas pueden eliminar una amistad. Se pueden rechazar solicitudes recibidas y cancelar las enviadas. Los nombres pueden repetirse: el código identifica el perfil.

El código de amistad no es un token de acceso ni un código de sala. Los listados solo muestran código, nombre y nivel: no exponen correos, UUID de autenticación, manos ni historial. Las amistades no conceden acceso a salas; para jugar se sigue compartiendo el código de sala. Cada cuenta admite hasta 100 contactos, incluidas las solicitudes pendientes.

## Ranking global

Tres clasificaciones: XP (y su nivel derivado), victorias y partidas terminadas. Cada consulta incluye los primeros 50 perfiles y la posición propia, incluso fuera del listado. Los empates en la métrica elegida comparten posición; el código ordena su presentación de forma estable. Las victorias empatadas en prestigio siguen contando según el motor.

Nombre visible, código y estadísticas de juego de las cuentas aparecen en el ranking para otras personas con sesión. El ranking no expone el correo ni el historial de partidas. La XP de misiones cuenta para el ranking de XP.

## Misiones

| Periodo | Objetivo | Recompensa |
| --- | --- | --- |
| Diario | Terminar 1 partida | 50 XP |
| Diario | Ganar 1 partida | 75 XP |
| Semanal | Terminar 3 partidas | 100 XP |
| Semanal | Terminar 7 partidas | 200 XP |
| Semanal | Ganar 3 partidas | 150 XP |

El día comienza a las 00:00 UTC; la semana, el lunes a las 00:00 UTC. La interfaz muestra la fecha de renovación en la zona del navegador. Cada objetivo tiene su propia recompensa, reclamable una vez por periodo antes de su renovación. Se conservan los recibos de recompensas ya reclamadas.

Solo cuentan partidas completadas con la cuenta vinculada al entrar en la sala y resultados confirmados por el servidor. No cuentan partidas abandonadas ni resultados anteriores a la activación de las misiones. La fecha autoritativa de finalización decide el periodo, incluso si el guardado se retrasa. Si el resultado sigue pendiente, actualizar las misiones después de su confirmación. La XP es cosmética y no modifica cartas, acciones ni reglas.

## Instalación

1. Mantener la migración de cuentas existente `202610050001_cuentas_progresion.sql` aplicada.
2. Aplicar una vez `supabase/migrations/202610060001_comunidad_misiones.sql`, primero en un entorno de pruebas, como propietario.
3. Publicar el backend y el frontend de la misma revisión. No hay nuevas variables ni dependencias de producción.
4. Comprobar dos cuentas: enviar/aceptar/eliminar amistad, consultar las tres clasificaciones, completar partidas y reclamar misiones. Verificar recarga y doble solicitud.

La segunda migración ya está aplicada en el proyecto Tesis indicado arriba; esta tarea no despliega el servicio. En otros servidores sin la segunda migración, las consultas de comunidad mostrarán un error y podrán reintentarse desde la interfaz; la mesa continúa funcionando.

## Contrato HTTP

Todos los endpoints usan el JWT de la cuenta en `Authorization: Bearer …`. Las mutaciones usan JSON y `X-Tesis: 1`, con validación de origen existente. No se admite identidad de actor en el cuerpo.

| Endpoint | Entrada |
| --- | --- |
| `GET /api/comunidad` | Amigos y solicitudes propios |
| `POST /api/amigos` | `{codigo, accion}`; solicitar, aceptar, rechazar, cancelar o eliminar |
| `GET /api/ranking?criterio=xp` | Criterio xp, victorias o partidas |
| `GET /api/misiones` | Progreso y fechas de renovación |
| `POST /api/misiones/reclamar` | `{id}` de una misión vigente |

Los RPC de usuario operan con la identidad Auth; solo el RPC de resultados existente usa credenciales privilegiadas. La base de datos protege amistades y recibos; el navegador no puede declarar partidas, victorias ni XP.

## Validación

179 pruebas Java, 9 suites Node y ambas suites SQL locales pasan. La nueva QA de navegador `tools/qa_community.mjs` pasa a 1440, 390 y 360 px, con evidencia en `target/qa-community/`. Comprueba flujos de amistad, ranking, misiones, errores y teclado usando la interfaz real con SDK y respuestas simuladas: no verifica el servicio Supabase desplegado. PGlite verifica SQL y permisos con una sola conexión, sin demostrar concurrencia real entre conexiones.

La QA de perfil anterior encuentra una aserción fallida de cabecera móvil a 360 px que se reproduce con el código previo. Ver el plan `.agent/plans/comunidad-ranking-misiones.md` para comandos, evidencia, revisión y escenarios no ejecutados.
