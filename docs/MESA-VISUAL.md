# Tesis: acciones visibles en la mesa

La mesa refleja las reglas actuales de siete personajes y hasta seis jugadores.
Editorial es automática y Revisor 2 puede devolver publicaciones a desarrollo.
Se reutilizan las ilustraciones, marcos, colores y tipografías del juego.

## Qué cambia

- Los avisos «Esperando a…» y «Elige…» usan formato oración. La mano se muestra
  sin el encabezado «Tus ideas» ni el contador de cartas.
- Los mazos son más pequeños y permanecen centrados junto a los últimos movimientos.
  Las cartas públicas de los rivales se muestran completas bajo cada academia:
  marco, ilustración, nombre y valores. En escritorio su tamaño se adapta a la
  altura disponible, hasta 150 × 225 px; en móvil usan 120 × 180 px.
  El progreso aparece debajo para no tapar la carta.
- Elegir personaje, avanzar de ronda y consultar el resultado usan el botón inferior
  de la mesa, sin duplicar botones en el mensaje central.
- Los estudios públicos de cada rival aparecen bajo su academia, con su trabajo
  acumulado o una marca de publicación. Se pueden pulsar para consultar la carta.
- Iniciar un estudio mueve su ilustración desde la mano o academia a su lugar
  en la mesa. Los robos se representan con un reverso que sale del mazo.
- Los cambios de monedas, ideas y prestigio aparecen junto al jugador. El trabajo
  anima la barra de los estudios propios; las revisiones y publicaciones resaltan
  el estudio afectado.
- «Últimos movimientos» muestra ilustración, jugador, estudio y recursos. Conserva
  el último movimiento al cambiar de fase; la crónica completa sigue disponible.
- La selección de personaje se abre con «Elegir personaje» en la mesa y se puede
  cerrar para seguir consultándola. El fin de ronda ofrece su botón de continuación
  sin abrir una ventana encima de las últimas acciones. Solo quien pide expresamente
  ver los resultados los abre; los demás tienen el botón en su mesa.
- La distribución permite ver los estudios de todos los participantes y adapta los
  botones de acción y el encabezado a pantallas pequeñas.
- A 1920 × 1080 la mesa, la mano y las acciones caben sin scroll de página.
  Con seis jugadores hay tres rivales arriba y dos debajo de los extremos.
  Con cinco se ocupan las cuatro posiciones laterales; con cuatro, arriba al
  centro y los dos laterales inferiores. Los movimientos ocupan el centro libre.
  Las cartas se solapan solo cuando no caben separadas; al enfocarlas o pasar
  el cursor se levantan, y al pulsarlas se abre su detalle completo.

## Sin retrasar la partida

Las animaciones no envían acciones, no retrasan peticiones ni alteran los turnos.
El adaptador añade tipo y actor a los eventos públicos y el objetivo público del
Plagiador. Así se distingue un robo del mazo de un intercambio entre academias,
incluso cuando ambas manos tienen el mismo número de cartas, sin analizar textos
ni enviar el contenido de las manos o los roles reservados.
Comparan las vistas autorizadas que ya recibe cada navegador. Las manos rivales
siguen siendo privadas y no se deduce su contenido a partir de sus robos.

Si varias acciones llegan entre dos consultas al servidor, se muestran sus cambios
acumulados. El panel mantiene como máximo cuatro movimientos pendientes para no
quedar muy atrasado; los eventos completos se conservan en la crónica existente.
Las recargas muestran el último resumen sin reproducir ganancias antiguas. Una
revisión sin cambios no repite las animaciones. Se respeta la preferencia del
sistema de movimiento reducido, conservando los datos y las ilustraciones.

## Verificación

- `mvn test`: motor, salas, privacidad, persistencia, distribución de robos e ingresos.
- `py tools/qa_multiplayer.py`: partida completa en dos contextos independientes
  de Chrome, todas las acciones base, habilidad, selección voluntaria, estabilidad
  del diálogo durante el sondeo, recargas y recuperación de conexión.
- `py tools/qa_table_feedback.py`: estados controlados de colocación, robo privado
  con mazo inagotable, trabajo, revisión, publicación, estudios duplicados,
  ausencia de repeticiones, cambios de fase sin ventana, movimiento reducido y
  recuperación. Comprueba todas las mesas de dos a seis jugadores en escritorio, tableta
  y móvil, sin desbordamiento horizontal ni solapamiento de secciones.

Los dos scripts requieren Chrome, Playwright y el servidor en `TESIS_URL`
(por defecto `http://localhost:8091`). Capturas e informes se generan en
`target/qa-multiplayer/` y `target/qa-table-feedback/`; las capturas de escenarios
controlados se distinguen de las de la partida real.
