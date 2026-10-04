---
name: tesis-qa
description: "Validar implementaciones de Tesis con las pruebas existentes y escenarios de juego, privacidad, concurrencia y navegador pertinentes al cambio."
---

# QA de Tesis

Leer `AGENTS.md`, diff y criterios del plan si existe. Las reglas esperadas salen del motor Java, no del PDF ni de comentarios históricos. Seleccionar validación por impacto; comenzar sobre una implementación comprobable. Reutilizar herramientas existentes antes de nuevos frameworks.

## Comandos y evidencia

- Backend: `mvn test`; JUnit en `src/test/java/es/tesis/`, incluidos flujo, balance, persistencia y `web/` (salas, HTTP, perspectivas, habilidades y catálogo).
- Frontend: ejecutar desde raíz `Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Fallo en $($_.Name)" } }`. Las cuatro suites comprueban actividad, decisiones, efectos y selección con VM/DOM simulado.
- Arranque: `mvn compile exec:java` (8080; `HOST`/`PORT` configurables). Un test HTTP que arranca su servidor no demuestra que se haya ejecutado este comando de arranque.
- Navegador opcional: `node tools/qa_multiplayer.mjs`, servidor en 8091 o `TESIS_URL`, Playwright y Chrome instalados. `TESIS_PLAYERS=3,4,5` y `TESIS_FAST_QA=1` son opciones reales; evidencias en `target/qa-multiplayer/`. El wrapper Python delega en Node.
- Geometría: `node tools/qa_article_boxes.mjs`; README registra solapamientos previos. Contrastar con baseline antes de atribuirlos al cambio; no eliminar aserciones para aprobar.
- Empaquetado si aplica: `mvn -DskipTests package`; no demuestra paso de tests.

Comprobar dependencias antes de instalar. No usar capturas históricas de `docs/qa/` como evidencia actual. Si caché Maven/temporales/puerto/red impiden una ejecución, registrar comando y fallo del entorno; usar alternativa autorizada sin cambiar el juego.

## Escenarios según alcance

1. Inicio, crear sala, unión de 3/4/5 identidades, anfitrión y comienzo; selección privada, descartes y revelación.
2. Turnos/fases, dos acciones base, habilidad correspondiente, obligación del Comité, monedas, ideas, trabajo, publicación automática, tercera publicación, cierre de ronda y clasificación por prestigio. Revisar también continuación automática tras 5 s al consultar y paso manual.
3. Refresh en lobby/selección/turno/decisión, reconexión y polling; recuperación con token conservado, pérdida de identidad sin prometer recuperación por nombre.
4. Solicitudes simultáneas/duplicadas con revisión antigua, salas independientes, acciones fuera de turno, índices/objetivos inválidos, tipos JSON y suplantación del actor.
5. JSON desde perspectivas distintas: mano rival y roles ocultos ausentes, selección/acciones solo al actor, veto privado y eventos filtrados; no basta verificar DOM oculto. Recursos, estudios y cantidad de cartas rivales sí son públicos.
6. Errores backend y JavaScript, estabilidad de consultas y decisiones, movimiento reducido, teclado, responsive y móvil cuando haya impacto visual.

Para cambios solo de instrucciones, validar rutas, frontmatter, coherencia entre documentos y ausencia de cambios funcionales; no exigir una partida de navegador completa sin motivo.

## Informe al Lead

Separar **test automático ejecutado**, **comprobación estática**, **revisión manual** y **escenario no verificado**. Incluir comandos, resultados, evidencia y limitaciones; distinguir regresión nueva de fallo previo. Nunca afirmar que algo fue probado si no se ejecutó. No reparar bugs ajenos al alcance sin coordinarlo; QA puede proponer pruebas pero no editar archivos compartidos mientras otro agente los modifica.
