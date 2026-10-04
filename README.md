# Tesis

La versión 2.0.0 incorpora cuentas opcionales y progresión del perfil con Supabase,
sin ventajas dentro de la partida. Configuración, variables y límites en
[Cuentas, Supabase y Render](docs/CUENTAS_SUPABASE_RENDER.md).

Juego de cartas multijugador por salas para **3–5 personas**. Cada navegador controla a su jugador, con mano privada, sin cuentas: nombre y código de sala. El motor Java sigue siendo la única fuente de verdad.

## Ejecutar y jugar

Requisitos: JDK 17 o superior y Maven 3.9 o superior.

```powershell
mvn test
mvn compile exec:java
```

En el ordenador servidor abre `http://localhost:8080`. Crea una sala con tu nombre y comparte su código. Los demás deben abrir **el mismo servidor**: en la misma red, `http://IP_DEL_SERVIDOR:8080`. El firewall del servidor debe permitir ese puerto. El código por sí solo no conecta servidores diferentes. El anfitrión inicia cuando hay entre tres y cinco participantes.

La selección es privada; cada persona actúa desde su dispositivo. Los personajes se revelan al llegar su turno. Al terminar una ronda, el último jugador indicado pulsa «Siguiente ronda» o «Ver resultados». Hay siete habilidades, dos acciones base, tres publicaciones para desencadenar el cierre y victoria por prestigio. Los ocho tipos de idea permanecen siempre disponibles; cada robo usa las probabilidades indicadas más abajo, con reposición.

F5 recupera la identidad de **esa pestaña** mediante `sessionStorage`. Las salas viven en memoria y caducan tras 24 horas sin peticiones autenticadas. Reiniciar el servidor las elimina. No hay bots, expulsión de jugadores, sustitución del anfitrión ni recuperación de identidad por nombre: si alguien abandona sin conservar su token, su turno puede quedar esperando.

## Configuración y despliegue

- `PORT`: puerto, por defecto `8080`; un argumento de CLI lo sustituye.
- `HOST`: interfaz de escucha, por defecto `0.0.0.0`. Usa `127.0.0.1` para limitarlo al ordenador local.
- `PUBLIC_ORIGIN`: origen público exacto, como `https://juego.example`, si se sirve detrás de un proxy.
- Frontend y API comparten origen; todas las rutas del navegador son relativas.

```powershell
$env:PORT = '8091'
$env:HOST = '0.0.0.0'
mvn compile exec:java
```

Para Internet hace falta un servicio que ejecute Java y HTTPS, normalmente con un proxy que mantenga el host público. GitHub Pages no ejecuta este backend. Esta versión requiere una sola instancia; no hay base de datos ni almacenamiento compartido entre réplicas. No se ha desplegado externamente. El JAR normal no incluye dependencias ni un lanzador autónomo; el comando Maven anterior sirve para ejecutar con su classpath.

## Verificación

- `mvn test`: pruebas de partidas completas de 3, 4 y 5 personas, privacidad, validación estricta de solicitudes, previsualizaciones, habilidades, persistencia, probabilidades e ingresos de Patente.
- `mvn -DskipTests package`: **BUILD SUCCESS**.
- Prueba real automatizada: 3, 4 y 5 contextos aislados de Chrome, creación/unión, partida completa, recargas, avisos, previsualizaciones, estabilidad de modal bajo polling y recuperación de red. La partida de cinco personas usa una pantalla de 390 × 844.

La prueba visual es opcional y no añade dependencias de producción:

```powershell
npm install --no-save --package-lock=false playwright
# Con Chrome instalado y el servidor escuchando en 8091:
node tools/qa_multiplayer.mjs
node tools/qa_article_boxes.mjs
# Pruebas JS sin dependencias externas (PowerShell):
Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName }
```

`TESIS_URL` permite cambiar la dirección de la prueba. `TESIS_PLAYERS=3,4,5` selecciona tamaños de sala y `TESIS_FAST_QA=1` acelera las animaciones únicamente dentro del navegador de prueba. Evidencia temporal: `target/qa-multiplayer/`. El antiguo comando Python delega en este mismo script Node. Arquitectura y contrato: [docs/WEB.md](docs/WEB.md).

Incidencia visual previa pendiente: `qa_article_boxes.mjs` detecta solapamiento entre la placa local y el aviso central en algunas resoluciones de escritorio. Se ha contrastado con el CSS anterior y reproduce los mismos fallos; la prueba conserva la aserción para no ocultarlos. No impide completar las partidas multijugador verificadas.

