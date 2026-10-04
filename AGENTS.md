# Tesis: instrucciones para Codex

Tesis es un juego de cartas de investigación académica para 3–5 personas. Proyecto Maven único, Java 17, HTTP del JDK y Gson; frontend HTML/CSS/JavaScript sin framework ni build npm.

## Autoridad y mapa del código

**Las reglas actuales del juego se derivan del motor Java y no del PDF.** Inspecciona el código ejecutable antes de cambiar reglas; README, comentarios, `Informe_Inicial.pdf` y documentos históricos pueden estar desactualizados. No ajustes el motor al PDF salvo petición explícita.

Rutas relativas a la raíz:

| Área | Ubicación y responsabilidad |
| --- | --- |
| Motor | `src/main/java/es/tesis/motor/`: `MotorJuegoImpl`, `ContextoJuegoImpl` y estados de selección, turno, fin de ronda y fin de partida |
| Reglas y dominio | `reglas/ReglasAcademicas.java` y `dominio/` bajo `es/tesis`: `Partida`, `Jugador`, `Estudio`, `Mazo`, `FabricaMazos` |
| Acciones y personajes | `acciones/` (Command), `habilidades/` (Strategy); costes/catálogo en `FabricaMazos` |
| Web | `src/main/java/es/tesis/web/`: `ServidorWeb` enruta HTTP; `GestorSalas` registra salas; `SalaJuego` autentica y sincroniza; `SesionJuego` adapta el motor; `Vistas` define DTOs; `CatalogoVisual` presenta datos |
| Otros adaptadores | `consola/`, `Main`, `PartidaInicial`; `eventos/` para observación/historial; `persistencia/` para instantáneas y JSON, usados por CLI |
| Frontend | `src/main/resources/static/`: `index.html`, `css/`, módulos `js/`; `app.js` coordina UI/polling, `api.js` HTTP/identidad |
| Assets | `src/main/resources/static/assets/Tesis-assets/`: WebP de producción y PNG de referencia; respeta rutas y mayúsculas |
| Validación | JUnit en `src/test/java/`, pruebas Node en `tests/*.test.mjs`, QA opcional de navegador en `tools/` |

No hay Spring, capa de controladores/servicios separada, base de datos ni frontend autoritativo. Respeta nombres españoles, paquetes `es.tesis`, Java CamelCase y módulos JS existentes. Usa `dom.js` para escape HTML y actualizaciones DOM; evita nuevos frameworks sin necesidad.

## Multiplayer y privacidad

- Una `SalaJuego` contiene su `SesionJuego`; sus objetos `Jugador` pasan al motor. Las salas viven en memoria en una sola instancia y caducan tras 24 h sin actividad válida. Reiniciar elimina identidades y partidas web.
- El token Bearer determina al actor; `objetivo` identifica al destinatario de una habilidad. Nunca aceptes identidad del actor enviada en JSON. Solo el anfitrión inicia; `SesionJuego.actuar(Jugador,...)` exige jugador actual.
- Las operaciones de sala sincronizan autenticación, revisión, ejecución y vista. El cliente envía la **revisión exterior de sala**, que se traduce a la del adaptador; solicitudes obsoletas reciben 409. Conserva esta protección contra duplicados concurrentes; no promete idempotencia permanente.
- `SesionJuego.vista` entrega mano/rol propios y datos públicos de rivales; selección y acciones solo al actor. Los roles rivales se revelan al turno o veto. No serialices entidades, instantáneas ni historial bruto; `evento` proyecta campos públicos explícitos y oculta el rol vetado hasta resolverlo.
- Las consultas pueden avanzar automáticamente `FIN_RONDA` después de 5 s (`SalaJuego.continuarRondaSiCorresponde`) e incrementar revisión. No asumas que todo GET es puro. El paso manual también existe.
- `api.js` conserva código/token en `sessionStorage`, encola fetch y usa timeout de 12 s. `app.js` sondea tras 900 ms, invalida generaciones antiguas, pausa durante acciones y no reintenta mutaciones ambiguas automáticamente. Invalida decisiones obsoletas y conserva consultas informativas conforme al flujo existente.
- Un token perdido no se recupera por nombre; quien lo posee controla esa identidad. La ocultación de roles no impide deducciones por efectos de reglas. `/api/game*` es compatibilidad de pruebas del constructor loopback `ServidorWeb(int)`, no API de salas del arranque normal.

