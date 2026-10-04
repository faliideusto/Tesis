# Planes de implementación de Tesis

Crear un ExecPlan para tareas grandes: reglas, turnos, multiplayer, nueva mecánica, refactor, arquitectura, release, cambios de varias capas con riesgo y coordinación multiagente. Una tarea media puede necesitarlo por incertidumbre/dependencias. Textos, estilos y bugs aislados no requieren plan.

Guardar en `.agent/plans/<nombre-de-tarea>.md`. El plan debe permitir continuar sin depender del historial del chat: rutas concretas, situación inicial, decisiones y evidencia. Mantenerlo mientras se trabaja; registrar pasos completados, bloqueos y cambios de alcance. No marcar terminado con criterios pendientes. No crear planes de funcionalidades futuras que nadie haya pedido.

Para reglas, identificar primero el motor Java relevante: es la autoridad vigente, nunca el PDF. Para la web, incluir adaptador, privacidad, revisiones y frontend cuando afecten al contrato. El plan no autoriza acciones fuera de la petición ni impone cambios al juego.

## Plantilla ligera

```markdown
# Nombre de la tarea

## Objetivo
Resultado observable.

## Contexto
Estado inicial, motivo y rama/cambios locales relevantes.

## Alcance
Cambios incluidos.

## Fuera de alcance
Comportamientos y archivos excluidos.

## Áreas afectadas
Rutas concretas y capas involucradas.

## Fuente de verdad
Clases/métodos que gobiernan el comportamiento actual.
Para reglas de Tesis: motor Java, no PDF.

## Plan de implementación
- [ ] Inspección y contratos.
- [ ] Implementación.
- [ ] Integración y validación.
- [ ] Revisión del resultado combinado.

## División multiagente
Solo si corresponde; si se omite, indicar ejecución directa.
| Especialista | Responsabilidad | Archivos/área exclusivos | Dependencias/contrato | Aceptación |
| --- | --- | --- | --- | --- |

## Criterios de aceptación
Condiciones verificables.

## Tests
Comandos, escenarios, resultados y no ejecutados; actualizar durante el trabajo.

## Riesgos
Regresiones, privacidad, concurrencia o integración aplicables.

## Decisiones
Fecha, decisión y motivo cuando sea relevante.

## Estado
Pendiente / en progreso / terminado; siguiente paso o impedimento.
```

Antes del paralelo, acordar DTO/API compartidos y propietario de cada archivo. Si hay solapamiento, serializar o reasignar; los worktrees no eliminan dependencias. QA normalmente después de integración comprobable; review del diff final. Mantener pocos agentes: no crear todos los roles por defecto. Para cambios pequeños, Lead valida y revisa directamente.
