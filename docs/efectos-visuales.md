# Efectos de partida

La capa visual mantiene el motor y sus reglas intactos. `effects.js` centraliza vuelos,
textos flotantes, partículas, resaltados, selección y banners mediante Web Animations.
`feedback.js` conserva el resumen y la crónica existentes.

## Sincronización

- Los eventos públicos del motor ya tenían un número creciente. Se consume únicamente
  lo posterior al último estado mostrado; el primer snapshot establece la referencia.
- `Vistas.Evento` añade `estudio`, `cantidad` y `robo`. `SesionJuego` los construye
  con una lista explícita de campos públicos. El índice identifica estudios incluso
  cuando sus cartas tienen el mismo nombre. No se serializa el mapa interno del motor.
- El polling conserva su cadencia de 900 ms. Una cola de presentación serializa
  transiciones y descarta snapshots intermedios superados; las acciones siguen usando
  la revisión del servidor. Los controles de partida esperan a la actualización visual.
- Orden habitual: DOM anterior → transición → DOM del snapshot recibido → resaltado.
  La carta origen se oculta mientras se representa su vuelo y se restaura al cancelar.
- Se agrupan cambios sucesivos del mismo estudio. Las ráfagas de más de 16 eventos
  se resumen mediante el panel de actividad, sin reproducir una secuencia histórica.
- Navegación, cambio de tamaño y pestaña oculta cancelan animaciones y limpian nodos.
  La siguiente actualización sigue aplicándose; ningún efecto modifica el estado.

## Identidad y privacidad

Cobrar lleva una moneda desde la zona del mazo al contador y muestra el incremento.
Pensar utiliza un reverso durante el vuelo, también para el jugador local, cuya nueva
carta se revela al integrar la mano. Iniciar traslada la idea pública a estudios.
Trabajar muestra su cantidad y anima el progreso; publicar añade sello y partículas.

Los rivales no ven cartas robadas ni personajes reservados. La confirmación del
personaje solo anima su carta en la perspectiva propia. El banner usa exclusivamente
el rol que ya figure en la vista pública.

- Comité: expediente de veto, sin resolver el rol nombrado a un jugador; aviso de decisión pendiente.
- Estadístico: acento verde azulado y bonificación de prestigio sobre el estudio.
- Investigador Principal: prioridad para la ronda siguiente y reverso de la idea extra.
- Decana: sello dorado de inmunidad al comenzar su turno público.
- Editorial: ingresos por publicaciones y moneda hacia el contador.
- Pre-Doctoral: acento azul y cantidad real de trabajo adicional.
- Revisor 2: corrección roja y marca sobre el estudio identificado.
- Plagiador: intercambio de reversos con acento rojo morado. Su efecto está preparado,
  pero el mazo actual no contiene este personaje; no se ha cambiado el mazo.

El tercer artículo resalta el cierre de ronda. La pantalla «TESIS COMPLETADA» aparece
para todos al recibir `FIN_PARTIDA`, con ganadores y sus publicaciones públicas.
No se proclama ganador al tercer artículo: las reglas actuales esperan al cierre y
resuelven por prestigio, incluyendo empates y ganadores con menos de tres artículos.

## Accesibilidad y adaptación

Posiciones calculadas desde el DOM, con anclaje alternativo al encabezado si el destino
queda fuera de pantalla. Tamaños limitados por el viewport. Sin sonidos.
`prefers-reduced-motion` elimina vuelos, giros y partículas, usando fades breves.
Los avisos textuales conservan tiempo de lectura incluso con movimiento reducido.
El panel de actividad conserva la explicación textual después del feedback breve.
Las funciones reciben eventos semánticos, permitiendo asociar sonido más adelante.

### Presencia y duración

El banner de turno dura 3,6 segundos, con permanencia estable entre entrada y salida.
Los vuelos normales duran 900 ms, los textos 1,8 segundos y los resaltados 950 ms.
La publicación presenta la carta en el centro, halo circular, destello cálido,
partículas doradas y sello durante 2,8 segundos; el tercer artículo dura 3,4 segundos.
El panel de actividad mantiene cada entrada 2,4 segundos. Los banners no bloquean
las acciones y las transiciones siguen siendo cancelables.

Los paneles rivales de escritorio crecen hasta 420 px y las cartas públicas se
ajustan al espacio de su asiento. Los controles tienen más altura y mantienen sus
etiquetas dentro de la abertura del marco. El lobby muestra el máximo real de seis.

## Validación realizada

- `mvn test`: 133 tests, sin fallos, errores ni omitidos.
- Nuevos tests Java: índices con cartas duplicadas, cantidades, estabilidad de polling,
  igualdad de eventos entre perspectivas, acciones rechazadas y privacidad del Comité/robo.
- `tests/effects.test.mjs`: diez pruebas con DOM simulado para deduplicación, bootstrap,
  reversos rivales, cobro, selección ajena, movimiento reducido, cancelación/restauración,
  resize, pestaña oculta y banner. Ejecutadas en el runtime Node disponible en la sesión.
- Análisis sintáctico de los diez módulos JavaScript y `git diff --check`.

Para ejecutar las pruebas de efectos con Node instalado:

```sh
node --experimental-vm-modules tests/effects.test.mjs
```

## Validación visual pendiente

La herramienta de navegación devolvió un inventario vacío de navegadores y aplicaciones.
No ha sido posible comprobar una partida real con dos contextos, screenshots de
escritorio/móvil ni la consola del navegador. El DOM simulado no valida layout ni estética.

Revisar en dos contextos independientes todas las acciones y habilidades disponibles,
tercer artículo y final compartido; observar actor y rival, recargar durante transiciones,
dejar correr varios polls sin cambios, cambiar tamaño y activar movimiento reducido.
Comprobar especialmente los vuelos con estudios fuera del viewport, el regreso de una
publicación a desarrollo tras revisión y que ambos clientes muestran los resultados.
