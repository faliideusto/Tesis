# Telegram local para Tesis

Choquet conversa con Codex desde un bot privado. Cada mensaje autorizado se procesa desde una copia nueva del `main` de **faliideusto/Ciudadela-Academica**. Si faltan detalles, el bot pregunta sin publicar. Una implementación completa pasa Maven, todas las suites Node y una revisión Codex independiente; después el publicador hace commit y push normal a `main`. Render tiene Auto-Deploy activado según el propietario. El bot avisa de la subida y enlaza la web; **no verifica que Render haya terminado ni que sirva ese commit**.

No hace falta instalar dependencias del bot. Requisitos: Windows, Node 18+, Java 17+, Maven, Git y Codex CLI instalado mediante npm y autenticado. El bot invoca `bin/codex.js` directamente con Node y usa la autenticación existente de Codex; consume sus límites. Git debe tener acceso de lectura y escritura al repositorio personal mediante el administrador de credenciales. Las protecciones de main siguen aplicándose: si exigen PR, Git rechazará el push y habrá que adaptar el flujo. No se eluden protecciones ni se hace force push.

## Configuración inicial

Desde la raíz del proyecto:

1. En Telegram, abrir [BotFather](https://t.me/BotFather), enviar `/newbot` y crear un bot dedicado. Guardar su token; no enviarlo por chat ni incluirlo en commits.
2. Ejecutar `powershell -NoProfile -File tools/telegram-bot/setup.ps1`. Introducir el token en la entrada oculta y dejar vacíos los IDs la primera vez. El token se cifra con DPAPI para el usuario Windows actual en `.telegram-bot/token.dpapi`.
3. Ejecutar `powershell -NoProfile -File tools/telegram-bot/start.ps1 -Identify`. Tú y Choquet abrís el nuevo bot y enviáis `/id`. Aparecerán vuestros IDs. Este modo nunca ejecuta solicitudes.
4. Cerrar con Ctrl+C. Repetir `setup.ps1` e introducir los dos IDs separados por comas. Se conserva el token existente.
5. Si falta autenticación, ejecutar `codex login` y autenticarse. Comprobar acceso Git con `git ls-remote personal refs/heads/main`; esto comprueba lectura, no permiso de push.
6. Ejecutar `powershell -NoProfile -File tools/telegram-bot/start.ps1`, o abrir **Iniciar bot.cmd**. Mantener la ventana abierta y evitar suspensión del ordenador.

También puedes hacer doble clic en **Configurar bot.cmd**, **Obtener IDs.cmd** e **Iniciar bot.cmd** para realizar esos pasos sin escribir comandos.

La configuración, token, mensajes, cola y copias de trabajo permanecen en `.telegram-bot/`, ignorado por Git. No compartir esta carpeta: aunque el token esté cifrado, el historial y los logs no lo están. El token se descifra solo al arrancar y no se hereda a Codex, Git ni las pruebas. Codex conserva su propia autenticación en su ubicación habitual. Para cambiar IDs, cerrar el bot y repetir configuración; nunca se autoriza por nombre visible de Telegram.

## Uso

Escribir mensajes normales: «Haz las cartas de idea más grandes en móvil». El bot confirma recepción, conversa si necesita detalles y comunica el resultado. Cada persona conserva únicamente su propio contexto (últimos doce mensajes), y el trabajo completo es secuencial. Las preguntas pueden incluirse en mensajes normales.

- `/estado`: últimas cinco solicitudes propias.
- `/nuevo`: empezar otro tema cuando no haya solicitudes propias pendientes.
- `/id`: identificar la cuenta.
- `/start`: ayuda e ID.

Solo se admiten chats privados y texto. Fotos, audios, grupos y usuarios no autorizados no ejecutan código. El bot no es esta conversación del editor; recibe las instrucciones del proyecto y el historial local de cada persona. Los permisos de Telegram están delegados por el propietario para solicitudes del juego, no para administrar el ordenador.

## Publicación y fallos

Se permiten automáticamente archivos de `src/main/`, `src/test/`, `tests/*.test.mjs` y `docs/`. Infraestructura, reglas del agente, Docker, pom.xml, herramientas y migraciones Supabase requieren intervención; el bot se detiene si aparecen en el cambio. No debilitar pruebas. La revisión automática reduce errores, pero no garantiza que una modificación sea correcta.

Codex trabaja con sandbox `workspace-write`, sin cargar configuración personal de herramientas/MCP y sin acceso al token Telegram. El publicador ejecuta las pruebas **con los permisos del usuario Windows**, fuera del sandbox de Codex: usar solo con personas de confianza. No equivale a una máquina virtual. Este proceso tiene permiso de push mediante las credenciales Git del usuario. Las restricciones de rutas y las comprobaciones son controles de publicación, no un aislamiento contra código hostil.

Si main cambia durante una tarea, se detiene sin rebase automático. Si una prueba falla o la revisión no aprueba, no se publica. Las copias y evidencias quedan en `.telegram-bot/jobs/ID/`: `failure.log`, `review-result.json` y, si se intentó publicar, `publication.json`. Una interrupción o fallo de red durante push puede ocurrir después de que GitHub haya recibido el commit: se comunica que no puede confirmarse, se conserva el SHA y no se reintenta la mutación automáticamente. Comprobar el remoto antes de repetir.

Cada actualización se guarda con su ID antes de confirmar recepción, para que una reconexión no ejecute dos veces la solicitud. Las respuestas Telegram pueden duplicarse si se pierde la confirmación de entrega. Solo puede arrancar una instancia; las tareas interrumpidas por cierre forzado no se vuelven a ejecutar al reiniciar. Ctrl+C deja acabar la tarea actual y detiene las nuevas. Si cierras la ventana a la fuerza, revisa el registro y main antes de reenviar. Las peticiones recibidas mientras el PC está apagado pueden recuperarse al volver a arrancar dentro de la retención de Telegram (hasta 24 horas).

Al desplegar, Render puede reiniciar el servidor: las salas y partidas en curso viven en memoria y pueden perderse. Los cambios se publican en cuanto pasan las comprobaciones; no hay programación según partidas activas. Para deshacer un cambio, pedir al propietario que prepare un revert del commit, conservando el historial.

## Validación de la infraestructura

`node --test tests/telegram_bot.test.mjs` prueba autorización, deduplicación, persistencia, secretos y publicación/bloqueos mediante Git local y agentes simulados. No envía mensajes reales ni publica en GitHub. La primera prueba real debe ser una consulta informativa («¿Qué puedo pedirte?»), seguida de un cambio pequeño y verificable.

Fuentes: [Bot API de Telegram](https://core.telegram.org/bots/api), [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode).
