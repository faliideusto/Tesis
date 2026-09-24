# Mesa principal de Tesis

La composición de escritorio toma como referencia el mockup aportado: dos academias superiores desplazadas hacia el centro, dos laterales y la academia local abajo. El sello central queda libre. La mano privada tiene su propia franja inferior; cada carta se eleva y se muestra completa con ratón o foco de teclado. El estado público se sitúa en la esquina inferior izquierda y las acciones siguen en el borde inferior.

Los artículos son botones reales, separados en desarrollo y publicaciones. Conservan su índice y las acciones originales. Las listas largas se desplazan horizontalmente, sin reducir todas las cartas a miniaturas. Los espacios vacíos tienen un marco discreto. Encabezados, contadores y progreso se presentan sobre placas oscuras. En móvil se usa una disposición vertical, con mano y acciones fijas, y el fondo original de biblioteca para evitar recortar el título del escenario de escritorio.

## Archivos

- `src/main/resources/static/css/table.css`: composición, placas, bandejas, tamaños adaptables y hover. Se carga después de los estilos generales.
- `src/main/resources/static/js/board.js`: integra academia local y artículos públicos junto a la mano independiente.
- `src/main/resources/static/js/players.js`: representación compartida de artículos; mantiene las listas de los modales existentes.
- `src/main/resources/static/index.html`: carga de la hoja de estilos.
- `tools/qa_table_layout.py`: comprobaciones de geometría, mano, teclado, recursos gráficos, estados vacíos y mesas con muchos artículos.

## Assets finales

Todos están dentro de `src/main/resources/static/assets/Tesis-assets/` y fueron creados con la herramienta integrada de generación de imágenes. Las cartas de artículos, retratos y recursos existentes se conservan.

| Archivo | Uso |
| --- | --- |
| `tablero/mesa_referencia.png` | Escenario de escritorio editado directamente a partir del mockup, sin cartas ni jugadores incrustados. |
| `ui/bandeja_referencia.png` | Bandeja independiente de cuero oscuro y madera con ribete dorado. |
| `ui/placa_academia.png` | Placa vacía con medallón para nombres, roles, retratos y recursos vivos. |
| `cartas/reverso_mesa.png` | Dorso azul decorativo de las ideas de cada academia; solo muestra la cantidad pública. |

El fondo conserva líneas y zonas ornamentales de la referencia. La disposición se adapta al número de jugadores; no es una reproducción píxel a píxel. El espacio inferior adicional para mano y acciones exige una bandeja local más compacta que en el mockup. No se han cambiado reglas, servidor, motor, multijugador, selección de personajes ni modales de habilidades.

## Verificación

```powershell
mvn test
mvn -DskipTests package
# Con servidor en localhost:8091, Chrome y Playwright instalados:
python tools/qa_table_layout.py
$env:TESIS_URL = 'http://localhost:8091'
python tools/qa_activity.py
```

Evidencia generada en `target/qa-table-layout/`: mesa de cinco jugadores, hover, mesas de seis jugadores en cinco resoluciones y estado vacío. La prueba incluye manos de doce cartas y diez artículos por jugador. El vestíbulo actual admite 3–5 jugadores; las pruebas de 2 y 6 se hacen con estados controlados del frontend. El antiguo `qa_multiplayer.py` presupone una sala de dos jugadores y no puede iniciar desde ese vestíbulo sin adaptar el escenario de prueba.

## Prompts finales

### Escenario (edición de la referencia aportada)

Edit this EXACT image to produce a clean background asset for the same game. Preserve the exact 1672x941 composition, camera, rich golden candle lighting, navy marble table, all surrounding books, ivy, globes, candles, parchment, upper library, and the exact central academy temple medallion. Remove ALL playing cards, card decks, player nameplates, player portraits, all player numbers and counters, all 'En desarrollo', 'Publicados', 'Mazo' labels, and remove the five raised wooden personal player boards/trays beneath those cards. Inpaint the removed regions seamlessly with continuous matching navy-blue marble tabletop with fine gold veins, retaining the existing ornate outer main-table edge. Keep the large top-center TESIS title plaque exactly as it is. The resulting image must look exactly like the original room and main table before the game pieces and personal trays were placed. This is an edit for precision, not a redesign. Do not add any new room elements, do not make the tabletop black, do not change the angle or the placement and scale of the central medallion. All five player areas must be unobstructed, ready for separately rendered live game UI.

### Bandeja (referencia visual: mockup aportado)

Using this game screenshot as an exact visual style reference, create ONE isolated empty player board asset matching the BOTTOM CENTER player's wooden tray in this reference. Output transparent background, landscape 2.7:1. Extract/reconstruct the complete wood and leather player tray as a separate asset, without any surrounding scene. Remove ALL cards, decks, portrait, player nameplate, all text and labels. Preserve its luxurious slightly asymmetrical clipped-corner shape, deep brown mahogany outer frame with TWO fine gold inset lines, subtle gold corner filigree and navy-brown leather playing surface. Preserve the realistic physical thickness of its lower beveled edge and warmly lit gold detail, as in the screenshot. Render the board straight and horizontal from directly overhead, not tilted sideways. The flat interior must remain EMPTY and take up at least 85% of the board's area so software can overlay cards. No big jewels, no wide floral borders: restrained thin gold ornamentation just like the reference. Genuine alpha transparency surrounding the tray, tightly framed with no more than 2% outer margin. Single board only.

### Placa

A single production-ready empty player nameplate UI asset for TESIS premium dark academia fantasy board game. Wide landscape 5:1 ratio. Transparent background. Straight front-on orthographic graphic, entire object tightly framed with 2% transparent margin. A horizontal long dark midnight-navy marble plaque surrounded by ornate fine antique gold double-line beveled metal trim, clipped corners and tiny elegant filigree. At its left end an attached large round portrait medallion frame with gold laurel leaves and one tiny diamond jewel at bottom. The medallion occupies the left 21% of full width and nearly full height, its circular center empty solid very dark navy for a live portrait to be overlaid. Main rectangular nameplate begins behind the medallion at x=15% and extends to x=99%, from y=18% to y=88%. Main interior uniformly dark navy and completely empty, no decorative lines through the middle, providing negative space for player name and resource numbers overlaid by software. Tiny embossed classical Greek academy temple emblem inside a subtle thin gold shield at far right (last 9% width). Elegant warm candlelit gold reflections, rich dark blue marble and detailed engraved metal, realistic painted 3D game interface aesthetic matching an antique scholarly library. NO text, NO letters, NO numbers, NO faces, NO people, NO cards behind or above it, no surrounding scene. Genuine transparent alpha outside the object, no checkerboard pattern.

### Dorso (referencia visual: mockup aportado)

Create a single portrait playing card BACK asset matching exactly the navy blue card backs marked TESIS on the right edge of each player tray in this reference. One single card, straight upright orthographic frontal view, aspect ratio 2:3, cropped tightly to the card with very small transparent margin. Deep midnight navy leather texture, delicate gold double rectangular line border with tiny ornate corners and diamonds. In center a small elegant gold Greek academy temple with three columns, enclosed in gold laurel branches, and below it exact gold serif text 'TESIS'. The interior mostly empty navy. Fine premium antique gold detail, warm subtle candlelight, highly polished realistic illustrated boardgame asset. Transparent alpha around the rounded rectangular card silhouette. No surrounding scene, no deck stack, no other cards, no shadows outside, no big decorative jewels.
