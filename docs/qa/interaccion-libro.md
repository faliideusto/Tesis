# Interacción cosmética: Lanzamiento de libro

ID estable: `archivo_lanzamiento_libro`. Usa los cuatro PNG del catálogo de Crónicas del Archivo. No hay migración nueva ni reglas, recursos, acciones o revisión funcional afectados.

## Canal y extensibilidad

`GET /api/salas/{codigo}/interacciones?desde=N` usa Bearer de sala. Devuelve `ultimo`, reloj `ahora`, disponibilidad únicamente propia y eventos públicos `{numero,emisor,objetivo,interactionId,fecha}`. Sin cursor establece baseline sin reproducir histórico. El cliente sondea cada 900 ms con transporte, generación y cancelación independientes de la cola de juego.

`POST` en la misma ruta recibe `{interactionId,objetivo}` con token de sala y cuenta en `X-Tesis-Account-Authorization`. El actor se deriva del token; el servidor comprueba cuenta vinculada, inventario/loadout actual, catálogo permitido, destino y cooldown de 15 segundos. La consulta de cuenta ocurre fuera del lock; las comprobaciones se repiten al emitir bajo el lock. No guarda JWT ni distribuye inventarios privados. POST devuelve los eventos recientes para evitar huecos entre solicitudes concurrentes; el cliente deduplica por número.

Los eventos usan contador propio, retención de 60 segundos y máximo de 64 registros. Ninguna operación llama a `SesionJuego.actuar`, obtiene la vista funcional ni avanza FIN_RONDA. El cooldown reside en la sala y sobrevive a recargas/reconexiones; las salas en memoria desaparecen al reiniciar el servidor igual que el resto del juego.

Para añadir otra interacción: registrar ID/cooldown en `CatalogoInteracciones`, añadir renderer en `interaction-effects.js` y habilitar su ID en el controlador. Los assets siguen el mapa del cosmético existente. La elegibilidad visual y los assets de mesa usan el snapshot de entrada, igual que avatar/marco/reverso; la autorización de cada POST valida siempre el loadout vigente.

## Presentación

Puntero de 25–27 px únicamente en la placa propia con cuenta e interacción equipada. Selección de rivales, Escape/clic exterior y cancelación sin interceptar controles funcionales. Libro con curva y rotación, dos hojas, impacto y reacción breve; al impactar, 48 estrellas/estelas moradas y doradas se expanden y desvanecen: 1400 ms en total. Movimiento reducido: impacto de 200 ms sin partículas expansivas. Coordenadas obtenidas de los avatares reales. Overlay sin captura de puntero, cleanup al abortar, cambiar DOM, ocultar pestaña o redimensionar.

## Evidencia

- `mvn test`: 226 pruebas PASS. Incluye cooldown exacto, 16 solicitudes concurrentes/único éxito, JWT/cuenta/sala, inventario/equipamiento, cursor/dos emisores, retención, FINALIZADA y FIN_RONDA sin avance funcional.
- 19 suites Node PASS, incluido controlador, transporte independiente y renderer/cancelación/movimiento reducido.
- `node tools/qa_interactions.mjs`: tres clientes Chrome contra salas Java reales y Auth/RPC simulados sólo en loopback. Propio control, sin control ajeno/propio objetivo, Escape/clic exterior, recepción por los tres, estado/revisión inmutables, spam 429, cooldown real tras recarga y recuperación a los 15 segundos, acción funcional durante vuelo y geometría escritorio/móvil.
- Capturas en `target/qa-interactions/`: selección, vuelo, cooldown tras recarga y móvil. Para capturar el vuelo se pausa sólo la animación de ese cliente de prueba a mitad de trayectoria y se reanuda; duración normal validada en las pruebas del renderer.

## Demo local

Compilar primero: `mvn test-compile dependency:build-classpath -Dmdep.outputFile=target/qa-interactions.classpath`.
Ejecutar `node tools/preview_interactions.mjs` y abrir `http://127.0.0.1:8112/?jugador=Fali`, `?jugador=Marta` y `?jugador=Sol` en pestañas distintas. Fali y Marta tienen el libro equipado; Sol conserva cosméticos de mesa pero no posee interacción. Son identidades ficticias firmadas por Auth local; nunca se contacta con Supabase de producción. La sala y el canal de eventos son los reales de Java.
