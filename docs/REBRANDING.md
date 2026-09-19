# Tesis — identidad del proyecto

El nombre oficial del juego es **Tesis**. Se actualizaron los paquetes e imports de producción y pruebas a `es.tesis`, las coordenadas Maven, las clases de arranque, los textos de consola y web, las rutas de recursos, la documentación y la etiqueta de la imagen Docker. Las claves de sesión y la cabecera de peticiones usan también el nombre Tesis, de forma coherente entre cliente, servidor y pruebas.

No se modificaron las reglas, el catálogo de cartas, el motor ni el funcionamiento multijugador. Los cambios de Java se verificaron contra la versión anterior: únicamente sustituciones de nombres y textos de marca.

## Assets

Todos los recursos del juego se encuentran en `src/main/resources/static/assets/Tesis-assets/`. Se revisaron visualmente los 44 PNG y se adaptaron estas nueve imágenes mediante edición con ImageGen:

- `Logo/logo_tesis.png`: nombre del juego en el logotipo.
- `cartas/reverso_idea.png`: nombre en la cinta del reverso rojo.
- `cartas/reverso_personaje.png`: nombre en la cinta del reverso azul.
- `cartas/marco_articulo_comun.png`: marca superior derecha.
- `cartas/marco_articulo_raro.png`: marca superior derecha.
- `cartas/marco_articulo_epico.png`: marca superior derecha.
- `tablero/fondo_partida.png`: texto del estandarte superior izquierdo.
- `referencias/Referencia_Partida.png`: texto del mismo estandarte en la referencia.
- `referencias/Referencia_cartaidea.png`: marca de la carta de referencia.

Las instrucciones de edición pidieron sustituir exclusivamente la marca por «TESIS», conservando composición, geometría, colores, tipografía ornamental y estética académica. Los otros **35 PNG son idénticos byte a byte** a los originales. El informe PDF existente ya utiliza Tesis y se conserva.

Las capturas anteriores de `docs/qa/` se sustituyeron por ocho capturas reales de la web actual: inicio, dos salas de espera, dos perspectivas de mesa, selección de personajes y dos resultados finales. No son montajes ni imágenes generadas.

## Verificación

- `mvn clean test`: **126 pruebas, cero fallos, errores u omisiones**.
- `py tools/qa_multiplayer.py`: Chrome real sin interfaz gráfica, dos contextos independientes, partida completa de **7 rondas y 64 pasos**, resultado final compartido, todas las acciones principales y una habilidad.
- Recargas verificadas en sala de espera, selección, turno y decisión pendiente del Comité; recuperación tras corte de red; modal estable durante el sondeo; ninguna excepción JavaScript ni imágenes rotas en las comprobaciones.
- Inspección de las capturas renderizadas de inicio, mesa, personajes y resultado. El título del documento usa Tesis.
- Búsqueda global sin distinguir mayúsculas de las variantes del nombre anterior en contenido y rutas mantenidas, excluyendo `target` y el historial Git: sin coincidencias.

La verificación visual corresponde a Chrome de escritorio a 1600 × 900. No se cambió de rama ni se realizaron commits, merges o publicaciones.
