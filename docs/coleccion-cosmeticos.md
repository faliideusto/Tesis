# Contrato de Personalización

Actualización posterior: migración007 cierra el catálogo en doce piezas y añade la interacción legendaria Lanzamiento de libro al set de nivel10. Véase `recompensas-cronicas-archivo.md`. La afirmación de once piezas y categoría vacía de la instalación006 describe su estado anterior. El contrato preparado para limitar la mesa a cuatro tipos está en `cosmeticos-en-partida.md`.

La migración `202610070006_coleccion_cosmeticos.sql` amplía la RPC existente `cosmeticos()` y, por tanto, `GET /api/cosmeticos` y la respuesta de `POST /api/cosmeticos/equipar`. Conserva `inventario` y los seis slots iniciales de `equipamiento`, y admite un séptimo slot futuro `interaccion`.

`interaccion` tiene las mismas comprobaciones de propiedad, tipo y desequipamiento que los demás cosméticos. No crea cosméticos nuevos en el catálogo inicial, acciones, animaciones ni ventajas; solo prepara su inventario y equipamiento para una futura representación visual. La migración amplía las constraints del catálogo y loadout sin cambiar la migración 005 ya desplegada. El backend exige los siete slots en la respuesta actualizada.

Añade `catalogo`: entradas `{cosmetico: {id,tipo,nombre,asset,rareza}, temporada: {id,nombre}, nivel}`. Incluye los premios del mes actual y de los meses registrados en el progreso del actor; el mismo cosmético puede tener varios orígenes mensuales. La propiedad se determina siempre con el inventario permanente, nunca con el nivel requerido. Un premio alcanzado pero sin reclamar sigue sin poseerse. El bundle final presenta dos cosméticos con su nivel 10.

Añade `temporadas`: `{id,nombre,inicio,fin,nivel,maxNivel,recompensasObtenidas,totalRecompensas}`. El contador cuenta reclamaciones de premios (10), no piezas cosméticas (11). Solo incluye meses reales del usuario y el mes vigente, sin inventar próximas temporadas ni mostrar datos de otros usuarios.

Leer cosméticos registra el mes actual y sincroniza sus recibos mediante la implementación de pase existente. No otorga premios, no añade XP y no equipa automáticamente. El actor sigue siendo el JWT. El adaptador Java valida/proyecta explícitamente el contrato y tolera la ausencia de campos nuevos durante un despliegue escalonado.

La UI agrupa por ID estable, resuelve la propiedad por inventario y muestra requisito con el origen de catálogo. Cada imagen usa el campo `asset` del servidor: sustituir el placeholder solo requiere actualizar esa ruta en el catálogo existente. No hay un segundo catálogo de assets ni temporadas ficticias en el cliente.

## Instalación y comprobación

Aplicada el 7 de octubre de 2026 en Supabase Tesis (`ncvyaxhfbcknviznucii`), rama `main`. SHA256 del archivo ejecutado: `B429CF264A9DF49F0F56D85A750BC25FCFE09E1C7704627AC588E525DEBA71D0`. No es necesario volver a ejecutarla en este proyecto.

La consulta administrativa de solo lectura `supabase/tests/verificar_coleccion_instalacion.sql` pasó sus seis controles: constraints de catálogo/loadout, respuesta ampliada, equipamiento de interacciones, permisos y catálogo inicial intacto. No modificó cuentas ni reclamó recompensas. Esto verifica instalación; el flujo completo con Supabase Auth/PostgREST y una cuenta real sigue pendiente de QA.

Para otros entornos, aplicar el archivo completo de migración 006 después de la 005. Es una transacción y `CREATE OR REPLACE` conserva el contrato existente; la migración reafirma que solo `authenticated` puede ejecutar la RPC. No ejecutar las suites con fixtures en producción.

Comprobar con una sesión de cuenta real `GET /api/cosmeticos`: debe contener las cuatro claves, 11 entradas actuales y la temporada mensual. No hay que reclamar cosméticos para ver sus requisitos. El editor SQL administrativo no representa una sesión autenticada de usuario y no debe utilizarse para simularla sobre cuentas reales.

Validación local: `node supabase/tests/run-pglite.mjs` ejecuta ocho migraciones y pruebas de aislamiento, catálogo inicial, bundle, propiedad, equipamiento y archivo mensual. `mvn -Dtest=PaseTemporadaHttpTest test` comprueba proyección, validación de rutas/assets/requisitos/fechas y compatibilidad de respuestas HTTP. PGlite no reproduce Supabase Auth/PostgREST ni carreras entre conexiones.
