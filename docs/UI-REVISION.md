# Segunda pasada de UI/UX — 19 de septiembre de 2026

Se conserva el motor Java, sus validaciones, los PNG y la dirección artística.

## Implementación

- `css/game.css`: distribución del tablero con alturas reservadas para mano y acciones, tipografía e iconos mayores, rival de mayor tamaño con pocos jugadores y compacto con cuatro o cinco, panel local ajustado a su contenido, estudios con altura adaptativa, contraste de acciones deshabilitadas, avisos fuera de la mano y ajustes para escritorios de menor altura. Se sustituyeron las reglas originales de escritorio y sus overrides anteriores; no se aplica zoom global.
- `css/cards.css` y `js/cards.js`: geometría común de las superposiciones. El medallón usa una zona proporcional al PNG y `grid/place-items:center`, con altura de línea 1. Las estadísticas se dividen en tres contenedores iguales con ejes 20,7 %, 50 % y 79,3 % del marco, centrando cada cifra en ambos ejes. No hay excepciones por personaje, carta ni valor.
- Las cartas de personaje crecen de 168 a 216 px en 1920; los nombres y habilidades disponen de zonas separadas. La indicación de frecuencia se presenta debajo de la carta; la habilidad completa permanece en la descripción accesible y el detalle. Investigador Principal, Editorial y Revisor 2 se revisaron renderizados.
- `js/players.js`: fila de estudio compartida `studyRow`, conservando miniatura, nombre, progreso y barra; pie de academia en flujo normal.
- `js/board.js`: tamaño de mano y cantidad de jugadores disponibles para el layout; estado vacío de estudios. La superposición de cartas depende del ancho disponible y del número real de cartas.
- `js/app.js`: Trabajar filtra por los índices permitidos por Java, utiliza la misma fila de estudio y abre el detalle existente. El botón de trabajo mantiene la acción original.

Todas las rutas de implementación son relativas a `src/main/resources/static/`.

## Verificación ejecutada

Chrome real en modo headless, controlado con Playwright, sobre el servidor local. Se inspeccionaron capturas renderizadas, no solo CSS o medidas DOM.

- Tablero a 1920×1080, 1600×900 y 1366×768. Se corrigieron solapamientos mano/barra, mazos/rival y aviso del Comité/mano durante las iteraciones.
- Mesas reales de una, dos y cinco personas; manos de una, dos y siete cartas; cero, uno y dos estudios. Los estados se alcanzaron con acciones válidas de la interfaz o de la API del juego, sin modificar el estado del motor.
- Selección y confirmación de personajes. Inspección conjunta de los ocho roles usando los componentes reales y datos del servidor; comprobación de números 1–8, nombres largos y habilidades. A menor anchura la selección se distribuye en varias filas y el modal permite desplazamiento vertical.
- Cartas comunes, raras y épicas, incluida Cohortes con 3 / 3 / 5. Apertura del detalle desde una carta parcialmente superpuesta.
- Trabajar con uno y dos estudios, acceso al detalle, trabajo y publicación automática de Artículo Ecológico. Cobrar, Pensar, Iniciar, selección, relevo, fin de turno, cambio de ronda y habilidad del Comité ejercitados.
- Tooltip de Trabajar inspeccionado; imágenes cargadas sin roturas y sin desbordamiento horizontal en el tablero examinado. No se observaron errores JavaScript en la sesión instrumentada.
- `mvn clean test`: **93 pruebas, 0 fallos, 0 errores, 0 omitidas**.
- `mvn -DskipTests package`: empaquetado del JAR.

Las pruebas de componentes usaron exclusivamente DOM temporal en el navegador de pruebas. No se añadió instrumentación a producción. La herramienta descargada para la revisión estaba en target y fue eliminada por la limpieza de Maven.

## Evidencia

Las capturas previas se sustituyeron por capturas actuales de Tesis. El informe anterior conserva su alcance histórico; la validación actual se detalla en [Rebranding](REBRANDING.md).

- [Inicio](qa/inicio.png)
- [Sala de espera](qa/lobby-fali.png)
- [Mesa de Fali](qa/mesa-fali.png)
- [Mesa de Jefe](qa/mesa-jefe.png)
- [Personajes](qa/personajes.png)
- [Resultado final](qa/final-fali.png)

## Límites

La validación visual se realizó en Chrome de escritorio; no es una certificación de otros navegadores ni de móvil. En ventanas de poca altura, los modales con varias filas de personajes requieren scroll. No se completó una partida hasta victoria desde el navegador en esta pasada; esa ruta está cubierta por las pruebas Java existentes. Esta revisión visual se realizó antes del cambio al mazo inagotable de siete tipos de idea, que ahora permite hasta siete jugadores.
