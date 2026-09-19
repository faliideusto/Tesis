# Implementación web y decisiones conservadas

## Fronteras de responsabilidad

`ServidorWeb` usa `jdk.httpserver` y Gson; sirve el frontend y limita el acceso a loopback. Cada cookie HttpOnly/SameSite contiene un identificador aleatorio de sesión. No hay CORS ni acceso remoto. Las peticiones de cambio requieren una cabecera propia y un origen local coincidente, si el navegador lo envía. El servidor admite 64 sesiones y limpia las que llevan 24 horas inactivas.

`SesionJuego` sincroniza cada operación junto con la creación de su DTO. Reutiliza `MotorJuegoImpl`, `ReglasAcademicas`, `FabricaMazos` y las acciones originales. Una revisión incremental evita que un doble envío o una pestaña con datos antiguos actúe sobre otro turno. Al rechazar una acción no cambia la revisión; el registro interno del motor conserva el rechazo, pero no se publica información de diagnóstico en la crónica web.

Los comandos web son `SELECCIONAR`, `COBRAR`, `PENSAR`, `INICIAR`, `TRABAJAR`, `HABILIDAD`, `FIN_TURNO` y `SIGUIENTE_RONDA`. Los cuatro comandos base y las tres variantes de objetivo de habilidad se traducen directamente a los comandos Java originales. La disponibilidad se calcula en Java, utilizando los validadores de fase del motor y el estado real. El motor vuelve a validar la ejecución.

Ejemplo de acción, usando la revisión y el índice recibidos:

```json
{"revision": 8, "tipo": "INICIAR", "indice": 0}
```

Ejemplo de revisión de un estudio:

```json
{"revision": 14, "tipo": "HABILIDAD", "objetivo": "Jugador 2", "indice": 1}
```

No se modifican las clases del dominio, reglas, motor, acciones, habilidades, persistencia o CLI. Los únicos cambios a archivos originales son la configuración Maven y la documentación.

## Flujo y privacidad

1. Crear la partida con nombres: el motor valida, elige al primer selector al azar, reparte y descarta un rol al azar.
2. El DTO queda bloqueado: no lleva mano, opciones de acción ni roles seleccionables.
3. La persona indicada continúa y recibe exclusivamente su mano y las opciones de su fase.
4. Cada elección ejecuta `SeleccionarPersonajeAccion`. Tras elegir todos, el motor inicia los turnos por orden de rol y aplica las habilidades automáticas.
5. Cada turno conserva dos acciones base y las habilidades originales. El Comité debe resolver primero su veto. Editorial puede repetir compras; Pre-Doctoral aporta dos puntos al trabajar.
6. Al completar un estudio, el motor publica y suma prestigio. No existe un botón de publicación separado.
7. El fin de turno puede saltar a un jugador vetado. El relevo vuelve a bloquear la perspectiva privada.
8. Al terminar la ronda se muestra un resumen. Continuar invoca la transición real a selección o final de partida. La clasificación usa `ganadores()` del motor e incluye empates.

Información pública: nombres, monedas, prestigio, cantidad de ideas, estudios con progreso y publicaciones. Las manos rivales y el orden/contenido del mazo de ideas nunca aparecen en el DTO. El mazo muestra solo su tamaño. La crónica no incluye el personaje elegido en una selección privada ni nombres de cartas robadas.

El proyecto no define formalmente una política completa de revelación de personajes. Se adopta la opción conservadora de mantener la elección oculta hasta el turno de ese personaje. Los roles ya revelados permanecen visibles hasta la siguiente selección. Los objetivos ofrecidos excluyen los que el motor considera inmunes; esa disponibilidad puede permitir deducir inmunidad. No se presenta este modo de pantalla compartida como aislamiento entre usuarios hostiles: cualquiera que controla el mismo navegador puede continuar el relevo. No existe selector arbitrario de perspectiva rival.

## Frontend

Módulos: `api.js` (HTTP), `app.js` (flujo y eventos), `board.js` (mesa), `cards.js` (capas), `players.js` (jugadores y estudios), `dialogs.js` (decisiones), `feedback.js` (notificaciones/efectos) y `dom.js` (assets/escape/actualizaciones). No hay framework, compilador de frontend ni recursos externos.

Se actualizan regiones que han cambiado, conservando las demás. Las acciones se bloquean durante la solicitud; los errores se notifican en la interfaz. Las entradas se escapan antes de introducirse en HTML. Los modales nativos proporcionan foco y navegación por teclado. Los modales de relevo/selección requieren resolver la decisión; los demás admiten Escape.

