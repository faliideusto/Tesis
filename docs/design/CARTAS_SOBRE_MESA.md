# Artículos sobre el tablero

Base de retorno: commit `50fac2e` en `release/v2.1.0`. Este seguimiento no crea otro commit.

## Composición

`premium.css` elimina las superficies, molduras y encabezados rectangulares de las zonas de artículos. Se conserva su estructura semántica y espacio para que el resto de la mesa no cambie bruscamente. Las etiquetas se leen sobre el mármol con sombra oscura; huecos vacíos discretos, sin cajas.

Las cartas conservan sus ilustraciones y marcos propios. La composición final utiliza un plano de 40 grados y un sesgo lateral individual calculado en `table-perspective.js`: cada centro de carta se orienta hacia el mismo punto de fuga, calibrado con la referencia del usuario. Cartas distintas de una misma fila tienen inclinaciones distintas; las de la izquierda y derecha convergen de forma opuesta. Se recalcula tras renderizar y al redimensionar, con lecturas agrupadas y sin transición durante el ajuste. Una pequeña rotación de −1,4 a +1,4 grados depende del índice público del estudio. Sombras cortas mantienen contacto con el tablero. Hover y foco elevan ligeramente la carta conservando un plano de 38 grados. El wrapper y los huecos vacíos se compactan según la altura proyectada.

Todas las cartas de cada zona se distribuyen simultáneamente, sin desplazamiento horizontal, con tamaño según cantidad. El máximo de las cartas propias también depende de la altura disponible en escritorio, para separarlas de mano y acciones. Pantallas móviles mantienen el desplazamiento vertical de la página completa.

Los títulos de zona se conservan únicamente para lectores de pantalla. Las filas se centran y cada carta identifica su estado: barra y trabajo actual/requerido en desarrollo; «Publicada» y prestigio total, incluido el extra, al publicarse. El espacio superior evita interferir con las hitboxes de los personajes.

## Colocación

`effects.js` añade un aterrizaje después de `board`, mediante `settled`. Solo un nuevo evento público `accion.iniciar_estudio`, asociado a un estudio nuevo del actor y su índice, puede activarlo. Se anima el wrapper de la carta durante 720 ms: caída de 22 px, rebotes de 4 y 1,5 px, escala máxima 1,008 y sombra que se contrae al contacto. La carta interior mantiene su transformación CSS y su hover.

Un watermark evita repetirlo con consultas o snapshots duplicados. La carga inicial no reproduce historial. El registro de época impide que una transición cancelada genere un aterrizaje tardío. `resetEffects` cancela las animaciones; pestañas ocultas consumen el evento sin movimiento. Con movimiento reducido solo hay una aparición por opacidad de 180 ms.

Se conservan los vuelos, efectos de personajes, publicaciones y demás animaciones. El brillo de los artículos conserva color/sombra y omite su escala para no sobrescribir la nueva perspectiva. No se modifica motor, API, polling, identidad, revisión de sala o datos privados.

Los vuelos de inicio y publicación reutilizan `ideaCardContents` para mostrar marco, arte, nombre y valores. La patente legendaria utiliza una sola imagen integrada, sin añadir una segunda ilustración. Comprobado en Chrome y con 27 pruebas de efectos.

## Evidencia

Ocho suites Node aprobadas, incluidas 25 pruebas de efectos y pruebas de perspectiva: destino correcto, nuevo estudio, carga inicial, duplicados, reset, cancelación, movimiento reducido, simetría, profundidad y estabilidad con scroll. Revisión estática combinada sin bloqueantes.

`tools/qa_tabletop_v210.mjs` compara contra los recursos de `50fac2e` mediante interceptación de navegador, sin resetear el checkout. Los layouts de 3/4/5 jugadores y distintas cantidades son datos de ejemplo. El flujo de iniciar un estudio se ejecuta en salas reales de tres identidades, con movimiento normal y reducido; duplicación/reset y cancelación activa se comprueban además en la capa visual.

Capturas y resultados en `target/qa-v210/tabletop/`. No se grabó vídeo porque el runtime carece de ffmpeg; se conservaron capturas durante el aterrizaje y al terminar. No se prueba una partida completa hasta victoria.

Matriz final: 147/147 escenarios aprobados, sin cortes ni colisiones con títulos, narrador, mano o acciones. El ancho CSS del papel no aumenta al añadir cartas; su huella proyectada puede variar ligeramente por su nueva posición. En móvil los jugadores fuera de la pantalla se consultan mediante scroll vertical normal; todas las cartas de cada zona permanecen accesibles sin scroll horizontal. Colocación real normal/reducida, teclado, hover y detalle aprobados.
