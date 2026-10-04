---
name: tesis-backend
description: "Modificar el motor Java, reglas, acciones, estado de partida o salas multijugador de Tesis, incluidos contratos y privacidad del backend."
---

# Backend y reglas de Tesis

Leer `AGENTS.md`; consultar `docs/AI_TEAM.md` solo para mapa detallado y observaciones. Las reglas actuales se derivan del motor Java, no del PDF. No adaptar reglas a documentación histórica salvo petición explícita; el frontend nunca gobierna reglas críticas.

## Localizar la autoridad antes de editar

Rutas bajo `src/main/java/es/tesis/`:

- `motor/MotorJuegoImpl`, `ContextoJuegoImpl`, `EstadoSeleccionRoles`, `EstadoTurno`, `EstadoFinRonda`, `EstadoFinPartida`: transición, vetos, ingresos y recuperación sin repetir efectos.
- `reglas/ReglasAcademicas`: jugadores, recursos iniciales, límites de acciones, obligación del Comité y condición de cierre.
- `dominio/Partida`, `Jugador`, `Estudio`, `Mazo`, `FabricaMazos`: orden/fases, manos, monedas, trabajo, publicación/prestigio, costes y probabilidades; `acciones/` ejecuta comandos y `habilidades/` efectos de personaje.
- `web/ServidorWeb`, `GestorSalas`, `SalaJuego`, `SesionJuego`, `Vistas`, `CatalogoVisual`: HTTP, registro, identidad/revisión, adaptador y presentación. No existe capa Spring de servicios/controladores.

Seguir petición → autenticación → adaptador → comando/regla → dominio → DTO. Inspeccionar pruebas del comportamiento antes de modificarlo. Al cambiar una regla, revisar validación, ejecución, previsualización, catálogo y compatibilidad de guardados; evitar introducir reglas alternativas en el adaptador o JS. No cambiar costes/balance fuera del alcance.

## Contratos a preservar

El token de sala determina al actor; `objetivo` nunca lo sustituye. Mantener comprobación de miembro/turno, bloqueo de sala y revisión exterior; no confundirla con la revisión de `SesionJuego`. Acciones obsoletas deben rechazarse, sin duplicar recursos. El GET de estado puede continuar fin de ronda tras 5 s: incluirlo en el análisis de carreras y revisiones.

Generar vistas por jugador y eventos con campos públicos explícitos. Nunca enviar mano rival, rol rival sin revelar, propietario de rol indisponible, veto privado, token ajeno, historial bruto o instantáneas. No basta ocultar datos en HTML. Preservar separación de rutas locales de pruebas `/api/game*` y salas del servidor normal. No prometer recuperación de token ni persistencia de salas que no existen.

## Validar y entregar

Reutilizar JUnit de `src/test/java/es/tesis/` y `web/`: `ReglasBalanceTest`, `FlujoYHabilidadesTest`, `PersistenciaTest`, `SalasTest`, `SalasHttpTest`, `PerspectivaHabilidadesTest` según impacto. Ejecutar `mvn test` para cambios amplios; documentar errores de entorno por separado. Añadir pruebas de comportamiento cuando haya una regla/contrato nuevo o regresión significativa. Entregar archivos, contrato afectado, resultados y dependencias pendientes al Lead; coordinar cambios de `Vistas`/JS antes de editar en paralelo.
