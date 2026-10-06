# Matchmaking por tamaño de mesa

## Objetivo
Buscar partidas de exactamente 3, 4 o 5 personas, cancelar y confirmar presencia antes del inicio automático.

## Contexto y fuente de verdad
Estado inicial limpio en main; rama release/v2.3.0 solicitada por el usuario. GestorSalas registra salas en memoria; SalaJuego autentica, sincroniza e inicia; ReglasAcademicas admite 3–5 personas. Se conserva el motor y la API de salas privadas.

## Alcance y áreas
GestorMatchmaking y GestorSalas: colas FIFO independientes, presencia, confirmación con plazo y creación atómica. ServidorWeb: rutas autenticadas con token de búsqueda. api.js y módulo matchmaking.js: almacenamiento por pestaña, solicitudes encoladas, recuperación y UI. app.js: entrada y transición al juego. JUnit/Node y navegador si está disponible.

## Plan
- [x] Inspección y contrato.
- [x] Implementación backend y frontend.
- [x] Integración y validación.
- [x] Revisión combinada.

## División multiagente
Especialista backend: exclusivamente GestorMatchmaking.java, GestorSalas.java y GestorMatchmakingTest.java. Lead: HTTP, frontend y pruebas de integración. Contrato acordado: Vista(token,jugadores,fase,reunidos,confirmados,listo,grupo,hasta,acceso); buscar/estado/confirmar/cancelar/limpiar. Grupo requerido al confirmar para rechazar decisiones obsoletas. Solo acceso propio en ASIGNADA.

## Aceptación
Tamaño exacto; colas separadas; prioridad conservada para quienes confirman si falla el grupo; cancelación y expiración; una asignación bajo concurrencia; nombres únicos; privacidad y vinculación a cuentas conservadas; inicio de salas privadas sin cambios; recuperación por recarga y tras respuesta ambigua, sin reintentar mutaciones automáticamente.

## Riesgos y decisiones
Colas y salas en memoria, una instancia. Presencia de 30 s y confirmación de 20 s. Token aleatorio generado y guardado antes de buscar. Consulta recupera asignación propia; confirmación de grupo antiguo se rechaza. Sin ranking, bots o cambios de reglas.

## Tests y estado
Entrega Git autorizada posteriormente por el usuario: commit de la implementación, push de release/v2.3.0 e integración en main de origin y personal. Ambos main remotos coinciden con la base local ec0a580 antes de integrar.

Terminado. `mvn "-Dmaven.repo.local=C:/Users/radeu/.m2/repository" test`: 194 tests, 0 fallos/errores. Maven predeterminado falló por C:\.m2 inaccesible; caché existente y ejecución autorizada resolvieron el entorno. Las 11 suites Node pasan, incluido matchmaking.test.mjs con recuperación tras respuesta perdida, tokens en HTTP, cancelación contra asignación y generaciones obsoletas.

`node tools/qa_matchmaking.mjs` con Playwright del runtime y Chrome instalado, servidor real iniciado en 8091: colas separadas, cancelación, recarga de búsqueda y partida, confirmación e inicio exacto de 3/4/5, nombres repetidos y geometría 390/1440; 0 errores JS. Evidencias target/qa-matchmaking/report.json y PNG; inspección visual manual de selector y confirmación móvil. `git diff --check` sin errores. Revisión independiente detectó y se corrigieron deduplicación Unicode y UUID en HTTP por red local, con pruebas de regresión. No ejecutada partida completa desde matchmaking ni prueba física entre dispositivos de red; las suites de salas existentes sí prueban partidas completas. Sin commit ni publicación; rama release/v2.3.0. Versión pom/UI conservada porque la petición de 2.3.0 se refiere expresamente a la rama.
