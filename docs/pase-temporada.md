# Pase de temporada

Base preparada en `codex/infra-pase-temporada`. La UI de Misiones sigue intacta. La migración `supabase/migrations/202610070005_pase_temporada.sql` se aplicó el 2026-10-07 al proyecto Supabase Tesis `ncvyaxhfbcknviznucii` (rama main), tras comprobar sus dependencias y ausencia del pase. No volver a aplicarla. Los quince controles de `supabase/tests/verificar_pase_instalacion.sql` pasan en el remoto. La integración visual con Misiones permanece pendiente.

## Temporadas y progreso

Ranking y pase comparten el identificador `temporada:YYYY-MM` y el calendario de meses naturales de `Europe/Madrid`: desde las 00:00 del primer día hasta las 00:00 del siguiente mes, límite final exclusivo. Esto respeta los cambios de horario de verano. La primera temporada se llama **Crónicas del Archivo** y contiene un pase gratuito de 10 niveles.

El progreso del pase se guarda por usuario y temporada, separado de la XP permanente y de las estadísticas del ranking. Al abrir otro mes se crea un progreso nuevo; se conserva el historial anterior. No se borran inventario ni equipamiento. Las recompensas ya desbloqueadas pueden reclamarse también al consultar su temporada pasada.

Configuración inicial provisional: nivel 1 con 0 puntos, 500 puntos entre niveles, nivel 10 con 4.500 puntos. La primera recompensa está disponible desde el nivel 1. Los puntos proceden de recibos autoritativos de partidas terminadas y misiones reclamadas, por ahora a razón de un punto por cada XP que registra el recibo. Esta conversión sólo alimenta el contador independiente: reclamar cosméticos no concede XP, puntos adicionales ni ventajas de juego. La curva se configura por temporada y la API comunica los umbrales a la futura UI.

Cada fuente tiene un recibo único para evitar abonar dos veces una partida o misión. La activación recupera los recibos del mes actual, sin convertir de golpe todo el historial vitalicio. Los recibos tardíos se asignan al mes de su fecha autoritativa; no se acredita una fuente fechada en el futuro antes de tiempo.

## Catálogo inicial

Los identificadores de cosméticos permanecen estables aunque se sustituya su asset. Los avatares utilizan por ahora el icono de perfil existente; los demás elementos usan un SVG genérico. Ninguno representa el arte definitivo.

| Nivel | Recompensa | Tipo |
| --- | --- | --- |
| 1 | Crónicas del Archivo | Insignia |
| 2 | Aprendiz del Archivo | Avatar |
| 3 | Custodio de Manuscritos | Título |
| 4 | Pergamino Antiguo | Marco |
| 5 | Archivo Nocturno | Reverso de cartas |
| 6 | Erudito de Medianoche | Avatar |
| 7 | Tinta Dorada | Placa de nombre |
| 8 | Biblioteca Prohibida | Marco épico |
| 9 | Cronista de la Academia | Título |
| 10 | Maestro del Archivo | Set legendario: marco e insignia |

Una recompensa contiene una lista de cosméticos, por lo que el set del nivel 10 se reclama completo en una sola transacción. Añadir futuros sets no requiere cambiar el contrato.

## Persistencia y seguridad

Las tablas privadas separan temporadas, catálogo, recompensas por temporada, progreso, recibos, reclamaciones, inventario y loadout. El catálogo de cada temporada fija sus derechos; la presentación del asset se resuelve desde el catálogo de cosméticos para sustituir placeholders posteriormente mediante una migración de datos.

La reclamación bloquea la cuenta, comprueba temporada y nivel en el servidor y registra una clave única por usuario, temporada y recompensa. Inventario y reclamación se escriben en la misma transacción; repetir la petición devuelve el estado sin duplicar premios. El inventario también impide duplicar un cosmético ya poseído.

El loadout tiene seis slots independientes: `avatar`, `marco`, `titulo`, `insignia`, `reverso` y `placa`. Sólo se puede equipar un cosmético propio del tipo correcto; `null` vacía el slot. Restricciones relacionales respaldan las comprobaciones de la RPC. Las tablas privadas no son accesibles directamente desde el navegador.

La identidad procede del Bearer de la cuenta Supabase. Los cuerpos HTTP no aceptan actor, XP, puntos, nivel ni premios arbitrarios. Se mantienen los controles de origen, método y JSON del servidor y la invalidación de respuestas de una sesión antigua del cliente. No se reintentan automáticamente mutaciones de resultado ambiguo.

## Conexión posterior con Misiones

| Operación HTTP | Cuerpo / parámetros | Resultado |
| --- | --- | --- |
| `GET /api/pase` | Sin parámetro para el mes actual; `?temporada=temporada:YYYY-MM` para historial | Temporada, curva, progreso y recompensas |
| `POST /api/pase/reclamar` | `{temporada, id}` | Estado actualizado del pase |
| `GET /api/cosmeticos` | — | Inventario y seis slots de equipamiento |
| `POST /api/cosmeticos/equipar` | `{tipo, id}`; `id: null` para vaciar | Inventario y loadout actualizados |

`createAccounts` ya ofrece `seasonPass`, `claimSeasonReward`, `cosmetics` y `equipCosmetic`. Misiones podrá consultar el pase para mostrar nombre, renovación, barra y próximos premios; sólo enviará el identificador de recompensa al reclamar. La RPC sincroniza recibos pendientes, de modo que la UI no calcula ni acredita progreso. Las recompensas incluyen `cosmeticos[]` y flags de desbloqueo/reclamación; `puntosSiguienteNivel` es un umbral absoluto o `null` al máximo.

El futuro selector de cosméticos consultará el inventario y enviará una operación de equipamiento. Presentar ese loadout en perfil, ranking o cartas será una integración posterior; aquí no se cambia su renderizado ni el de Misiones.

## Validación

Pasan 209 pruebas Maven, 15 suites Node y las siete migraciones con sus suites SQL en PGlite. Las pruebas SQL cubren calendario, recibos, repetición, reclamaciones, permanencia, tipos, bundles inválidos y permisos. Las pruebas HTTP verifican autenticación, validación y el contrato utilizando una RPC simulada; las del cliente comprueban transporte e invalidación de sesión. PGlite ejecuta PostgreSQL embebido en una conexión: no sustituye una prueba de contención con varias sesiones contra Supabase real. Consultar `docs/qa/pase-temporada/revision.md` para los escenarios no ejecutados.
