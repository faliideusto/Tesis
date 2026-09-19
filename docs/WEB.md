# Web multijugador

## Arquitectura

`ServidorWeb` sirve los assets y la API HTTP del JDK. `GestorSalas` registra hasta 256 salas independientes. Cada `SalaJuego` conserva un mapa privado token → `Jugador`, un anfitrión y su propia `SesionJuego`. Esos mismos objetos `Jugador` pasan a la `Partida` al iniciar: no existe un segundo modelo de recursos ni reglas de red. `SesionJuego` genera DTOs y utiliza las acciones, habilidades y estados existentes del motor.

Los estados de sala son `LOBBY`, `EN_PARTIDA` y `FINALIZADA`. Una única instancia Java mantiene todo en memoria. El código tiene cinco caracteres aleatorios de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; se comprueba la colisión antes de registrar. Los tokens tienen 32 bytes de `SecureRandom`, codificados Base64 URL sin padding. Solo se devuelven al crear/unirse, nunca en las vistas de sala o de partida.

## API

| Método | Ruta | Cuerpo JSON | Autorización |
| --- | --- | --- | --- |
| GET | `/api/config` | — | Pública, límites 2–7 |
| POST | `/api/salas` | `{nombre}` | Crea anfitrión |
| POST | `/api/salas/{codigo}/unirse` | `{nombre}` | Entra solo en lobby |
| GET | `/api/salas/{codigo}/estado` | — | `Authorization: Bearer TOKEN` |
| POST | `/api/salas/{codigo}/iniciar` | `{revision}` | Token del anfitrión |
| POST | `/api/salas/{codigo}/accion` | `{revision,tipo,indice?,objetivo?}` | Token del jugador activo |

Todas las mutaciones requieren `Content-Type: application/json` y `X-Tesis: 1`. El origen debe coincidir con el host HTTP/HTTPS o con `PUBLIC_ORIGIN`, si está configurado. No se habilita CORS. El límite de cuerpo es 8 KiB. En la API de salas se rechazan campos desconocidos, incluidos intentos de aportar una identidad arbitraria. Los códigos se normalizan a mayúsculas; nombres de 1–24 caracteres, sin controles y únicos sin distinguir mayúsculas en cada sala.

Tipos de acción: `SELECCIONAR`, `COBRAR`, `PENSAR`, `INICIAR`, `TRABAJAR`, `HABILIDAD`, `FIN_TURNO`, `SIGUIENTE_RONDA`. Los índices son cero-based y solo tienen sentido en la revisión y perspectiva recibidas. El objetivo de una habilidad identifica su objetivo, nunca al actor.

Creación: HTTP 201 y `{codigo,playerToken,sala}`. Unión: HTTP 200 con el mismo formato. Consulta y mutaciones: HTTP 200 con `Sala`. Errores: `{error}`; 400 datos/reglas inválidos, 401 identidad inválida, 403 actor/origen no autorizado, 404 sala/ruta inexistente, 405 método incorrecto, 409 revisión o fase de sala incompatible, 413 cuerpo excesivo.

El arranque normal y `ServidorWeb(String host,int puerto)` **no exponen `/api/game*`**. Para conservar sin cambios las pruebas originales se mantiene el constructor `ServidorWeb(int puerto)`: abre exclusivamente loopback y sesiones locales por cookie, aisladas por completo del registro de salas. Ninguna ruta local puede acceder a una partida de sala. No hay opción de activarlas en el arranque público.

## Contrato y privacidad

`Vistas.Sala`: código, revisión, fase de sala, `yo`, anfitrión, `soyAnfitrion`, nombres de participantes y `partida`. En lobby no hay partida. `yo` procede del token; es un nombre único e inmutable dentro de la sala, no una autorización suministrada por el cliente.

`partida` reutiliza `Vistas.Estado`. Su revisión interna pertenece al adaptador; el frontend envía siempre la revisión exterior de la sala. El servidor traduce entre ambas bajo bloqueo. `actual` indica el actor del motor y es independiente de `yo`.

