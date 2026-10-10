# Bot local de Telegram para Tesis

## Objetivo
Choquet solicita cambios en un chat privado; Codex conversa, implementa y el bot publica en main tras validación automática. Render tiene Auto-Deploy activado según el usuario.

## Contexto
Inicio limpio en release/v2.6.0. Infraestructura aislada en codex/infra-telegram-bot. El usuario confirmó el remoto personal (faliideusto/Ciudadela-Academica) conectado a Render. Codex CLI 0.162.1, Node, Git y Maven disponibles; autenticación ChatGPT existente comprobada.

## Alcance
Bot local sin dependencias npm, autorización por ID, cola persistente, copias independientes, integración Codex CLI, pruebas/revisión y push normal a main. Asistente de configuración Windows y documentación.

## Fuera de alcance
Cambios al juego, migraciones automáticas, instalación de servicios y envío real de mensajes sin configurar el bot. No confirmar despliegue sin evidencia de Render. La publicación de esta infraestructura quedó autorizada posteriormente por el usuario el 2026-10-10.

## Áreas afectadas
tools/telegram-bot/, tests/telegram_bot.test.mjs, .gitignore, este plan.

## Fuente de verdad
Motor Java para futuros cambios de reglas. Bot API oficial de Telegram y Codex CLI instalado para transporte/ejecución.

## Plan de implementación
- [x] Inspección y contratos.
- [x] Implementación.
- [x] Integración y validación local.
- [x] Revisión del resultado combinado.
- [x] Configuración cifrada, conexión real de Telegram y autorización del propietario.
- [ ] Autorizar ID de Choquet y probar una solicitud completa del bot.

## División multiagente
Ejecución directa: infraestructura localizada; implementación y revisión secuenciales.

## Criterios de aceptación
Solo IDs permitidos en privado ejecutan tareas; actualizaciones no se duplican; un único publicador; fallos, cambios de infraestructura y main concurrente bloquean push; secretos fuera del repo y del entorno de comandos; conversación por usuario; instrucciones de arranque y límites explícitos.

## Tests
`node --test tests/telegram_bot.test.mjs`: 15/15 PASS, con Git real local y agentes simulados. Primera ejecución falló por permisos del sandbox Windows; repetición fuera del sandbox aprobada y correcta. Cobertura: autorización, duplicados, recuperación, privacidad de conversación, entorno sin secretos, rutas, stdin de Codex, publicación secuencial, tests/revisión fallidos, main concurrente y modificaciones durante validación.

`node target/telegram-bot-smoke.mjs`: consulta real de solo lectura a Codex PASS, con stdin y esquema JSON; detectó y permitió corregir el wrapper PowerShell, sustituido por invocación Node directa de bin/codex.js. Artefactos de smoke y tests en target/, ignorados.

Sintaxis Node/PowerShell y git diff --check: PASS. Revisión manual de archivos nuevos y diff: sin bloqueantes detectados. No se ejecutaron Maven ni navegador para esta infraestructura porque no cambia el juego. No se configuró Telegram ni se hizo push/commit remoto o despliegue real.

2026-10-10, activación desde móvil: credencial introducida y cifrada con DPAPI en la carpeta ignorada; configuración local del repositorio personal creada sin IDs autorizados. Bot real conectado como @TesisGpt_bot, en segundo plano y modo identificación. Corregidos import de Security mediante $PSHOME (conflicto de módulos Windows/runtime) y Trim del fichero DPAPI antes de descifrar. Arranque real, getMe y ausencia de webhook verificados; todavía no se han recibido/seleccionado IDs ni se han habilitado cambios. Ningún valor secreto se incluye en este plan.

2026-10-10: propietario identificado desde Telegram y autorizado según el ID facilitado directamente. Proceso de identificación detenido sin trabajos activos; bot reiniciado en segundo plano en modo normal y conexión verificada en runtime.log. Lectura de main remoto personal confirmada con git ls-remote. Pendientes ID de Choquet y primera solicitud/prueba completa; no se ha intentado push remoto.

2026-10-10, entrega autorizada: rama de infraestructura integrada con main personal v2.7.0 sin conflictos. Diff respecto a main limitado a doce archivos de infraestructura/documentación. Maven completo: 254 pruebas, cero fallos/errores/omitidas. Node: 22 suites PASS, incluidas 15 pruebas del bot. Empaquetado Maven PASS. Revisión manual, sintaxis PowerShell, diff --check, exclusión de .telegram-bot/target y búsqueda de credenciales en archivos de entrega PASS. Sin cambios adicionales al motor/frontend respecto a main; no se repitió QA de navegador. Operación final de entrega: avanzar main local por fast-forward, push normal al main personal, comprobar SHA remoto y reiniciar el bot. No certificar finalización del despliegue Render sin evidencia del proveedor.

## Riesgos
Automatización ejecuta código del repositorio con los permisos del usuario; el sandbox de Codex no aísla las pruebas del publicador. Reinicios de Render pierden salas en memoria. Apagado durante push ambiguo: no repetir automáticamente.

## Decisiones
2026-10-10: ejecución mientras el PC esté encendido, autenticación existente de Codex; publicación automática solicitada por el usuario, con comprobaciones externas al agente.

2026-10-10: usuario solicita subir toda la infraestructura a main para preparar el uso de Choquet. main personal ya contiene v2.7.0, más reciente que la base v2.6.0 de esta rama. Integrar main sin revertir ese balance, validar el resultado combinado y publicar únicamente al remoto personal, excluyendo .telegram-bot/ y target/. Bot pausado mientras se integra; reiniciar al terminar. El acceso de Choquet sigue dependiendo de su ID, no de esta publicación.

## Estado
Implementación, integración con v2.7.0 y validación completas; infraestructura comprometida en rama de tarea para entrega autorizada a main personal. Bot configurado para el propietario y pausado durante la entrega, con reinicio previsto al finalizar. Pendientes ID de Choquet y primera solicitud automática con despliegue verificado de extremo a extremo. Los datos privados permanecen exclusivamente en la carpeta ignorada.

## Corrección de la primera consulta real
2026-10-10: solicitud informativa detenida antes de ejecutar Codex porque el clone remoto completo falló con curl18/early EOF. No hubo modificaciones ni publicación. Corrección en codex/fix-telegram-download: clonar los objetos versionados desde el repositorio local, obtener main remoto con fetch de profundidad uno, usar HTTP/1.1 y reintentar solo errores transitorios de fetch. Nunca copiar cambios sin commit ni .telegram-bot/. Mensaje temprano de preparación y error explícito cuando no se ha ejecutado Codex. Actualizar URL canónica a faliideusto/Tesis.

Validación de la corrección: 19/19 pruebas Node PASS (incluyen main remoto reciente, aislamiento de cambios/datos, recuperación de red, fallo persistente y ausencia de reintento de push); sintaxis Node y diff --check PASS. Preparación real contra GitHub PASS en cuatro segundos, comparando SHA con main remoto. Consulta informativa original repetida explícitamente en sandbox read-only con comprobación externa que impide publicar: Codex respondió y la respuesta está en la cola de Telegram. Registros y scripts de diagnóstico en directorios ignorados. Revisión del diff sin bloqueantes detectados; no se repiten pruebas Java/navegador al no modificar el juego. Reinicio y entrega por Telegram se comprueban después de publicar la corrección.
