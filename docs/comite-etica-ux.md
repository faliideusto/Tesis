# Comité de Ética: presentación y privacidad

La selección privada reutiliza `roleCard`, `CatalogoVisual.rol`, las ilustraciones,
el marco y las reglas tipográficas de las cartas existentes. `Opcion.rol` contiene
solo el catálogo de personajes elegibles; las opciones solo llegan al jugador activo.
No se filtran roles según quién los haya elegido ni según el descarte.

La selección eleva la carta, atenúa las demás, revisa el expediente durante 650 ms,
estampa durante 420 ms y mantiene el impacto 850 ms antes de enviar la acción habitual.
No añade acciones ni altera el motor. El texto público de `habilidad.comite_etica`
ya no incluye el rol elegido; el historial interno del motor permanece intacto.

`turno.vetado`, generado por el motor y numerado por la sesión, activa el anuncio
de turno completo (3600 ms, la misma animación que los demás turnos), el expediente (600 ms), el sello y mensaje (1800 ms) y la salida
(600 ms). No se muestra carta: la proyección actual no revela públicamente el rol
del jugador saltado. Solo se utiliza el nombre público del actor del evento.

Los turnos normales encadenan el anuncio (3600 ms) con la carta completa de
`roleCard`: entrada de 600 ms, lectura inmóvil de 3000 ms y salida hacia el jugador de
250 ms. La línea temporal es lineal y solo los tramos de movimiento llevan aceleración,
para respetar esos tiempos reales. `fase.turno` incluye `rolPublico`, una copia del catálogo en el momento
del evento; no se toma el personaje de una vista privada ni de una ronda posterior.
`turno.vetado` no incluye ese campo y sigue sin revelar la carta, también en el
navegador del propio afectado. La cola espera cada apertura de turno y evita un
segundo anuncio al pintar el tablero. Los efectos automáticos del comienzo se
presentan después de la carta. No se modifica el motor ni sus efectos.

La cola existente espera la secuencia antes de pintar el siguiente estado. Los
clientes comparten evento y orden, no un reloj ni una barrera de confirmaciones:
el polling puede desplazar el inicio entre clientes. El servidor sigue avanzando.
Los números ya consumidos no se repiten; la carga inicial establece la referencia
sin reproducir historial. Las pestañas ocultas esperan a ser visibles; si se ocultan
durante el anuncio, lo vuelven a presentar al regresar para permitir su lectura.

Validación: `mvn test` (134 pruebas), `tests/effects.test.mjs` (11 pruebas) y
`py tools/qa_ethics.py` contra el servidor en 8091. Esta última comprueba tres
contextos Chrome, selección y sello privados, catálogo, descripciones, hover,
1920/1366/768/390 px, anuncio compartido, siguiente turno, polling, recarga y
el ciclo de visibilidad simulado. Capturas: `target/qa-ethics/`.

Validación de la revelación: `mvn test` (135 pruebas), `tests/effects.test.mjs`
(15 pruebas) y `py tools/qa_role_reveal.py`. Esta última comprueba tres navegadores
aislados a 1440/390/768 px, cartas y descripciones completas, tiempos, ausencia
de solapamientos, veto privado, siguiente turno, polling y recarga.
Capturas: `target/qa-role-reveal/`.
