# Bots para completar mesas de matchmaking

## Objetivo
Quien busca partida y no encuentra a nadie puede pulsar «¿No encuentras a nadie?» y empezar al momento una mesa del tamaño elegido completada con bots que juegan solos.

## Contexto
Rama `release/v2.6.0` (creada desde `main` en 9f65280; ya contiene el nerf de Revisor 2 y la iluminación de selección). Antes de este cambio no existían bots: README y `docs/AI_TEAM.md` lo decían expresamente.

## Alcance
- Bot heurístico en el servidor, sin servicios externos ni modelos de lenguaje.
- Sala con una persona y `jugadores - 1` bots creada desde matchmaking.
- Botón en la pantalla de búsqueda, disponible tras 15 s en `BUSCANDO`.
- Aviso de partida de práctica. Los bots usan nombres de persona y no llevan etiqueta en la mesa (petición del usuario).

## Fuera de alcance
- Bots en salas privadas o para sustituir a quien abandona.
- Niveles de dificultad, bots con IA generativa.
- Mezclar varias personas de la cola con bots: solo entra quien pulsa el botón; el resto sigue buscando.
- Cambios de reglas del motor.

## Áreas afectadas
- `src/main/java/es/tesis/web/CerebroBot.java` (nuevo): decide una `Vistas.Peticion` a partir de la `Vistas.Estado` del propio bot.
- `SalaJuego`: registro de bots, avance diferido, progreso `PRACTICA`.
- `SesionJuego`: `enTurno()`.
- `GestorSalas.crearPartidaConBots`, `GestorMatchmaking.rellenar` y campo `bots` de `Vista`.
- `ServidorWeb`: `POST /api/matchmaking/bots`.
- Frontend: `api.js`, `matchmaking.js`, `account-panel.js`, `matchmaking.css`.
- Tests: `SalasBotsTest`, `GestorMatchmakingTest`, `MatchmakingHttpTest`, `tests/matchmaking.test.mjs`.

## Fuente de verdad
`SesionJuego.vista/acciones/habilidad` define qué puede hacer el jugador actual; el bot solo elige entre esas opciones. `SalaJuego` sigue siendo el único punto que sincroniza y aumenta la revisión exterior.

## Plan de implementación
- [x] Inspección y contratos.
- [x] Backend: cerebro, sala, gestor, matchmaking y ruta HTTP.
- [x] Frontend: botón y aviso de práctica.
- [x] Tests JUnit y Node.
- [x] Revisión del diff combinado.

## División multiagente
Ejecución directa y secuencial por el Lead: el contrato backend/frontend es pequeño y está acoplado.

## Criterios de aceptación
- El botón solo se ofrece, y el servidor solo lo acepta, en `BUSCANDO` y tras la espera mínima.
- La mesa creada tiene exactamente el tamaño elegido, con la persona como anfitriona y primera identidad.
- Los bots eligen personaje y juegan turnos completos hasta el final de la partida sin intervención.
- Un bot nunca recibe información que no tendría una persona en su asiento.
- Las partidas con bots no registran progresión ni ranking.
- Las mesas solo de personas se comportan igual que antes.

## Tests
- `mvn test`: 238 tests, 0 fallos.
- Suites Node `tests/*.test.mjs`: 21 archivos, 0 fallos.
- Manual en navegador (servidor local en 8091): búsqueda de mesa de 3, aparición del botón tras la espera, creación de la mesa, selección de personaje de los bots y primer turno completo de un bot, sin errores de consola.
- No ejecutado: `tools/qa_matchmaking.mjs`, partida completa en navegador ni anchura móvil.

## Riesgos
- Los bots avanzan en las consultas de sala (como el cierre automático de `FIN_RONDA`): si la persona deja de consultar, la mesa se detiene. Cada paso aumenta la revisión exterior.
- Un fallo del cerebro no debe bloquear la mesa: hay una jugada de respaldo (primer personaje, resolver habilidad inicial o terminar turno).
- Ritmo: 1,4 s entre jugadas de bot para que el cliente pueda animarlas.

## Decisiones
- 2026-10-10: bot heurístico en Java en lugar de un modelo de lenguaje: sin coste, sin claves ni latencia, y determinista en tests.
- 2026-10-10: las partidas con bots son de práctica y no dan XP ni cuentan para ranking, para que no se pueda subir en la clasificación jugando contra bots. Pendiente de confirmar con el usuario.
- 2026-10-10: el usuario pide que los bots lleven nombres de persona y no se marquen como bot; se retira el indicador del DTO.
- 2026-10-10: espera mínima de 15 s decidida en el servidor (`Vista.bots`), no en el cliente, para que sobreviva a recargas.

## Estado
Terminado. Sin commit.