La interfaz conserva las consultas informativas durante las actualizaciones; una nota avisa cuando sus datos pertenecen al momento de apertura. Las decisiones sí se invalidan al cambiar la revisión. Los objetivos válidos y sus previsualizaciones proceden del servidor. Finalizar turno pide confirmación cuando quedan acciones o una habilidad disponible.

Los 47 gráficos de producción usan WebP sin pérdida: 102.763.160 → 73.694.796 bytes, conservando dimensiones, transparencia y píxeles visibles. `tools/optimize_assets.mjs` permite repetir la conversión de nuevos PNG con Sharp; las referencias originales de diseño no se convierten.

## Modo terminal conservado

```powershell
mvn compile exec:java "-Dexec.mainClass=es.tesis.Main"
```

La documentación siguiente describe el motor y el modo terminal original.

Motor Java/Maven de Tesis, un juego didáctico sobre investigación académica.

## Lectura funcional del informe

El diseño parte de estas decisiones del documento base:

- Objetivo de partida: publicar 3 artículos y finalizar la ronda en la que un jugador llegue a ese umbral.
- Recursos: monedas, cartas de idea, puntos de trabajo y puntos de prestigio.
- Ronda dividida en selección de roles y turnos de acción.
- Acciones base: cobrar, pensar, iniciar estudio y trabajar.
- Roles con habilidades específicas: Comité de Ética, Estadístico, Investigador Principal, Decana, Editorial, Pre-Doctoral y Revisor 2.
- Numeración de personajes: 1 Comité, 2 Estadístico, 3 Investigador Principal,
  4 Decana, 5 Editorial, 6 Pre-Doctoral y 7 Revisor 2. El máximo es cinco personas;
  se descartan dos personajes con tres jugadores y uno con cuatro o cinco.

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
mvn compile exec:java "-Dexec.mainClass=es.tesis.Main"
```

También puedes ejecutar `Main` desde VS Code. La configuración inicial crea una partida local para Ana y Bruno en el mismo ordenador. La pantalla indica quién debe usar el teclado. No hay conexión entre dispositivos.

### Elegir personaje y jugar

Al empezar una ronda se descarta un personaje y cada jugador elige uno de la lista escribiendo su número. Junto al personaje aparece su orden de turno y una descripción de su habilidad. Los turnos se juegan por orden de personaje.

Durante el turno se muestran los recursos del jugador, su personaje, las acciones restantes y la habilidad. Las opciones son:

| Número | Acción | Uso |
| --- | --- | --- |
| 1 | Cobrar | Recibe dos monedas. |
| 2 | Pensar | Roba una carta de idea aleatoria sin reducir el mazo. |
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
| Investigador Principal | Automática: roba una idea aleatoria extra al inicio, y elige primero la siguiente ronda. |
| Decana | Automática: inmunidad a habilidades rivales durante toda la ronda. |
| Editorial | Al iniciar tu turno, recibe 1 Moneda por cada artículo publicado en la mesa. No compra trabajo. |
| Pre-Doctoral | Activa: una vez por turno aporta 1 punto de trabajo a un estudio propio en desarrollo, sin consumir acciones base. Trabajar sigue aportando 1 punto. |
| Revisor 2 | Una vez por turno, paga 1 moneda para retirar hasta 2 puntos de trabajo de un estudio rival en desarrollo que tenga trabajo. No revisa publicaciones ni estudios propios. Decana es inmune a revisiones rivales. |

Las habilidades activas se usan una vez por turno. Las automáticas no necesitan activarse con la opción 5. El Plagiador ya no forma parte del mazo de las nuevas partidas; el lector de guardados antiguos conserva su compatibilidad.

### Probabilidades y Patente

El reparto inicial y todos los robos usan la misma distribución con reposición:

| Artículo | Probabilidad |
| --- | ---: |
| Ecológico | 20% |
| Transversal | 20% |
| Casos y Controles | 17% |
| Cohortes | 13% |
| Revisión Sistemática | 10% |
| Ensayo Clínico Aleatorizado | 10% |
| Ensayo Comunitario | 6% |
| Patente | 4% |

**Patente** es la única carta legendaria: cuesta 3 monedas y 5 de trabajo, da
5 de prestigio y genera 2 monedas al inicio de cada turno de su propietario
mientras esté publicada. Cada copia publicada aporta sus ingresos. Los artículos
publicados no son objetivos válidos del Revisor 2. Recuperar una partida no vuelve a cobrar
el ingreso del turno en curso. Los turnos vetados no activan efectos de inicio.

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
mvn compile exec:java "-Dexec.mainClass=es.tesis.Main" "-Dexec.args=--cargar partida.json"
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
