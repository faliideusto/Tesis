# Trabajar con Codex en Tesis

## Arquitectura del equipo

El agente principal actúa como **Lead/Orchestrator**: inspecciona petición y estado Git, identifica autoridad/contratos, decide plan y especialistas, integra, valida y revisa. No hay un equipo de cinco agentes permanentemente activo ni un runtime nuevo dentro del juego. Esta infraestructura consiste en instrucciones, planes y cuatro skills; la creación de subagentes depende de las herramientas disponibles en la sesión.

| Rol | Responsabilidad | Skill local |
| --- | --- | --- |
| Backend & Game Rules | Motor, dominio, reglas, salas y contratos privados | [tesis-backend](../.agents/skills/tesis-backend/SKILL.md) |
| Frontend & UX | Tablero, cartas, HUD, modales, feedback y móvil | [tesis-frontend](../.agents/skills/tesis-frontend/SKILL.md) |
| QA / Testing | Validación proporcional y evidencia de lo ejecutado | [tesis-qa](../.agents/skills/tesis-qa/SKILL.md) |
| Reviewer / Integrator | Revisar resultado combinado, regresiones y alcance | [tesis-review](../.agents/skills/tesis-review/SKILL.md) |

Lead puede desempeñar estos roles directamente. Una skill es un procedimiento reutilizable, no crea un agente por sí misma.

## Uso y descubrimiento

Abre una tarea en la raíz con una petición concreta y criterios observables. Las cuatro skills residen en `.agents/skills/`, ubicación estándar de descubrimiento de repositorio. Puedes mencionar `$tesis-backend`, `$tesis-frontend`, `$tesis-qa` o `$tesis-review` cuando estén disponibles en el catálogo. `AGENTS.md` conserva enlaces para consultar solo la skill relevante.