El escenario es `fondo_partida.png`; las posiciones pertenecen a CSS. Los rivales se distribuyen según su cantidad, con capacidad de hasta seis rivales. La mano utiliza cartas con proporción 2:3, hover, foco y ampliación. Con manos grandes se permite desplazamiento horizontal. En ventanas estrechas, la mesa pasa a un diseño vertical con controles al pie.

Se utilizan logo, reversos, marcos de personajes y artículos, marco de mazo, paneles, botones, ilustraciones de acciones y recursos, modal y tooltip. Los PNG originales se conservan. Algunos marcos de artículo tienen un centro casi opaco: el arte se superpone con una máscara CSS dentro de su ventana; nombre y números son capas HTML. Por preferencia visual del usuario, «Tu academia» y «Mis estudios» conservan superficies azul marino y bordes dorados sin las imágenes ornamentales de fondo. El tooltip utiliza su marco como borde de nueve segmentos, con el texto dentro del pergamino y posicionamiento limitado al viewport.

Rarezas: prestigio 1–3 común, 4–6 raro, 7–9 épico. El catálogo actual solo utiliza valores dentro de esos rangos. Como degradación visual para futuras cartas, 0 usaría común y >9 épico, sin asignar nombres nuevos de rareza ni cambiar reglas.

Tres cartas reales no tienen ilustración específica. Correspondencias artísticas reutilizadas:

| Carta | Ilustración reutilizada |
| --- | --- |
| Serie de Casos | Casos y Controles |
| Metaanálisis | Revisión Sistemática |
| Estudio Piloto | Artículo Ecológico |

Sus nombres, costes, trabajo y prestigio siguen siendo los del motor. En particular, Ensayo Comunitario cuesta **8**, requiere **4** de trabajo y otorga **9** de prestigio; se ignoran las cifras del mockup. No se inventa una pila de descarte de ideas porque el motor no la tiene. La cantidad del mazo de personajes es la de roles aún disponibles, excluyendo el descartado y los elegidos.

No hay assets de audio y no se han descargado ni generado sonidos.

## Límites del catálogo y del motor

- Ocho personajes y diez ideas, una sola copia de cada idea. Reparto fijo de dos por persona. El máximo efectivo es cinco. La API obtiene el máximo de los mazos y las reglas, no del mockup.
- No se barajan las ideas: se conserva el orden de la fábrica. El motor sí aleatoriza el selector inicial y el descarte de rol.
- Las ideas no se reciclan. Con cinco jugadores puede producirse un bloqueo sin tres publicaciones, aunque el Plagiador permite redistribuir manos mientras todavía hay cartas. El aviso web detecta el caso definitivo en el que ya no quedan ideas ni estudios en desarrollo y nadie cumple el umbral. No se añade final por agotamiento ni por número de rondas.
- No hay límite de estudios en curso: la supuesta habilidad «dos estudios adicionales» del mockup no corresponde al Investigador Principal real.
- El trabajo es progreso de cada estudio, no una reserva gastable del jugador. No se muestra un saldo inventado.
- La web conserva la sesión en memoria al recargar, pero no exporta/importa archivos. Estas funciones siguen disponibles en el CLI. No hay IA, cuentas ni juego entre dispositivos.

## Verificación

Las pruebas originales siguen intactas. Las pruebas nuevas viven en `src/test/java/es/ciudadela/web/`:

- `SesionJuegoTest`: configuración admitida, privacidad durante selección/relevo, JSON sin manos rivales, versiones y doble envío, límite de acciones, índices inválidos, habilidades y partida completa real hasta publicaciones y victoria.
- `ServidorWebTest`: servidor real en puerto libre, cookies independientes, UTF-8, recursos y tipos MIME, rutas inexistentes/traversal, payloads inválidos, tamaño máximo, origen, cabecera y revisión.

Comandos:

```powershell
mvn clean test
mvn package
mvn compile exec:java
```

Resultado de la segunda pasada: **93 pruebas sin fallos ni errores**, compilación y empaquetado correctos. La revisión visual sí se completó con Chrome real en modo headless, incluyendo tres resoluciones, partidas reales y capturas. Véase [UI-REVISION.md](UI-REVISION.md) para componentes, pruebas y límites.

## Archivos originales modificados

`pom.xml`: entrada web por defecto, entrada CLI seleccionable y Surefire explícito. `README.md`: arranque, arquitectura y límites web; se conserva la documentación del CLI corrigiendo sus comandos. `tareas.md`: estado del trabajo web y revisión visual completada. No se tocan los PNG ni las referencias aportadas por el usuario.
