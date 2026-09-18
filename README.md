# Ciudadela Académica

Motor Java/Maven para una adaptación didáctica de Ciudadelas orientada a proceso didactico.

## Lectura funcional del informe

El diseño parte de estas decisiones del documento base:

- Objetivo de partida: publicar 3 artículos y finalizar la ronda en la que un jugador llegue a ese umbral.
- Recursos: monedas, cartas de idea, puntos de trabajo y puntos de prestigio.
- Ronda dividida en selección de roles y turnos de acción.
- Acciones base: cobrar, pensar, iniciar estudio y trabajar.
- Roles con habilidades específicas: Comité de Ética, Estadístico, Plagiador, Investigador Principal, Decana, Editorial, Pre-Doctoral y Revisor 2.

## Arquitectura propuesta

El proyecto separa el dominio del motor para que las reglas académicas puedan cambiarse sin reescribir el núcleo.

- `dominio`: entidades puras como `Jugador`, `Carta`, `Personaje`, `Mazo`, `Partida` y `Tablero`.
- `motor`: orquestación de la partida, máquina de estados y contexto de ejecución.
- `acciones`: patrón Command para las acciones de turno.
- `habilidades`: Strategy para los efectos de personaje.
- `reglas`: políticas intercambiables que encapsulan la variante académica.
- `eventos`: Observer para notificar cambios y registrar el historial de la partida.
- `consola`: menús, vistas y avisos para jugar por teclado.
- `persistencia`: guardados en memoria y archivos JSON versionados.

## Patrones empleados

- State: fases de selección de roles, turno, fin de ronda y fin de partida.
- Command: acciones ejecutables como objetos.
- Strategy: habilidades de personajes y reglas de variante.
- Observer: publicación de eventos de partida.

## Extensión rápida

Para añadir una mecánica nueva:

1. Crear una clase en `acciones` si se trata de una acción de jugador.
2. Añadir o ampliar una estrategia en `habilidades` si modifica un personaje.
3. Ajustar `reglas/ReglasAcademicas` si afecta a validación, puntuación o victoria.
4. Escuchar eventos desde `eventos` para mostrar feedback en UI o logs.

Para añadir un personaje nuevo:

1. Crear su habilidad en `habilidades`.
2. Instanciar un `Personaje` con el nombre, orden y habilidad.
3. Incorporarlo al mazo de roles de `dominio/FabricaMazos`.
4. Registrar su identificador en `InstantaneaPartida.TipoHabilidad` si debe poder guardarse y recuperarse.

## Guía de uso

### Arrancar

Desde la carpeta del proyecto, con Java 17 o superior y Maven:

```powershell
mvn compile exec:java
```

También puedes ejecutar `Main` desde VS Code. La configuración inicial crea una partida local para Ana y Bruno en el mismo ordenador. La pantalla indica quién debe usar el teclado. No hay conexión entre dispositivos.

### Elegir personaje y jugar

Al empezar una ronda se descarta un personaje y cada jugador elige uno de la lista escribiendo su número. Junto al personaje aparece su orden de turno y una descripción de su habilidad. Los turnos se juegan por orden de personaje.

Durante el turno se muestran los recursos del jugador, su personaje, las acciones restantes y la habilidad. Las opciones son:

| Número | Acción | Uso |
| --- | --- | --- |
| 1 | Cobrar | Recibe dos monedas. |
| 2 | Pensar | Roba una carta de idea, si quedan cartas. |
| 3 | Iniciar estudio | Elige una carta de tu mano por número y paga su coste. |
| 4 | Trabajar | Elige un estudio propio en desarrollo. |
| 5 | Usar habilidad | Sigue las preguntas de tu personaje para elegir el objetivo. |
| 6 | Ver estado y mano | Consulta los recursos y estudios de todos y las cartas del jugador actual. |
| 7 | Terminar turno | Pasa al siguiente jugador; puede usarse aunque queden acciones. |

Se permiten hasta dos acciones base por turno (opciones 1–4). Las habilidades y las consultas no consumen acciones base. Los intentos rechazados tampoco. Al agotar las acciones puedes usar una habilidad disponible o terminar el turno; no se avanza automáticamente.

Los números de estudios son los que aparecen en pantalla. Las listas para actuar solo incluyen estudios válidos, pero conservan su numeración original: puede aparecer, por ejemplo, únicamente el estudio número 2.