Cada jugador recibe su mano, incluso mientras espera, su rol asignado, los estudios y recursos públicos de todos, el número de cartas rivales y únicamente los roles rivales ya revelados. El rol se revela al alcanzar su turno; la selección del rival se registra en la crónica sin nombre de personaje. Las opciones del mazo de personajes y las acciones solo se envían a quien está decidiendo. Los datos internos del motor, instantáneas de persistencia e historial bruto nunca se serializan a la red.

Pensar roba una carta directamente: no existe una segunda elección ni descarte en estas reglas. Los selectores visuales de carta/estudio no pagan ni ejecutan nada hasta confirmar; F5 los cancela sin mutaciones. La obligación del Comité sí reside en el motor y reaparece al consultar tras recargar.

Las habilidades conservan su semántica. La inmunidad de Decana existe antes de su turno; las opciones de objetivos válidos y el rechazo de una habilidad pueden permitir deducir esa inmunidad, como efecto observable de la regla existente. El JSON no entrega su rol oculto. Tampoco es posible impedir deducciones derivadas del orden de turno, un veto o los roles que quedan al recibir el mazo.

## Concurrencia, vida de salas y frontend

Las operaciones de cada `SalaJuego` son sincronizadas: identidad, versión, ejecución y DTO quedan protegidos por el mismo bloqueo. Cada mutación válida incrementa su revisión una vez. Un segundo envío con la revisión anterior recibe 409, incluidas acciones desde pestañas duplicadas. Las consultas no cambian la revisión. Salas diferentes no comparten jugadores, mazos, motor ni eventos.

El registro usa `ConcurrentHashMap` y serializa la generación/inserción de salas. Limpieza cada minuto y antes de crear: caducidad tras 24 horas sin actividad válida. Consultas autenticadas renuevan actividad; tokens inválidos no. Marcar la sala caducada usa su mismo bloqueo, evitando reactivar una sala retirada por una carrera con la limpieza. No se cierra una sala mientras sus clientes mantienen polling.

`api.js` guarda código/token en `sessionStorage`, encola las peticiones y limita cada fetch a 12 segundos. `app.js` programa la siguiente consulta 900 ms después de resolver la anterior. Cancelar el temporizador e invalidar su generación evita aplicar respuestas de una pantalla anterior. Las acciones pausan el polling y bloquean botones; los fallos ambiguos de red no reenvían acciones automáticamente.

Solo una revisión nueva reconstruye las partes que cambiaron. El helper `update` conserva nodos cuyo HTML no cambia. Polls sin cambios no cierran modales, reinician scroll ni repiten efectos. Un cambio real de revisión invalida selectores obsoletos. Los avisos visibles se limitan a tres. Tras un fallo temporal se conserva identidad/mesa y se muestra «Reconectando…». Un token inválido o sala caducada deja volver al inicio. El menú puede pausar el polling y permite volver a la sala guardada.

Los estudios rivales y los últimos movimientos permanecen visibles en la mesa. La elección de personaje y los resultados se abren a petición del jugador; el cierre de ronda utiliza un aviso con botón de continuación. Los eventos públicos incluyen `tipo`, `actor` y, solo para el intercambio del Plagiador, `objetivo`, para distinguir animaciones sin interpretar el texto ni exponer información privada. Detalles y pruebas: [Mesa visual](MESA-VISUAL.md).

## Despliegue y límites

Ver README para `HOST`, `PORT` y `PUBLIC_ORIGIN`. Para dispositivos de la misma LAN se usa la IP del ordenador servidor. Para redes distintas se necesita backend Java accesible públicamente y HTTPS; configurar su proxy/host/puerto y acceso de red. No se ha contratado, publicado ni desplegado nada.

Una sala no migra entre instancias. Reiniciar elimina salas y tokens. No hay transferencia de anfitrión, expulsión, sustitución de jugadores, espectador ni nueva partida dentro de la misma sala. Perder `sessionStorage` significa perder esa identidad; no se recupera mediante el nombre. Cerrar la pestaña puede borrarlo. Los jugadores deben conservarla para reconectar. El límite de salas y la expiración son sencillos; antes de una exposición pública amplia conviene añadir límites de solicitudes en el proxy.
