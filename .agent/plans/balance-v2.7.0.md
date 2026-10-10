# Balance y desempate v2.7.0

## Objetivo
Aplicar tres cambios de reglas pedidos por Choquet (10/10/2026):
1. Revisor 2 ya no paga moneda: su habilidad solo retira 1 punto de trabajo.
2. Patente requiere 4 de trabajo en lugar de 5.
3. Un empate en prestigio lo gana quien tenga más monedas; si persiste, quien tenga más cartas.

## Contexto
Rama `release/v2.7.0`, creada desde `main` (`3198789`) sin cambios locales previos.
El mensaje original dice «revisor 1»; el único revisor del juego es **Revisor 2** (orden 7), que era quien pagaba 1 moneda.

## Alcance
- Motor: `Revisor2Habilidad`, `FabricaMazos`, `Partida.ganadores`.
- Adaptador web: opciones, motivo y previsualización de la habilidad en `SesionJuego`; texto en `CatalogoVisual`; heurística de `CerebroBot`.
- Consola: textos de habilidad, aviso, ayuda y orden del resultado final.
- Frontend: reglas en `app.js`, motivo de victoria y orden de clasificación en `dialogs.js`.
- Tests JUnit y documentación vigente (README, `docs/AI_TEAM.md`, notas de XP).

## Fuera de alcance
- Coste, prestigio, ingresos y probabilidad de Patente; resto de cartas y personajes.
- Límites de la revisión (solo rival, en desarrollo, con trabajo, respeta Decana, una vez por turno).
- Contrato de `Vistas`, privacidad, revisiones y progresión/XP.
- Fixtures de QA de navegador en `tools/` y documentos históricos.

## Áreas afectadas
`src/main/java/es/tesis/{habilidades,dominio,web,consola}`, `src/main/resources/static/js/{app,dialogs}.js`, `src/test/java/es/tesis/**`, `README.md`, `docs/`.

## Fuente de verdad
- `Revisor2Habilidad.ejecutarSobreEstudio`: validación y efecto de la revisión.
- `FabricaMazos.crearIdeas`: valores de Patente.
- `Partida.ganadores` y `Partida.ORDEN_VICTORIA`: victoria y desempate.

## Plan de implementación
- [x] Inspección y contratos.
- [x] Implementación (motor, adaptador, consola, bot, frontend).
- [x] Integración y validación.
- [x] Revisión del resultado combinado.

## División multiagente
Ejecución directa del Lead: cambios pequeños y acoplados, sin trabajo independiente que repartir.

## Criterios de aceptación
- Revisor 2 con 0 monedas puede revisar; no pierde monedas; la habilidad sigue consumiéndose una vez por turno.
- La vista web ofrece objetivos sin exigir monedas y la previsualización no menciona coste.
- Patente se publica con 4 de trabajo.
- Empate en prestigio → gana quien tiene más monedas; empate también en monedas → más cartas en mano; empate total → victoria compartida. Un prestigio mayor nunca pierde por desempate.

## Tests
- `mvn test`: correcto tras actualizar los 11 tests que afirmaban las reglas anteriores y añadir tres de desempate en `FlujoYHabilidadesTest`.
- Pruebas Node `tests/*.test.mjs` (21 archivos): correctas.
- No ejecutado: QA de navegador (`tools/qa_*.mjs`); los textos de reglas y el diálogo final solo se revisaron en el código.

## Riesgos
- «Más cartas» son las cartas de idea en la mano (dato ya público como recuento en `Vistas.Jugador.cartas`).
- La victoria compartida ahora es mucho menos frecuente; la progresión sigue usando `Partida.ganadores`, así que el XP de victoria respeta el desempate.
- Las partidas guardadas conservan los valores de carta con que se guardaron (una Patente antigua sigue pidiendo 5).

## Decisiones
- 2026-10-10: `CerebroBot` usa siempre la revisión contra el rival más amenazante, porque ya no arriesga monedas.
- 2026-10-10: el cliente no decide ganadores; solo explica el criterio comparando datos públicos.
- 2026-10-10: Choquet confirma que «revisor 1» es Revisor 2 y que «más cartas» son las cartas en la mano.

## Estado
Terminado. Integrado en `main` (commit `7a4b6ad`, merge `5b2c04d`) y publicado en `origin` y `personal`.