Escribe `0`, `cancelar` o `volver` para abandonar una selección sin ejecutar la acción. Los números incorrectos se rechazan. Una consulta o una recuperación realizada desde una pregunta devuelve al menú de la fase actual, por lo que tendrás que volver a seleccionar la acción que quieras realizar.

### Habilidades

| Personaje | Cómo se utiliza |
| --- | --- |
| Comité de Ética | La consola pide obligatoriamente un rol al inicio, antes del menú de acciones. El jugador que lo tenga pierde su turno si no es inmune. Nombrar un rol no elegido consume la habilidad sin efecto. Cancelar deja la decisión pendiente: no puedes actuar ni terminar el turno hasta resolverla. |
| Estadístico | Opción 5: selecciona uno de tus artículos publicados para añadir un punto de prestigio. |
| Plagiador | Opción 5: elige otro jugador por número o nombre para intercambiar las manos. |
| Investigador Principal | Automática: roba una idea extra al inicio, si queda alguna, y elige primero la siguiente ronda. |
| Decana | Automática: inmunidad a habilidades rivales durante toda la ronda. |
| Editorial | Cobra automáticamente por las publicaciones al iniciar el turno. Con la opción 5 compra un punto de trabajo en un estudio propio por tres monedas. Puede repetir la compra. |
| Pre-Doctoral | Automática: la opción 4 aporta dos puntos de trabajo. |
| Revisor 2 | Opción 5: elige jugador y estudio en desarrollo con trabajo acumulado. Paga una moneda para retirar un punto de trabajo. |

Las habilidades activas se usan una vez por turno, salvo las compras de Editorial. Las automáticas no necesitan activarse con la opción 5.

### Consultar la partida

Estos comandos pueden escribirse en cualquier pregunta:

| Comando | Resultado |
| --- | --- |
| `ayuda` | Reglas básicas, menú y comandos disponibles. |
| `estado` | Fase, ronda, jugador actual, mazo de ideas, recursos y estudios de todos. |
| `mano` | Cartas del jugador actual, con coste, trabajo requerido y prestigio. |
| `estudios` | Estudios de todos, con progreso, prestigio y estado de publicación. |
| `historial` | Registro detallado con fecha, orden, eventos y acciones rechazadas por el motor. |

Los avisos aparecen automáticamente cuando hay robos, cobros, publicaciones, habilidades, vetos o cambios de fase. El estado general no muestra las cartas de las manos rivales. Al compartir pantalla, los jugadores deben organizarse para mantener privadas sus elecciones y cartas; no es una interfaz con pantallas privadas.

### Guardar y recuperar

**En memoria, durante la misma sesión:**

```text
guardar prueba
guardados
cargar prueba
```

`guardar` y `cargar` sin nombre usan `principal`. Guardar otra vez con el mismo nombre sustituye esa copia. Los guardados en memoria se pierden al cerrar el programa.

**En un archivo, para continuar otro día:**

```text
exportar partida.json
importar partida.json
```

Sin indicar archivo se utiliza `partida.json`. Las rutas relativas parten de la carpeta desde la que arrancaste el programa. Puedes escribir una ruta con espacios sin rodearla de comillas dentro de la consola. Exportar de nuevo a la misma ruta sustituye ese archivo. La carpeta de destino debe existir.

Para arrancar directamente desde un archivo guardado:

```powershell
mvn compile exec:java "-Dexec.args=--cargar partida.json"
```

La recuperación mantiene el jugador, la fase, las acciones consumidas, las habilidades usadas y los efectos de ronda. No repite ingresos, robos automáticos ni repartos. Al recuperar en una sesión abierta, el historial conserva también las acciones anteriores a la recuperación; al arrancar desde archivo, se carga su historial.

### Fin de partida y salida

Al publicar el tercer artículo se termina de jugar la ronda. Después aparece la clasificación por prestigio y el ganador o los ganadores en caso de empate. El primero que publica tres no gana necesariamente.

En la pantalla final puedes consultar el estado y el historial, guardar o exportar el resultado, recuperar otro guardado o escribir `salir`. Para conservar una partida tras cerrar, expórtala antes.

### Ejemplo de un turno

1. Escribe `1` para cobrar dos monedas.
2. Escribe `3` y el número de una carta que puedas pagar para iniciar un estudio.
3. Consulta `estado` o utiliza `5` si tienes una habilidad activa disponible.
4. Escribe `7` para terminar el turno.
5. Antes de cerrar, escribe `exportar partida.json` y después `salir`.
