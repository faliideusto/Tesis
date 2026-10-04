# Infraestructura de agentes para Tesis

## Objetivo
Preparar instrucciones, planificación y exactamente cuatro skills adaptadas al repositorio, sin cambiar funcionalidad.

## Contexto
Inspección del 5 de octubre de 2026. Rama `chore/ai-agent-infrastructure`; estado inicial limpio, sin `AGENTS.md` ni skills locales existentes. Maven único Java 17, HTTP JDK, frontend estático y pruebas Java/Node.

## Alcance
`AGENTS.md`, `.agent/PLANS.md`, este plan, `docs/AI_TEAM.md` y cuatro `SKILL.md` en `.agents/skills/`.

## Fuera de alcance
Java, recursos web, assets, gameplay, balance, salas, bugs funcionales, documentación histórica existente y commit/merge/publicación.

## Áreas afectadas
Solo instrucciones y documentación nuevas. Validaciones generan evidencia ignorada en `target/agent-validation/` y reportes Maven en `target/surefire-reports/`.

## Fuente de verdad
`src/main/java/es/tesis/motor/`, `reglas/ReglasAcademicas`, `dominio/Partida`, `Jugador`, `Estudio`, `Mazo`, `FabricaMazos`, `acciones/` y `habilidades/`. Web verificada en `ServidorWeb`, `GestorSalas`, `SalaJuego`, `SesionJuego`, `Vistas`; cliente en módulos de `static/js/`. Reglas actuales: motor Java, no PDF.

## Plan de implementación
- [x] Inspeccionar Git, estructura, documentación, motor, salas, frontend, assets, tests y herramientas.
- [x] Diseñar instrucciones breves, ruta de lectura de skills y coordinación sin equipo obligatorio.
- [x] Crear cuatro skills, guía del equipo y plantilla de planes.
- [x] Validar frontmatter/rutas, coherencia y alcance del diff; revisar resultado combinado.
- [x] Registrar resultados finales y estado Git.
- [x] Revisión previa al commit: mover cuatro skills a `.agents/skills/`, actualizar referencias, comprobar integridad y revalidar infraestructura sin tocar el juego.

## División multiagente
Lead escribe todos los archivos de infraestructura, que están estrechamente relacionados. Revisión independiente de lectura sobre el conjunto al terminar; sin escritores paralelos ni worktree innecesario.

## Criterios de aceptación
- Cuatro skills con nombre/descripción/frontmatter válidos en rutas solicitadas.
- Rutas/clases/comandos verificados y autoridad Java explícita; no garantías privadas inventadas.
- Planes proporcionales, delegación opcional y archivos exclusivos por escritor.
- Guía práctica de QA/review y descubrimiento honesto de skills.
- Ningún archivo funcional ni cambio previo del usuario modificado; revisión completa de archivos nuevos y Git.

## Tests
- `Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Fallo en $($_.Name)" } }`: cuatro suites aprobadas (actividad, decisiones, efectos y selección).
- `mvn test` inicial falló antes de tests por caché `C:\.m2` inaccesible. Con caché existente en modo offline, JUnit encontró restricciones del sandbox al limpiar temporales (160 tests, 31 errores de entorno). Repetición con acceso normal: `mvn -o "-Dmaven.repo.local=C:\Users\radeu\.m2\repository" test`, 160 tests, 0 fallos/errores/omitidos, BUILD SUCCESS.
- `node target/agent-validation/validate-infrastructure.cjs`: parser YAML real incluido en el runtime disponible, cuatro frontmatters/nombres/descripciones/rutas válidos, 11 enlaces locales válidos, exactamente ocho archivos nuevos y ningún archivo seguido modificado. El validador temporal queda ignorado en `target/`; no añade dependencia al proyecto.
- `git diff --check` y comprobación `git diff --no-index --check` de cada archivo nuevo contra archivo vacío: sin problemas de whitespace. Revisados contenido completo y diff de los ocho archivos nuevos, además de `git diff` y `git diff --cached` vacíos.
- Reviewer independiente de lectura: sin Bloqueantes ni Importantes. Recomendó aclarar invalidación de decisiones obsoletas en `AGENTS.md`; corregido y cotejado con skill frontend/cliente. Lead revisó coherencia de planes, cuatro skills y guía.
- Git final: rama sin cambios `chore/ai-agent-infrastructure`; ocho archivos nuevos no seguidos, ninguno modificado/staged. `git diff --stat` vacío porque los nuevos todavía no están en el índice; estadísticas adicionales obtenidas con `git diff --no-index --stat`. Sin commit.
- No se ejecuta QA de navegador, móvil ni Docker: no hay cambios funcionales/visuales; no se reutiliza evidencia histórica como ejecución actual.

## Riesgos
Documentación previa desactualizada; se registran discrepancias en `docs/AI_TEAM.md`. Las skills utilizan `.agents/skills/`, ubicación estándar de descubrimiento. Estructura válida no equivale a detección confirmada: este entorno no expone una consulta fiable del catálogo del runtime. Delegación depende de capacidades de la sesión.

## Decisiones
- Mantener todos los archivos funcionales e históricos intactos.
- Usar un único `AGENTS.md` raíz y skills concisas; no añadir instrucciones anidadas ni referencias redundantes.
- Mantener fuente única en `.agents/skills/`, sin duplicados, enlaces Windows ni configuración global.
- Registrar que un GET puede avanzar fin de ronda y distinguir revisiones de sala/adaptador.
- Revisión previa al commit: conservar contenido exacto de las cuatro skills al moverlas (SHA256 idéntico), retirar solo directorios vacíos de la ubicación anterior y actualizar referencias/validador temporal.
- Discrepancia del resumen anterior: Git enumeraba ocho archivos nuevos con 420 líneas. El validador temporal ignorado tenía 38 líneas; incluirlo reproduce exactamente nueve archivos y 458 líneas. No había un noveno archivo no rastreado pendiente de commit.

## Revalidación previa al commit
- Cuatro frontmatters YAML, nombres, descripciones y rutas finales; 11 enlaces locales; ausencia de duplicados y referencias a la ubicación anterior: comprobados con el validador actualizado.
- Revisados todos los archivos de infraestructura, estado Git, diff de archivos no rastreados y whitespace; ningún archivo funcional o previamente seguido modificado. `.agent/PLANS.md` no contenía referencias de skills que actualizar.
- El único archivo auxiliar modificado es `target/agent-validation/validate-infrastructure.cjs`, ignorado por `target/`; la evidencia `full.diff` se regenera para reflejar las rutas actuales. No se elimina ningún archivo ajeno.
- No se repiten Maven ni pruebas de juego: solo se mueven skills Markdown y se actualizan instrucciones y validador de infraestructura. Sin commit.

## Estado
Terminado: criterios cumplidos, validación/revisión completadas y límites registrados. No quedan cambios de implementación pendientes en este alcance.