La [documentación oficial de Codex](https://learn.chatgpt.com/docs/build-skills) describe `.agents/skills/` para descubrimiento automático. El proyecto utiliza esa ubicación sin duplicados, enlaces Windows ni configuración global. Se comprobaron estructura, frontmatter y contenido; este entorno no expone una consulta fiable al catálogo de skills del runtime, por lo que no se afirma detección efectiva. Si no aparecen en una sesión, comprueba el catálogo en una sesión nueva o reinicia Codex; mientras tanto puedes leer el `SKILL.md` directamente.

## Tarea pequeña

Ejemplo: cambiar el texto de un aviso en `js/feedback.js`. Lead inspecciona el módulo y `tests/activity.test.mjs`, modifica el texto solicitado, ejecuta la prueba relevante, revisa el diff y entrega. No requiere plan ni cuatro especialistas; un cambio puramente editorial tampoco exige crear tests nuevos.

## Tarea media y tarea grande

Una feature localizada o un bug con varias causas puede usar uno o dos especialistas si reduce incertidumbre. No hay obligación de delegar.

Ejemplo grande: una mecánica solicitada que cambie acciones, DTOs y controles. Lead crea el plan, identifica código Java autoritativo, acuerda DTO/API y asigna propietarios. Backend prepara reglas/contrato; frontend implementa sobre ese contrato cuando sea estable. Solo tareas independientes se solapan. Lead integra; QA comprueba implementación integrada y Reviewer revisa el diff completo. Si la sesión no permite subagentes o los archivos están acoplados, Lead sigue estos pasos secuencialmente.

## Planes y conflictos

Usar [.agent/PLANS.md](../.agent/PLANS.md) para reglas, turnos, multiplayer, refactor, arquitectura, release, varias capas con riesgo y tareas multiagente. Guardar un plan vivo en `.agent/plans/`; actualizar pasos, decisiones, comandos/resultados, impedimentos y aceptación. No exigirlo para cambios triviales.

Cada delegación contiene objetivo, responsabilidad, archivos/área exclusiva, dependencias, contrato, aceptación y validación esperada. Los especialistas devuelven archivos cambiados, resultados y cuestiones pendientes. Si descubren que necesitan editar un archivo ajeno, informan al Lead antes de hacerlo; Lead reasigna o serializa. No sobrescribir cambios concurrentes. QA normalmente trabaja después de implementación; Reviewer sobre el conjunto final. Worktrees pueden aislar tareas independientes, pero no resuelven automáticamente conflictos de integración. No asumir filesystem separado por subagente.

## Arquitectura real del proyecto

Un único módulo Maven (`es.tesis:tesis`, Java 17), Gson y JUnit Jupiter. `ServidorWeb` utiliza `com.sun.net.httpserver.HttpServer`, sirve `/static` desde classpath y enruta `/api/salas`; no usa Spring. Las clases web concentran las responsabilidades que en otros proyectos se llamarían controlador/servicio.

La partida se orquesta en `src/main/java/es/tesis/motor/`; las entidades están en `dominio`, las políticas en `reglas`, comandos en `acciones`, habilidades en `habilidades` y eventos/historial en `eventos`. `persistencia` guarda instantáneas versionadas en memoria/JSON para la consola; la web no ofrece importar/exportar partidas. `es.tesis.Main` arranca CLI y `PartidaInicial` crea Ana, Bruno y Clara.

`src/main/resources/static/index.html` carga módulos ES desde `js/`, CSS desde `css/` y gráficos de `assets/Tesis-assets/`. `app.js` coordina navegación/polling/renderizado; `api.js` solicitudes; `board`, `players` y `cards` componentes; `dialogs`/`decisions` modales; `feedback`/`effects` avisos y animación; `dom` escape/actualización. No hay `package.json`, bundle ni tests npm: Node ejecuta los `.mjs` directamente.

Los tests Java están en `src/test/java/es/tesis/` y `web/`. Las cuatro suites Node están en `tests/`. `tools/qa_multiplayer.mjs` es la QA actual por salas; su wrapper Python delega en Node. Otros scripts de `tools/` pueden representar flujos históricos: inspeccionar endpoints y prerrequisitos antes de reutilizarlos. `Dockerfile` construye con Maven/JDK 17 y arranca mediante Maven en puerto 10000. El JAR ordinario no incluye lanzador/dependencias autónomas.

## Fuente de verdad: reglas comprobadas

**Las reglas actuales de Tesis se obtienen del motor Java, no del PDF.** El PDF puede servir como referencia histórica; nunca sobrescribe automáticamente el motor. Esta tabla localiza el comportamiento observado, no sustituye la lectura del código antes de cambiarlo. Todas las rutas Java parten de `src/main/java/es/tesis/`.

| Comportamiento vigente | Autoridad ejecutable |
| --- | --- |
| 3–5 jugadores, 2 monedas y 2 ideas iniciales; cierre al terminar la ronda con alguien con 3 publicaciones | `reglas/ReglasAcademicas` y `motor/EstadoFinRonda` |
| Fases selección → turnos → fin de ronda → nueva selección o final; ganador(es) por máximo prestigio | `motor/Estado*`, `dominio/Partida` |
| Primer selector aleatorio; selección circular, 2 descartes con 3 jugadores y 1 con 4/5; turnos por orden de personaje | `Partida`, `SeleccionarPersonajeAccion`, `EstadoSeleccionRoles` |
| Hasta dos acciones base; la acción rechazada no registra consumo; fin manual permitido con acciones restantes salvo Comité pendiente | `ReglasAcademicas`, `acciones/AccionBase`, `EstadoTurno` |
| Cobrar +2 monedas; Pensar roba una idea; iniciar paga coste/retira idea/crea estudio; trabajar aporta 1 punto base | `acciones/`, `ReglasAcademicas` |
| Publicación automática al alcanzar trabajo requerido; suma prestigio de carta y bonus; Estadístico añade +1 a estudio propio publicado | `dominio/Estudio`, `Jugador`, `habilidades/EstadisticoHabilidad` |
| 8 tipos de idea con reposición y pesos; costes, trabajo, prestigio e ingresos en catálogo Java | `dominio/FabricaMazos`, `Mazo`, `IdeaCarta` |
| Patente: 4 monedas, 5 trabajo, 5 prestigio y 2 monedas por copia publicada al iniciar turno no vetado | `FabricaMazos`, `motor/EstadoTurno` |
| 7 roles nuevos, orden 1–7; Plagiador se conserva para compatibilidad de guardados antiguos | `FabricaMazos`, `dominio/InstantaneaPartida`, `habilidades/PlagiadorHabilidad` |
| Comité debe nombrar rol antes de actuar/finalizar; no él mismo ni Decana; rol no elegido consume habilidad; veto salta turno y sus ingresos/efectos | `ComiteEticaHabilidad`, `ReglasAcademicas`, `MotorJuegoImpl`, `EstadoTurno` |
| Investigador roba extra y marca primer selector siguiente; Decana es inmune desde asignación; Editorial cobra por publicaciones de toda la mesa | Habilidades correspondientes y `motor/ContextoJuegoImpl` |
| Pre-Doctoral aporta 1 trabajo activo a estudio propio en desarrollo sin acción base; Revisor paga 1 moneda y retira 1 trabajo solo a rival en desarrollo con trabajo, sin inmunidad | `PreDoctoralHabilidad`, `Revisor2Habilidad`, `Jugador`, `Estudio` |
| Habilidad activa no consume acción base y su uso se registra después de ejecución válida | `acciones/UsarHabilidadAccion`, `ReglasAcademicas` |
| Recuperación sin repetir reparto, descartes, robos o ingresos del turno | `MotorJuegoImpl.recuperarPartida`, `Partida.restaurar`, `persistencia/` |

## Multiplayer, identidad y límites verificados

`GestorSalas` mantiene hasta 256 salas en `ConcurrentHashMap`, códigos aleatorios de cinco caracteres y caducidad de 24 horas. `SalaJuego` asigna token de 32 bytes aleatorios, mapea token → `Jugador`, mantiene anfitrión y sincroniza operaciones. La partida usa los mismos jugadores. Estado de sala `LOBBY`/`EN_PARTIDA`/`FINALIZADA` es distinto de fase del motor.

`ServidorWeb` autentica consultas y acciones por Bearer; rechaza campos extra, JSON/tipos inválidos, revisiones obsoletas y POST de origen incompatible. `X-Tesis: 1` y JSON acompañan mutaciones. `SalaJuego` controla anfitrión/revisión; `SesionJuego` controla pertenencia/turno y ejecuta comandos del motor. `objetivo` no autoriza al actor.

`SesionJuego.vista` expone mano/rol propios aun esperando, recursos/estudios/número de cartas públicos y roles rivales ya revelados. Solo el actor recibe selección/opciones de acción. El catálogo de selección usa el mismo índice negativo para elegidos y descartados, sin propietario. Los eventos se construyen por lista explícita, sin carta robada ni rol elegido/vetado privado; revelación al turno o veto. Las deducciones de inmunidad/orden/roles restantes son posibles: no afirmar secreto absoluto.

Revision exterior de sala e interior de adaptador son distintas. El bloqueo protege ejecución y DTO; dos envíos con revisión antigua no cobran dos veces. No hay deduplicación permanente de cualquier intención del cliente. Tras `FIN_RONDA`, un plazo de 5 s permite que la siguiente consulta/acción continúe automáticamente y cambie revisión; no hay timer independiente que avance el motor sin petición. También existe `SIGUIENTE_RONDA` manual.

Frontend conserva `tesis.sala` en `sessionStorage`; `api.js` encola solicitudes y cancela tras 12 s; `app.js` programa polling 900 ms después del anterior, usa generaciones/cola visual y evita aplicar respuestas antiguas. Refresh conserva identidad de esa pestaña; decisiones visuales no confirmadas se pierden, obligación del Comité persiste en motor. Fallos de red no reenvían acciones automáticamente.

Todo vive en una instancia/memoria: reinicio pierde salas/tokens, no hay cuentas, recuperación por nombre, transferencia de anfitrión, expulsión, bots ni reemplazo de jugador. Un token robado permite usar esa identidad. `/api/game*` y cookie local existen solo en constructor loopback de compatibilidad de tests y no acceden a salas. No confundir persistencia CLI con reconexión web.

## QA

Comandos habituales desde raíz:

```powershell
mvn test
mvn compile exec:java
mvn -DskipTests package
Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Fallo en $($_.Name)" } }
```

Para navegador, configurar servidor en 8091 (`PORT`) o `TESIS_URL`, con Playwright y Chrome; ejecutar `node tools/qa_multiplayer.mjs`. Recorre tamaños 3/4/5, identidades aisladas, partida completa, recargas/red y móvil 390×844 para cinco jugadores. Geometría: `node tools/qa_article_boxes.mjs`. README explica instalación opcional; no es dependencia de producción.

Seleccionar escenarios de inicio, sala/unión/partida, selección/turnos/acciones/habilidades/publicación/final, refresh/reconexión, duplicados/concurrencia/fuera de turno, privacidad JSON y errores. Para UI añadir teclado, responsive/móvil y errores JS. Separar pruebas automáticas de análisis estático, revisión manual y escenarios no verificados. Los tests Node con DOM simulado no prueban layout real y las capturas antiguas no son pruebas nuevas.

## Review y finalización

Reviewer revisa diff combinado y archivos nuevos, alcance, arquitectura, lógica, duplicación/código muerto, archivos innecesarios, errores, privacidad, carrera/revisiones, separación frontend/backend, tests y complejidad. Reporta **Bloqueante**, **Importante** o **Recomendación** con ubicación/caso/evidencia; puede declarar ausencia de bloqueantes sin inventar hallazgos. Lead resuelve correcciones dentro del alcance y repite únicamente checks afectados.

Cerrar con aceptación, plan actualizado, comandos/resultados, límites y revisión de Git. No commit automático ni modificaciones ajenas. Respetar ramas `main`, `release/v*` y de tarea; esta infraestructura se prepara en `chore/ai-agent-infrastructure`.

## Observaciones históricas, sin corregir el juego

Inspección del 5 de octubre de 2026:

- README: Patente se describe con coste 3; `FabricaMazos` define 4. El ejemplo CLI menciona dos jugadores; `PartidaInicial` crea tres y las reglas exigen 3–5.
- `docs/WEB.md`: config pública dice 2–7, pero `SesionJuego.configuracion` usa límites 3–5; afirma consultas sin mutación y cierre manual, mientras `SalaJuego` puede avanzar tras 5 s. Describe `objetivo` público solo para Plagiador; `SesionJuego.evento` también lo incluye para Revisor 2.
- `docs/MESA-VISUAL.md` y `habilidades/package-info.java` conservan hasta seis personas y efectos antiguos (Pre-Doctoral 2; Revisor sobre propios/publicados). Las clases ejecutables actuales difieren: 3–5, Pre-Doctoral 1 activo y Revisor solo rival en desarrollo.
- Assets incluyen Plagiador con numeración histórica, pero el catálogo vigente crea siete roles. No derivar reglas del nombre del asset ni renumerarlo automáticamente.
- README registra solapamientos previos en `qa_article_boxes.mjs`; esta tarea no los corrige ni los vuelve a verificar visualmente.
- `Informe_Inicial.pdf` existe, pero no se ha contrastado su contenido: no se afirma ninguna discrepancia específica con él. Las observaciones anteriores provienen de documentación/comentarios cotejados con código.

Estas notas orientan futuras inspecciones; no amplían el alcance ni autorizan reparar comportamiento/documentación histórica durante otra tarea.
