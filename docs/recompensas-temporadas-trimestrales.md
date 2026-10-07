# Recompensas y temporadas trimestrales

Las temporadas del pase y del ranking comparten el calendario de trimestres naturales de Europe/Madrid: enero–marzo, abril–junio, julio–septiembre y octubre–diciembre. Crónicas del Archivo empieza el 1 de octubre de 2026 y termina el 1 de enero de 2027 a las 00:00 de Madrid (31 de diciembre de 2026 a las 23:00 UTC). Las fechas las decide el servidor; el cliente solo muestra el tiempo restante.

## Recompensas

| Evento o misión | XP permanente | Puntos del pase |
| --- | ---: | ---: |
| Terminar una partida | 200 | 200 |
| Ganar una partida, adicional | 100 | 200 |
| Quedar segundo, adicional | 0 | 100 |
| Completa diez partidas de temporada | 1000 | 1000 |
| Gana cinco partidas de temporada | 1500 | 1500 |

El resto de misiones duplica su recompensa anterior tanto en XP como en puntos del pase. En partida, los puestos se calculan con `dense_rank`: quienes empatan en primera posición reciben el extra de victoria; quienes pertenecen al segundo puesto distinto reciben el extra de segundo. Los extras de victoria y segundo no se acumulan para un mismo participante. Una victoria completa concede por tanto 300 XP y 400 puntos del pase; un segundo puesto, 200 XP y 300 puntos.

La reclamación de cosméticos continúa sin conceder XP ni puntos adicionales. Los IDs del catálogo, el inventario permanente y el loadout se conservan. La migración respeta los registros y recompensas ya reclamados: no concede retroactivamente la diferencia ni vuelve a entregar cosméticos. Los periodos anteriores permanecen consultables; la nueva temporada usa progreso independiente.

## Cuenta atrás

Misiones diarias, semanales, de temporada y clasificación semanal/de temporada muestran días, horas, minutos y segundos restantes. El formato compartido se actualiza cada segundo, utiliza las fechas recibidas de la API y mantiene la zona horaria únicamente en el cálculo del servidor. Al expirar, se vuelve a consultar el periodo siguiendo el flujo existente. La UI no calcula fronteras trimestrales ni premios.

## Validación de navegador

`node tools/qa_missions.mjs` utiliza Auth y API simuladas explícitamente, nunca Supabase remoto. Comprueba cuenta atrás viva, temporada trimestral, estados, reclamación única, persistencia de la fixture, inventario, assets y ausencia de XP cosmético; las capturas se guardan en `target/qa-missions/`.

`TESIS_URL=http://127.0.0.1:8140 node tools/qa_ranking_reference.mjs` usa la UI real con respuestas de cuentas/ranking interceptadas y simuladas. Comprueba cuentas atrás vivas, cambio de periodo semanal, geometría, ámbitos, empates y respuestas tardías; las capturas se guardan en `target/qa-ranking-reference/`. Estas pruebas de navegador no demuestran persistencia ni concurrencia en Supabase real; los contratos SQL y Java requieren sus pruebas correspondientes.


Validación combinada: Maven completo 230 pruebas PASS; 21 suites Node PASS; PostgreSQL WASM con doce migraciones PASS. Migración010 aplicada el 7 de octubre de 2026 al proyecto Tesis/main (ncvyaxhfbcknviznucii); SHA256 E060F1CB9179922766C5F3AAB9F1F8E13D878089D675923DC5072E03A95B58A0. El verificador administrativo de solo lectura dio diez PASS. No se modificaron cuentas ni se reclamaron recompensas reales para QA.
