# Reglas de la web para v2.2.0

## Objetivo
Explicar cómo jugar a Tesis en el apartado de reglas de la página, con contenido actualizado y comprensible según el motor vigente.

## Contexto y alcance
Rama release/v2.2.0, directorio inicialmente limpio. La ayuda se abre desde inicio, sala y tablero mediante app.js. Se actualizan contenido y presentación de esa ayuda; no se alteran reglas, balance, API ni identidad.

## Fuente de verdad
Java bajo src/main/java/es/tesis/: reglas, motor, dominio, acciones y habilidades. No usar el PDF como autoridad.

## Plan de implementación
- [x] Inspeccionar reglas ejecutables y discrepancias de la ayuda.
- [x] Integrar guía pedagógica accesible y adaptable a móvil.
- [x] Validar contenido y presentación con comprobaciones pertinentes.
- [x] Revisar diff combinado y entregar.

## División multiagente
| Especialista | Responsabilidad | Área exclusiva | Dependencias y aceptación |
| --- | --- | --- | --- |
| reglas_motor | Derivar reglas y contrastar textos | Java y ayuda, solo lectura | Entrega evidencia al Lead y frontend; no modifica motor |
| reglas_ui | Redactar y presentar guía | app.js, rules.js y CSS dedicado/index si necesario | Usa contrato del motor, preserva flujos y diseño |
| QA/revisión | Comprobar resultado integrado | Solo lectura y comandos de validación | Después de implementación, informar discrepancias y límites |
| Lead | Integración y cierre | Este plan, correcciones coordinadas | Sin escritores simultáneos por archivo |

## Criterios de aceptación
- Explica objetivo, inicio, selección, turno, recursos, estudios, habilidades y final conforme a Java.
- Permite consultar reglas desde los accesos actuales con lectura cómoda y navegación por teclado y móvil.
- Conserva consultas informativas y no modifica acciones, polling ni privacidad.
- Diff sin cambios accidentales; pruebas pertinentes y limitaciones documentadas.

## Tests y riesgos
- QA ejecutó las ocho suites `tests/*.test.mjs` con `node --experimental-vm-modules`: todas pasan. No verifican por sí mismas el texto de la ayuda.
- Revisión independiente del contenido contra Java: preparación, selección, acciones, catálogo, probabilidades, habilidades, veto, ingresos, cierre y empate conformes. Motor y API sin cambios.
- Chrome/Playwright real a 1440×900, 768×1024, 390×844 y 360×800: guía y desplegables abiertos sin desbordamiento horizontal del diálogo/página ni errores JavaScript; navegación al apartado, Enter en desplegables, Escape y restitución del foco correctos. Tabla desplazable en móvil. Capturas inspeccionadas manualmente; evidencia local ignorada en target/qa-rules/.
- `git diff --check`: limpio. Inspeccionados diff y archivos nuevos (CSS/plan).
- El arranque Maven inicial no pudo crear C:/.m2/repository. Alternativa con repositorio existente: `mvn "-Dmaven.repo.local=C:/Users/radeu/.m2/repository" -o compile exec:java`, PORT=8091; servidor arrancado. Recursos finales copiados a target/classes para validación. No se ejecutaron JUnit ni una partida completa: no cambia Java ni mecánica.
- Fuera del alcance: comentarios históricos de habilidades/package-info.java contradicen las implementaciones actuales de Pre-Doctoral/Revisor; no se usaron como fuente ni se modificaron.

## Decisiones
Guía en help() existente y CSS dedicado enlazado al final; navegación mediante botones con foco al encabezado, sin cambiar URL. Conserva diálogo kind info y acceso desde inicio/sala/tablero. Sin cambios de versión del producto ni commits.

## Estado
Terminado, incluida iteración visual solicitada: medalla de prestigio, leyenda de recursos, cuatro acciones ilustradas, ejemplo visual idea→estudio→publicación y retratos de siete personajes. Se reutilizan WebP existentes (19 imágenes, 15 rutas únicas); no arte nuevo ni cambios de reglas.

QA de la iteración visual: las ocho suites Node vuelven a pasar; rutas y mayúsculas exactas comprobadas, HTML/CSS y diff revisados sin bloqueantes. Chrome comprobado de nuevo en los cuatro tamaños; todas las imágenes decodificadas, sin errores JavaScript ni desbordamiento horizontal con desplegables cerrados/abiertos. Navegación/Enter/Escape/foco correctos. Capturas actuales de objetivo, publicación, personajes y consulta en target/qa-rules/; inspección manual de escritorio y móvil satisfactoria. Pendiente ajeno al alcance: ilustración histórica del Pre-Doctoral contiene textos decorativos antiguos, pero se conserva la ruta vigente de CatalogoVisual. Sin commits.

Último ajuste solicitado: el ejemplo muestra la carta completa en los tres pasos (marco, nombre y valores), reutilizando ideaCardContents en una figura no interactiva. Carta de 156 px también en móvil para leer sus valores; retirado sello superpuesto. Actualizado mock de import en progress_polling.test.mjs. Pruebas progress_polling y selection pasan; Chrome repetido en 360/390/768/1440 px con 21 imágenes cargadas, sin errores/desbordamientos y teclado correcto. Capturas actuales de publicación inspeccionadas en escritorio y móvil. Diff revisado y git diff --check limpio.
