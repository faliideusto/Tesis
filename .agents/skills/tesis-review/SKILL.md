---
name: tesis-review
description: "Revisar el diff final o cambios importantes de Tesis para detectar regresiones, problemas de arquitectura, privacidad y coordinación antes de integrar."
---

# Revisión e integración de Tesis

Leer `AGENTS.md`, alcance/criterios y evidencia QA. Revisar resultado combinado cuando termine la implementación; empezar en modo lectura y coordinar correcciones con Lead/propietario. Para tareas pequeñas, el Lead puede aplicar esta revisión directamente.

## Inspección

- `git status --short`, rama, `git diff --stat`, `git diff` y `git diff --cached` si hay cambios staged. Inspeccionar también nuevos archivos no seguidos; no asumir que el diff normal los incluye. Para commits/ramas usar la base acordada.
- Alcance y cambios accidentales, archivos innecesarios/generados, duplicación, código muerto, complejidad, errores y pruebas realmente ejecutadas.
- Separación motor/reglas/dominio/acciones/habilidades y adaptador web; ninguna regla crítica nueva en JS. Contrastar con implementación Java, nunca corregir contra PDF por iniciativa propia.
- Para web: actor derivado del token, turno/miembro/anfitrión, revisión exterior/interior, bloqueo de sala, carreras y duplicados, transición automática de ronda en consultas y aislamiento entre salas.
- DTOs y eventos públicos: no manos rivales, roles ocultos, veto privado, tokens ajenos ni historial/instantáneas sin filtrar. La privacidad del DOM no sustituye privacidad de respuesta. Revisar separación de compatibilidad local y API de salas.
- Frontend: polling/respuestas antiguas, reconexión, consultas persistentes/decisiones invalidadas, escape HTML, índices de opciones y animaciones sin efectos de juego.
- Para infraestructura: frontmatter/rutas de cuatro skills, coherencia con `AGENTS.md`/`.agent/PLANS.md`, comandos/clases existentes y ausencia de cambios funcionales.

No convertir una revisión ordinaria en una auditoría de todo el repositorio. No atribuir al diff un defecto previo sin evidencia.

## Hallazgos y cierre

Clasificar: **Bloqueante** (corregir antes de integrar), **Importante** (problema relevante que puede necesitar decisión) o **Recomendación** (opcional). Cada hallazgo debe indicar ubicación, caso concreto, consecuencia y evidencia; evitar hipótesis sin soporte y listas inventadas. Si está bien, declarar que no se encontraron bloqueantes y señalar límites de la revisión.

Tras correcciones, revisar el diff afectado y pruebas pertinentes. Entregar al Lead hallazgos/ausencia de ellos, aceptación pendiente y riesgos residuales. Revisar no autoriza commit, merge, push o publicación automática.