## Comandos desde la raíz

Requisitos: JDK 17+ y Maven (README indica 3.9+); Node para pruebas JS.

```powershell
mvn test
mvn compile exec:java
mvn compile exec:java "-Dexec.mainClass=es.tesis.Main"
mvn -DskipTests package
Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Fallo en $($_.Name)" } }
```

Web por defecto: `http://localhost:8080`; `HOST`, `PORT`, `PUBLIC_ORIGIN` configuran escucha/origen. QA de navegador: servidor en 8091 o `TESIS_URL`, Playwright y Chrome; `node tools/qa_multiplayer.mjs` y, para geometría, `node tools/qa_article_boxes.mjs`. Lee prerrequisitos en README y scripts; no instales ni ejecutes toda la QA para un cambio trivial. El JAR normal no es autónomo.

## Lead, planes y skills

El agente principal es Lead/Orchestrator: inspecciona petición, `git status`, rama y código relevante; clasifica por impacto y coordina la entrega.

- **Pequeña:** texto, estilo o bug aislado; implementación directa, validación proporcional y revisión del diff, sin plan ni equipo obligatorio.
- **Media:** feature localizada o varias causas/capas limitadas; plan si ayuda, cero a dos especialistas si hay trabajo independiente.
- **Grande:** reglas, turnos, multiplayer, arquitectura, refactor, release o varias capas con riesgo; plan en `.agent/plans/` siguiendo [.agent/PLANS.md](.agent/PLANS.md), división útil, integración, QA y revisión final. Si no hay delegación disponible o independencia real, ejecuta secuencialmente y deja constancia.

Antes de delegar, asigna responsabilidad, archivos/área, dependencias, contrato y aceptación. Nunca varios escritores simultáneos sobre un archivo o área acoplada; frontend/backend solo en paralelo con contrato acordado. QA sobre implementación comprobable; Reviewer sobre resultado combinado. Un subagente no implica filesystem aislado; usa worktrees solo cuando aporten valor.

Las skills locales están en `.agents/skills/`, ubicación estándar de descubrimiento del repositorio. Usa únicamente la relevante; si el catálogo de una sesión no está actualizado, lee su archivo directamente sin afirmar que el runtime ya la detectó:

- Backend/reglas/salas/privacidad: [.agents/skills/tesis-backend/SKILL.md](.agents/skills/tesis-backend/SKILL.md).
- HTML/CSS/JS/UX: [.agents/skills/tesis-frontend/SKILL.md](.agents/skills/tesis-frontend/SKILL.md).
- Validación de implementación: [.agents/skills/tesis-qa/SKILL.md](.agents/skills/tesis-qa/SKILL.md).
- Revisión final o importante: [.agents/skills/tesis-review/SKILL.md](.agents/skills/tesis-review/SKILL.md).

Son procedimientos de los roles, no agentes permanentemente activos. Uso y observaciones del repositorio: [docs/AI_TEAM.md](docs/AI_TEAM.md).

## Git y definición de terminado

Respeta cambios locales y estrategia de ramas (`main`, `release/v*`, ramas de tarea); infraestructura en rama específica, nunca directamente en `main`. Si necesitas nueva rama, usa `codex/` salvo convención/petición concreta. No cambies release sin razón; no reset destructivo, clean, force push, reescritura, borrado de ramas ni sobrescritura del trabajo ajeno. No hagas commit, merge o publicación salvo petición.

Terminado = alcance y aceptación cumplidos, pruebas pertinentes ejecutadas o limitaciones documentadas, privacidad/turnos/revisiones preservados, plan actualizado cuando exista y diff combinado revisado sin archivos accidentales. Revisa también archivos nuevos (no aparecen en `git diff` normal). Entrega cambios, comandos/resultados, hallazgos y pendientes; distingue tests automáticos, análisis estático, revisión manual y escenarios no ejecutados. No corrijas mejoras ajenas al alcance: regístralas.
