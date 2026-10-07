# QA de Misiones y pase

La prueba de navegador `node tools/qa_missions.mjs` levanta un servidor HTTP de fixtures en loopback, utiliza el frontend real y carga los PNG definitivos del catálogo. No utiliza identidades reales, no contacta Supabase y no acredita por sí sola una migración instalada en el proyecto remoto.

## Escenarios automatizados

- Desktop 1672 × 941 y 1366 × 768, móvil 390 × 844: capturas, imágenes cargadas y ausencia de desbordamiento horizontal.
- Misiones diarias, semanales y de temporada con progreso parcial, completas y reclamadas. Las reclamadas permanecen visibles; filtros por período y estado.
- Una misión completa reclama una vez incluso ante dos clics consecutivos. El fixture devuelve el progreso del servidor y el pase pasa de 450 puntos/nivel 1 a 500 puntos/nivel 2.
- Recompensa desbloqueada reclamable; inventario permanente actualizado. Reclamar cosméticos conserva tanto la XP permanente como los puntos del pase.
- Recarga conserva reclamaciones y puntos en el servidor de prueba.
- Error 503 no produce reintentos automáticos ni modifica el progreso.
- Una reclamación confirmada conserva el estado recibido del POST aunque fallen las lecturas posteriores de misiones y pase.
- Diez recompensas, gran premio final con marco, insignia e interacción; sus cosméticos y el avatar reclamado aparecen desbloqueados en Personalización.
- Fin de octubre de Madrid expresado mediante el instante UTC correcto después del cambio de hora.
- Reloj del navegador fijado: quedan 24 días/11 horas el 7 de octubre a las 12:00 UTC, un minuto antes del límite queda un minuto y en el límite aparece «Temporada finalizada». La respuesta de temporada inactiva deshabilita reclamaciones.
- Los 13 PNG definitivos, incluidas las hojas e impacto de la interacción, responden correctamente.

Evidencia generada en `target/qa-missions/`: capturas y `result.json`. Los resultados se publican únicamente tras ejecutar el script; los fixtures no prueban concurrencia transaccional, RLS ni persistencia de Supabase tras reiniciar el servidor.

Resultado local ejecutado el 7 de octubre de 2026: **PASS**, seis capturas, sin errores JavaScript ni imágenes rotas. Revisión visual manual de desktop y móvil realizada; se detectó y corrigió un selector de ornamentos que solapaba los iconos de las estadísticas. Las capturas definitivas ya incluyen la corrección.

Para una preview separada de QA: establecer `TESIS_MISSIONS_PREVIEW=1` y ejecutar el script. Escucha en `http://127.0.0.1:8140/#misiones` (puerto configurable mediante `TESIS_PREVIEW_PORT`), muestra permanentemente «QA local · datos simulados · sin Supabase» y conserva su estado solo mientras vive el proceso. También exporta `startMissionsPreview(port)` para herramientas locales.

## Comprobaciones de backend y despliegue

Las pruebas SQL y HTTP deben acreditar autenticación, reclamación única/idempotencia del servidor, separación de XP y puntos, estado mensual compartido con ranking, catálogo/inventario y bundle de nivel 10. Aplicar una migración local no demuestra que esté aplicada en Supabase remoto. La validación remota requiere utilizar el proyecto configurado y datos controlados de una cuenta autorizada.

Despliegue remoto verificado el 7 de octubre: migración009 aplicada a Tesis/main, SHA256 4DEFBED9A1D9898823AC024407792895C83DD26017AFA23BD79B47D7BA06B848. Supabase devolvió Success. No rows returned. La consulta administrativa de sólo lectura dio cinco PASS: helper mensual, RPC/puntos, calendario compartido, permisos y trigger de recibos. Sin crear datos ni reclamar premios en cuentas reales. Maven completo229PASS y20suitesNodePASS. Revisión final sin bloqueantes; último ajuste resalta el set legendario, muestra tipos del bundle y evita reclamar con un estado activo caducado en caché.
