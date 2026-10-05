# Cartas integradas sobre la mesa

## Objetivo
Artículos visibles directamente sobre el tablero, sin soportes rectangulares, con perspectiva y sombras físicas contenidas. Al iniciar un estudio, la carta aterriza con dos rebotes pequeños, sin repetirlos por polling.

## Contexto
Rama release/v2.1.0, checkout limpio, base de retorno 50fac2e. No crear otro commit sin petición. Servidor de QA localhost:8091; actualizar target/classes/static al integrar.

## Alcance
Solo presentación de artículos en desarrollo/publicados. Mantener todas las cartas visibles sin scroll, tamaño por cantidad, información de progreso y consultas. Conservar animaciones existentes, reglas, privacidad y contratos HTTP.

## Áreas y contrato
- Mesa: players.js y premium.css (o nueva hoja específica si mejora aislamiento).
- Animación: effects.js y pruebas de efectos; consume DOM final renderizado por board antes de settled. No modificar app.js, API ni motor.
- Lead: integración, board.js/index.html si necesario, documentación y revisión.
- QA: script propio tools/qa_tabletop_v210.mjs y capturas target/qa-v210/tabletop.
- Carta destino: `.table-study` con data-player y data-index existentes; composición puede agregar custom properties para inclinación, sin modificar identidades. El transform permanente lo controla CSS; animación preferentemente sobre el wrapper `.table-study-slot` para no competir con hover.

## Plan
- [x] Inspección, base y contrato de propiedad.
- [x] Composición de cartas y zonas sin paneles.
- [x] Aterrizaje por nuevos estudios con cancelación, deduplicación y movimiento reducido.
- [x] Integración y QA responsive, flujo real y animación.
- [x] Revisión combinada y capturas finales.

## Equipo
| Agente | Archivos exclusivos | Aceptación |
| --- | --- | --- |
| mesa | players.js, premium.css | Mesa natural, zonas distinguibles, todas las cartas visibles, sin perder recursos/personajes/botones |
| portada | effects.js, tests de animación | Aterrizaje posterior al render, rebotes suaves, no polling/reconexión inicial, cancelable y reducido |
| qa | tools/qa_tabletop_v210.mjs, evidencia ignorada | Medidas y capturas escritorio/móvil, 3/4/5 personas, varias cantidades, teclado, una colocación real, no repetición |

## Riesgos
Transformaciones pueden cortar cartas, mover hitboxes o competir con hover. Nuevos índices/eventos pueden producir falsos aterrizajes. Animaciones deben limpiarse al abandonar la mesa. Revisar contra base y preservar comportamiento existente.

## Validación
Ocho suites Node aprobadas, incluidas 25 pruebas de efectos y geometría individual de perspectiva. Revisión estática detectó glow que sobrescribía perspectiva; se conserva su brillo sin transformación sobre artículos. QA final: 147/147 layouts aprobados, colocación real normal/reducida, deduplicación, cancelación, teclado, hover y detalle. Capturas finales en target/qa-v210/tabletop/report.html. Móvil conserva scroll vertical de página, sin scroll horizontal de artículos.

## Decisiones
2026-10-05: quitar soportes rectangulares, conservar las ilustraciones y el marco propio de cada carta. Ángulos permanentes por índice, no por posición filtrada.
2026-10-05: la revisión visual detecta cartas propias bajo dock/mano también en baseline. Se limita su tamaño máximo según altura disponible para despejar el área, como parte de la composición profesional solicitada.
2026-10-05: el usuario considera que 14 grados sigue pareciendo una carta vertical. Se refuerza el plano a 52 grados (48 al elevar en hover), con compensación de altura y wrappers compactos. Sombras mucho más cortas. Captura de prototipo inspeccionada; se vuelve a validar la composición final.

## Estado
Integrado y revisado. La referencia posterior del usuario sustituye el prototipo de 52 grados por un plano de 40 grados con sesgo calculado por posición de cada carta respecto al punto de fuga común. Se recalcula con render y resize. Backend y reglas intactos. Sin nuevo commit.
