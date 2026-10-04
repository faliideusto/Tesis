# Tesis 2.0.0: cuentas y progresión persistente

## Objetivo y autorización

Diseñar registro/login por correo y contraseña con Supabase Auth y perfiles con nombre, XP, nivel, partidas terminadas y victorias en PostgreSQL. Java sigue siendo autoridad del resultado. Frontend y backend en un único Web Service gratuito de Render.

La fase inicial solo autorizaba diseño. El usuario indicó posteriormente **«empieza a implementar»**, autorizando el código funcional en `release/v2.0.0`. Se implementan correo/contraseña con mínimo 6, autoconfirmación deseada, sin SMTP propio ni recuperación pública, invitados y progreso sin ventajas. No se autorizaron commit, push, merge ni nuevos despliegues. Las migraciones remotas y claves de Render siguen pendientes de configuración y validación real; no se han aplicado ni se solicitan secretos por chat. Los apartados de diseño inicial describen decisiones e inspecciones históricas; el estado de implementación y la guía actual `docs/CUENTAS_SUPABASE_RENDER.md` prevalecen sobre alternativas anteriores.

## Contexto y evidencia (2026-10-05)

- Inicialmente `main`, commit `a8f22dc`, árbol limpio. Inspeccionadas ramas locales y referencias remotas disponibles (sin fetch); no existía `release/v2.0.0`. Creada desde `main` por petición expresa. La escritura Git necesitó escalación por `.git` de solo lectura; creación autorizada y completada. Todo el trabajo posterior en `release/v2.0.0`.
- Maven único, Java 17, Gson, JUnit 5; sin Spring/JDBC/SDK Auth actuales. `pom.xml` mantiene `1.0.0-SNAPSHOT`: actualizar a 2.0.0 durante implementación, no ahora.
- `ServidorWeb` sirve API y estáticos del classpath en el mismo origen. Arranque de red usa HOST/PORT; PUBLIC_ORIGIN valida mutaciones tras proxy. Cuatro hilos HTTP: evitar que llamadas externas lentas los consuman o retengan bloqueos de sala.
- Existe Dockerfile Maven/Temurin 17 multietapa. Empaqueta omitiendo tests y arranca con `mvn exec:java`; revisar arranque con dependencias disponibles en runtime, preferiblemente Java directo con classpath preparado en build. JAR actual no autónomo.
- `GestorSalas`: mapa en memoria, máximo 256 salas, código corto reutilizable, caducidad 24 h. `SalaJuego`: tokens aleatorios, jugadores en memoria, autenticación/revisión/acción/vista sincronizadas. No persistencia ni recuperación de sala tras reinicio.
- `api.js`: Bearer es token de sala, `sessionStorage`, cola de fetch y timeout 12 s. `app.js`: polling 900 ms, generaciones y revisiones descartan respuestas antiguas. Preservarlos.
- `.gitignore` no excluye `.env`: prever exclusiones y `.env.example` sin valores reales en implementación.

## Fuente de verdad y finalización

- `src/main/java/es/tesis/reglas/ReglasAcademicas.java#debeFinalizarPartida`: tercera publicación desencadena cierre al acabar ronda.
- `motor/EstadoFinRonda.java#avanzar`: llama `Partida.finalizar()` y entra en `EstadoFinPartida`.
- `dominio/Partida.java#ganadores`: solo en FIN_PARTIDA; todos los jugadores con prestigio máximo ganan. NO desempatar ni premiar automáticamente a quien publique primero.
- `motor/EstadoFinPartida.java#entrar`: evento `partida.fin` con nombres; no es identificador persistente ni recibo de recompensa.
- `web/SesionJuego.java#ejecutar` y `#avanzarRondaAutomatica`: cierre manual y automático convergen en ejecución del motor.
- `web/SalaJuego.java#vista` y `#continuarRondaSiCorresponde`: un GET puede avanzar FIN_RONDA tras 5 s. La recompensa debe observar ambos caminos, sin repetir transición ni alterar revisiones.
- `SesionJuego.vista/evento` y `Vistas`: proyección privada explícita. No usar JSON de vistas, historial textual, nombres ni datos enviados por cliente para adjudicar resultados.

## Alcance propuesto

Auth email/password con mínimo 6, sin confirmación de correo ni recuperación pública (decisión del usuario), cerrar sesión; perfil propio, nombre editable para futuras salas, XP/nivel/contadores; invitados; asociación de cuenta al entrar; resultado mínimo y liquidación transaccional; feedback de progreso pendiente/confirmado/error; migraciones versionadas y guía de configuración; Docker/Render sin nuevos despliegues. El guardado remoto de Confirm email Off todavía debe verificarse.

Fuera de alcance: reglas, costes, personajes, balance, ventajas por nivel, condición de cierre/victoria; persistir partidas activas, restaurar tokens por cuenta/nombre, emparejamiento, clasificación pública, amistades, logros, temporadas, cosméticos, proveedores sociales (incluidos Google/Apple, aplazados por el usuario), fusión manual de cuentas, estadísticas completas y sistemas antifraude sofisticados. No persistir manos/roles/eventos ni snapshots en tablas de progresión. No modificar ni recompensar `/api/game*` de compatibilidad loopback/CLI.

## Arquitectura y contratos propuestos

1. Un servicio Render Docker sirve frontend y API bajo HTTPS/origen único. PostgreSQL y Auth gestionados por Supabase. Java accede a Data API por HTTPS y RPC transaccional: evita añadir JDBC/pool/conectividad SQL en v1.
2. Frontend: módulo `auth.js`, SDK oficial supabase-js de versión fijada y distribución compatible con módulos sin build npm (decidir empaquetado local antes de implementar). Registro/login/password van directamente a Supabase; Java no almacena contraseñas. URL y publishable key públicas por configuración explícita allowlist, nunca volcar entorno completo.
3. Mantener almacenamiento de sala por pestaña; sesión de cuenta en almacenamiento separado, inicialmente sessionStorage para evitar cambios de cuenta entre pestañas que ya juegan. SDK renueva sesión; ninguna escritura directa de XP. Escape con dom.js; borrar tokens de callback de URL; no registrar credenciales, cabeceras ni cuerpos de Auth. Configurar callbacks de confirmación y recuperación compatibles con rutas estáticas reales.
4. Java verifica JWT de cuenta con biblioteca mantenida y JWKS de `SUPABASE_URL/auth/v1/.well-known/jwks.json`, firma/algoritmo permitido, issuer exacto, audience authenticated, expiración/not-before y sub UUID. Cache JWKS acotada, refresco controlado para kid desconocido y rotación; fallo de verificación deniega acceso, nunca decodificar sin verificar. Usar clave asimétrica en Supabase. La validación local no consulta revocación de sesión en cada request: token firmado puede servir hasta expiración. Documentar semántica de logout y borrado de cuenta.
5. Bearer de sala NO cambia: `Authorization: Bearer <playerToken>`. Para crear/unirse con cuenta, cabecera separada propuesta `X-Tesis-Account-Authorization: Bearer <accessToken>`; ausencia significa invitado, token presente inválido significa 401 (sin degradar silenciosamente). Para `/api/perfil` el Bearer es JWT Supabase, porque es otro ámbito. Mantener X-Tesis y validación de origen en mutaciones.
6. Identidad interna de asiento UUID diferente de cuenta UUID y token. Bind al crear/unirse desde sub verificado; no aceptar accountId del JSON. Cuenta opcional, vínculo inmutable para ese asiento; congelar participantes al iniciar y máximo un asiento por cuenta en una misma partida. Login posterior de invitado no reclama XP retroactivo. Cambiar perfil no cambia nombre del Jugador ni objetivos durante partida. Nombres visibles repetidos entre cuentas permitidos; colisiones dentro de sala conservan validación actual (elegir alias de sala).
7. La cuenta no recupera acceso a sala: sigue mandando quien posee el token de sala. Logout/cambio de cuenta no reasigna asiento ni premio; mostrar a qué cuenta quedó vinculado y mantener control de sala existente. No exponer UUID/correo/token de cuentas rivales en vistas. Expiración del JWT no bloquea una partida ya vinculada.
8. Nuevas clases sugeridas bajo `es.tesis.cuentas/` (verificador/configuración/perfil) y `es.tesis.progresion/` (resultado inmutable/repositorio/coordinador), sin crear arquitectura Spring. Inyección de interfaces/fakes en tests. Adaptación en web sin contaminar Jugador ni motor con Supabase.
9. GET perfil usa credenciales de usuario/publishable key hacia Data API y RLS propia. POST nombre acepta solo nombre validado (1–24 caracteres sin controles) y aplica PATCH de única columna con JWT propio. No aceptar contadores/IDs adicionales. Las llamadas administrativas de resultado usan cliente HTTP separado con secret key, nunca JWT de usuario mezclado.

## Modelo PostgreSQL y permisos propuestos

Nombres SQL convencionales; clases/métodos Java en español.

| Tabla | Claves y campos | Lectura/escritura |
| --- | --- | --- |
| `public.profiles` | `user_id UUID PK FK auth.users(id) ON DELETE CASCADE`; `display_name`; `xp BIGINT >=0`; `games_finished BIGINT >=0`; `wins BIGINT >=0 AND <=games_finished`; created_at/updated_at | RLS SELECT propio por auth.uid(); ningún SELECT anon. UPDATE solo columna display_name, USING/WITH CHECK user_id=auth.uid(); revocar INSERT/DELETE y UPDATE general a anon/authenticated. Contadores solo backend. |
| `private.matches` | `match_id UUID PK` aleatorio nuevo al iniciar, no código de sala; started_at/finished_at; status completed; reward_version; hash canónico del resultado | Sin acceso anon/authenticated ni exposición directa de esquema privado. Solo servicio vía función. En v1 se inserta al liquidar; no es checkpoint de partida activa. |
| `private.match_participants` | PK(match_id, seat_id UUID), FK match; user_id UUID nullable FK profiles ON DELETE SET NULL; alias de sala; prestigio final; is_winner; índice único parcial(match_id,user_id) WHERE user_id IS NOT NULL | Solo servicio; incluye invitados para consistencia del resultado. No correo, manos, roles ni eventos. |
| `private.reward_ledger` | PK(match_id,user_id); FKs match/profile; xp_awarded; is_winner; reward_version; awarded_at | Solo servicio. FK de perfil ON DELETE CASCADE: borrado elimina recibos personales, no habilita reenvío porque matches ya liquidada. No borrar matches al borrar cuenta. |

Nivel derivado de XP en DTO y/o columna generada/vista propia segura, NO contador mutable independiente. Comenzar sin leaderboard ni lectura pública de perfiles. Activar RLS en las cuatro tablas además de grants; tablas privadas sin políticas de usuario. Trigger mínimo sobre auth.users crea perfil con valores cero y nombre inicial válido/fallback, sin confiar en metadatos de XP; SECURITY DEFINER con search_path vacío y nombres cualificados. Probarlo: fallo de trigger puede bloquear registro. Crear perfil con datos recibidos del usuario nunca permite estadísticas iniciales.

RPC propuesta `public.registrar_resultado` SECURITY INVOKER, schema privado con USAGE/tablas otorgados solo a service_role. REVOKE EXECUTE a PUBLIC/anon/authenticated, GRANT EXECUTE solo service_role; revisar privilegios por defecto de nuevas funciones. RLS NO protege de una secret key: bypass; Java debe autorizar y suministrar resultados propios. No endpoint HTTP que permita invocar RPC con payload del navegador.

### Liquidación única, transaccional

- Bajo bloqueo de sala detectar FIN_PARTIDA y capturar una vez resultado mínimo inmutable directamente del motor y mapa asiento/cuenta; match UUID y reward_version fijados. Cubrir acción manual, avance automático en GET y carreras entre ambos.
- Encolar una única tarea por resultado en executor separado, acotado. Ningún HTTP a Supabase dentro del bloqueo de sala. Reintentos con backoff/jitter y timeout; mantener recibo pendiente separado de sala caducada mientras viva proceso, con límite y aviso de saturación. No reintentar acciones de juego.
- RPC en una transacción: insertar matches con UUID único y hash/version; insertar participantes, recibos y sumar XP/partidas/victorias solo por recibos nuevos. Perfil incrementado en SQL (`xp = xp + delta`), no read-modify-write Java. Orden fijo de bloqueos de perfiles para partidas simultáneas; retry de deadlock/transient con mismo UUID/payload.
- Dos RPC simultáneas del mismo match se serializan por unicidad/bloqueo. Si ya existe resultado completado igual, devolver recibo original sin sumar; hash/version distintos para mismo UUID => error, no sobrescribir. Hash sirve para consistencia, no para probar autoridad.
- SQL calcula XP según reward_version y is_winner de resultado del motor; valida 3–5 asientos, cuentas únicas, prestigio y conjunto de ganadores consistente con máximo. Java ya determina ganador; SQL verifica consistencia sin cambiar reglas.
- Registrar match, participantes, ledger e incrementos en la MISMA transacción. No patrón INSERT recibo, UPDATE contador en llamadas separadas. Respuesta perdida tras COMMIT => retry obtiene recibo. Si perfil fue borrado, omitir recompensa de esa cuenta y registrar participante sin vínculo; serializar con borrado, sin recrear cuentas. Fijar hash sobre resultado original inmutable; mantener tratamiento determinista de borrados.
- Estados privados de recompensa: invitado/no aplicable, pendiente, confirmada, error recuperable. Lectura por polling no adjudica XP; cualquier detección repetida solo asegura tarea del mismo resultado. DTO separado de revisión de juego (estado de progreso puede cambiar sin cambiar opciones ni revisión). Consulta de recibo propio por backend/JWT después de reinicio si existe match guardado; el UUID no otorga permisos de sala.

## Experiencia, nivel e invitados (propuestas pendientes de aceptación)

### Referencia aplazada: Google y Apple (2026-10-05)

El usuario pidió ambos proveedores y después decidió dejarlos por ahora. Quedan fuera de la primera versión; conservar esta referencia no autoriza implementación ni configuración OAuth. Si se retoman: frontend usaría signInWithOAuth de Supabase; Java seguiría verificando el JWT de Supabase, no tokens Google/Apple. Mantener mismo perfil y ledger por auth.users.id, nunca por correo/proveedor. OAuth no cambia vínculo inmutable del asiento. Cancelar autorización o fallar callback no crea acceso a sala. Proponer PKCE para OAuth en navegador con intercambio de código gestionado por SDK, redirect allowlist exacta y limpieza de URL; probar navegación de vuelta, pérdida del verifier y preservación de sessionStorage de sala.

Google: crear proyecto Google Cloud, configurar Google Auth Platform (Branding/Audience/Data Access), cliente OAuth Web application. Origen local http://localhost:8080 y futuro origen Render; redirect URI EXACTA copiada de proveedor Google de Supabase, normalmente https://<ref>.supabase.co/auth/v1/callback. No confundir callback Google->Supabase con redirect Supabase->Tesis. Scopes mínimos openid/email/profile, usuarios de prueba si app en modo testing. Client ID/Secret en panel de proveedor Supabase; secreto nunca chat, repo, frontend ni Render para este flujo gestionado.

Apple: requiere configuración Apple Developer, App ID con Sign in with Apple, Services ID web, Team ID y Key ID/clave .p8. Website domain de Supabase y return URL exacta /auth/v1/callback. Generar client secret mediante herramienta oficial enlazada por Supabase y guardarlo en proveedor Apple; preservar .p8 en almacenamiento privado. El secreto OAuth web requiere renovación como máximo cada seis meses; documentar operación/fecha, sin crear recordatorio automático sin petición. Verificar elegibilidad/coste de membresía con Apple antes de afirmar que todo el sistema es gratuito. No habilitar proveedor sin completar credenciales.

Supabase vincula automáticamente identidades con mismo correo según su política de verificación; NO fusionar perfiles en Java por dirección. Apple Hide My Email puede producir usuario diferente del acceso Google/email: no prometer progreso compartido entre correos distintos. V1 avisa y permite elegir nombre visible si proveedor no lo aporta; interfaz de vinculación manual/fusión queda pendiente fuera de alcance. QA adicional: misma cuenta por email/Google no duplica perfil/premios, Apple con relay mantiene perfil propio, cancelaciones y callback inválido fallan seguros, ningún token de proveedor se almacena en tablas/logs, secret Apple expirado se comunica como fallo del proveedor.

Fuentes: https://supabase.com/docs/guides/auth/social-login/auth-google ; https://supabase.com/docs/guides/auth/social-login/auth-apple ; https://supabase.com/docs/guides/auth/auth-identity-linking .

- Finalizar normalmente: 100 XP y +1 partida terminada para cada cuenta vinculada.
- Victoria según Partida.ganadores(): +50 XP y +1 victoria. Empate de prestigio máximo: cada ganador recibe 150 XP completos y una victoria; los demás 100. No repartir bonus ni inventar desempate. Incluye empate de todos si el motor lo devuelve.
- Abandono/caducidad/reinicio sin resultado persistido: 0 XP, sin contador. Desconexión temporal no descalifica; si partida acaba y su asiento sigue vinculado, cobra aunque no esté conectado. V1 no prueba actividad humana ni evita colusión/multicuenta.
- Nivel `1 + floor(xp / 500)`; umbrales 0, 500, 1000, 1500...; XP al siguiente nivel `500 - (xp mod 500)`. Todo cosmético; ningún dato de perfil influye en reglas o acciones.
- Mantener invitados reales sin Supabase anonymous sign-in: juego disponible sin cuenta, sin progreso/registro retrospectivo. Mostrar antes de entrar: cuenta guarda progreso, invitado no. Salas mixtas permitidas, sin excluir ganador invitado del cálculo del motor.

## Fallos y garantías explícitas

- Supabase caído: registro/login/perfil pueden fallar; JWT ya verificable con JWKS cache válida permite vínculo, pero si no puede verificarse no vincular. Partidas actuales siguen por token de sala. Invitados siguen disponibles. Resultado motor no se revierte ni se vuelve a jugar por fallo de progreso.
- Supabase falla al liquidar: mostrar pendiente, retry del servidor mientras exista resultado en memoria. No mostrar XP como confirmada antes de COMMIT. Al recuperarse, operación única. No bloquear juego durante caída.
- Render reinicia: pierde salas, tokens y resultados que aún solo estaban en memoria. Cuentas y transacciones ya confirmadas sobreviven en Supabase; no hay recuperación por nombre/login. Si COMMIT ocurrió aunque respuesta se perdió, progreso sigue guardado.
- Si muere proceso ANTES del COMMIT y resultado no está persistido, recompensa pendiente puede perderse definitivamente. Esto es una limitación aceptable SOLO si se aprueba para v1. At-most-once por recibo persistente NO equivale a entrega garantizada. Guardar cola en fichero Render no soluciona nada.
- Para garantía sin pérdida tras reinicio/caída, ampliar alcance con estado autoritativo/checkpoints y outbox durables, persistencia previa al acuse y recuperación; si única base de datos cae, requiere bloquear avance relevante o segundo almacenamiento durable. No prometer garantía durante indisponibilidad total con solo memoria. Persistencia de salas es otro proyecto con revisión de secretos/instantáneas.
- Render Free: spin-down tras 15 min sin tráfico entrante, arranque aproximadamente 1 min, reinicios posibles en cualquier momento y disco efímero sin persistent disk gratuito. 750 h/mes por workspace. Timeout actual 12 s no cubre arranque frío; introducir feedback y retry SOLO consultas, nunca mutaciones ambiguas. No pings artificiales para eludir suspensión.
- Supabase Free puede pausar proyecto de baja actividad en 7 días. SMTP por defecto solo direcciones de equipo autorizado, actualmente 2 correos/h; registro público confirmado necesita SMTP propio. No desactivar confirmación para evitar configurar correo.

## Configuración guiada (sin ejecutar servicios ni pedir secretos)

1. Crear proyecto Supabase Free desde dashboard; elegir región europea cercana a Render y guardar contraseña de DB en gestor de contraseñas. No compartir por chat. URL/keys desde Connect o Settings > API Keys.
2. Auth: email/password activo y confirmación email activa; mínimo 6 caracteres solicitado posteriormente por el usuario (ver registro remoto de aplicación pendiente). Signing Keys: asimétrica (p. ej. ES256); backend usa JWKS público, no JWT secret.
3. Auth URL Configuration: Site URL `http://localhost:8080` para fase local. Allowlist exacta de callback acordado (propuesta `http://localhost:8080/` con query de flujo de confirmación/recuperación) y futuro `https://<servicio>.onrender.com/`. Al publicar cambiar Site URL a HTTPS, conservar localhost solo si hace falta. Evitar comodín abierto; ajustar plantillas/flow al SDK y comprobar confirmación/password reset en mismo y otro navegador antes de release.
4. SMTP: configurar proveedor compatible en Authentication > Emails > SMTP Settings (host/puerto/usuario/contraseña/remitente); verificar remitente/dominio según proveedor. Secretos solo en dashboard Supabase. Revisar límites del proveedor; coste cero no está garantizado por elegir Render/Supabase gratis. Sin SMTP propio hacer únicamente pruebas con destinatarios de equipo, no lanzamiento público.
5. Schema: NO crear tablas manuales todavía. Después de aprobar diseño, revisar y aplicar migración versionada por SQL Editor o CLI; verificar RLS/grants/funciones antes de conectar UI. CLI opcional, no requisito del runtime. Separar proyecto de pruebas si es posible; pruebas de RLS con anon y dos usuarios reales, no solo secret key.
6. API Keys: obtener publishable key y crear secret key dedicada al backend. Guardar última directamente en entorno privado Render; jamás chat, repo, HTML, logs, Docker ARG/ENV de build o captura. No requiere contraseña SQL, connection string ni clave privada de firma para arquitectura REST.
7. Render futuro: New > Web Service, repositorio/rama release/v2.0.0 cuando publicada por autorización, runtime Docker, Dockerfile raíz, plan Free, región cercana. Un servicio contiene Java y estáticos. Auto-deploy desactivado para controlar publicación. No pulsar Create Web Service ahora: inicia despliegue. Preparar variables y configuración hasta autorización futura.
8. Variables abajo; HOST 0.0.0.0, PORT de Render (habitualmente 10000), PUBLIC_ORIGIN HTTPS exacto sin slash final. Endpoint de salud propuesto `/api/health` sin credenciales que mida proceso, no dependa de Supabase para reiniciar aplicación durante caída. Configurar cuando exista, no usar ruta inexistente ahora.
9. Tras autorización y deployment: completar Site URL/redirects con dominio real, probar HTTPS, origen tras proxy, callback, RLS, partida completa, ledger, reinicio y progreso. No hacer estos pasos remotos en fase de diseño.

| Variable | Exposición | Estado/uso |
| --- | --- | --- |
| `HOST=0.0.0.0` | Config servidor | Ya consumida |
| `PORT` | Config servidor | Ya consumida; usar valor Render |
| `PUBLIC_ORIGIN=https://<servicio>.onrender.com` | Pública | Ya consumida; origen local para pruebas |
| `SUPABASE_URL=https://<ref>.supabase.co` | Pública | Propuesta; Auth, JWKS y REST |
| `SUPABASE_PUBLISHABLE_KEY` | Pública | Propuesta; Auth y lecturas usuario |
| `SUPABASE_SECRET_KEY` | Solo servidor | Propuesta; RPC recompensas; no Bearer JWT |

SDK/cliente implementarán cabeceras según Data API actual (secret key en apikey, no tratar sb_secret como JWT). No son variables nuevas ya soportadas. Umbrales XP/version se fijan en política versionada, no variables editables que cambien liquidaciones pendientes. Para local usar entorno de proceso/archivo ignorado tras añadir ignore; no pegar comandos que impriman claves. HEALTH/times de red/cola internos acotados, decidir valores al implementar.

## Áreas afectadas y división útil de trabajo futuro

Sin subagentes en fase de análisis: inspección y decisiones acopladas al contrato; Lead secuencial. No desplegar roles por defecto.

| Responsable | Área exclusiva | Dependencias | Aceptación |
| --- | --- | --- | --- |
| Lead/backend (primer bloque) | `web/ServidorWeb.java`, `SalaJuego.java`, `GestorSalas.java`, `SesionJuego.java`, `Vistas.java`; nuevas `cuentas/`, `progresion/`; `pom.xml`; `supabase/migrations/` | Fijar contratos de DTO/API, UUID asiento/partida, estado de premio y fallos | Tokens separados, cierre único, RLS/RPC y tests Java/SQL |
| Frontend (como máximo un especialista opcional) | `static/index.html`, CSS, `js/auth.js`, `api.js`, `app.js`, módulos de perfil y tests JS | Solo después de contrato acordado; no editar Java/SQL/pom | Auth, perfil, invitados, estado pendiente, polling y escape preservados |
| Lead infraestructura | Dockerfile, .gitignore, .env.example, README/guía, versión | Serializar pom con backend; posterior al empaquetado | Arranque reproducible y configuración documentada, sin deployment |
| QA/review (posteriores, Lead o un especialista) | Pruebas/inspección del resultado combinado | Implementación integrada; no escribir áreas aún activas | Evidencia de carreras, privacidad, RLS y fallos; diff revisado |

## Plan de implementación

- [x] Inspeccionar estado Git/ramas y crear release/v2.0.0 autorizada.
- [x] Leer skills relevantes; inspeccionar arquitectura, finalización, tests y Docker.
- [x] Consultar documentación oficial actual; formular diseño y limitaciones.
- [x] Guardar y revisar ExecPlan sin cambios funcionales.
- [x] Recibir indicación del usuario; se mantiene límite explícito de pérdida de pendientes al reiniciar.
- [x] Definir contratos/DTOs y criterios de error; tests de comportamiento nuevos.
- [x] Migración versionada, trigger perfil, grants/RLS y RPC transaccional; ejecutada en PostgreSQL WASM local. Aplicación Supabase remota pendiente.
- [x] Backend JWT/JWKS, perfiles, cuenta al entrar, captura manual/GET, cola/retry y recibos; clocks/transports inyectables.
- [x] Frontend Auth/perfil/invitados, renovación y progreso con misma revisión, sin cambiar decisiones de partida. SDK oficial local 2.57.4.
- [x] Docker runtime Java17 directo, health, versión 2.0.0, guía y .env.example sin claves.
- [x] QA local Java/Node/PostgreSQL WASM y navegador acotado; fallos de red/timeout y cierre concurrente comprobados. Alcances no ejecutados registrados abajo.
- [x] Revisar diff combinado incluyendo nuevos archivos; actualizar plan/evidencia. No commit/push/merge/deploy.
- [ ] Configurar/aplicar y validar Supabase real, dos conexiones PostgreSQL, Docker y QA general de navegador pendiente. Requiere preparación de servicios y publicación por separado; no es evidencia ya obtenida.

## Criterios de aceptación y pruebas futuras

- Misma partida/usuario: un recibo y un incremento aun con 100 reintentos, polling concurrente, refresh y respuesta perdida; payload distinto mismo UUID rechazado. Dos partidas diferentes misma cuenta suman sin perder actualizaciones. Rollback forzado a mitad no deja recibos/contadores parciales.
- JWT falso/expirado/issuer/audience/algoritmo incorrecto denegado; JWKS rotation/kid nuevo/caída probados. AccountId JSON no vincula; token sala no accede a perfil; JWT no actúa en sala. Cuenta duplicada en sala denegada antes del inicio; logout/cambio de cuenta y refresh conservan vínculo.
- Finalización manual/GET simultáneo con reloj controlado da un resultado. Ganadores derivados del motor por referencias de Jugador y mapa de asientos, sin parsear evento; empate doble/todos, invitado ganador, cuenta desconectada, invitado sin premio, partida abortada sin premio.
- RLS real: anon y usuario B no leen/modifican perfil A; propio nombre editable; XP/contadores/user_id no editables ni por PATCH, INSERT, upsert ni RPC. RPC resultado prohibida a PUBLIC/anon/authenticated. Tablas privadas inaccesibles. Trigger ignora estadísticas manipuladas; borrado concurrente consistente.
- Privacidad JSON entre 3/4/5 jugadores: manos/roles/vetos/eventos ajenos igual que antes; ningún correo, UUID de cuenta ni token ajeno. Ledger guarda solo resultado mínimo.
- Supabase timeout antes/después de COMMIT; retries backoff acotados sin bloquear otras salas; saturación visible; sala caducada no elimina recibo pendiente; reinicio demuestra distinción confirmada/perdida y ninguna adjudicación desde cliente.
- Frontend Node: ampliar contratos Auth/perfil y generaciones; mantener cuatro suites actuales. Navegador: registro, confirmación en otro dispositivo, login, password reset, logout, expiración, nombres con HTML escapado, teclado/móvil, salas mixtas, cold start y finalización.
- Comandos de implementación: `mvn test`; cuatro `tests/*.test.mjs` con `node --experimental-vm-modules`; `mvn -DskipTests package`; build/arranque Docker cuando disponible; QA multiplayer `tools/qa_multiplayer.mjs` con prerrequisitos existentes. Test SQL/RLS de integración en proyecto de pruebas; no aceptar fakes como evidencia transaccional real.

## Evidencia de esta fase y revisión

Análisis estático/manual de las clases y scripts mencionados, inventario de JUnit y cuatro suites Node; inspeccionados SalasTest (privacidad, concurrencia, avance automático, partidas completas) y SesionJuegoTest (fin y ganadores). Leídas skills backend/frontend para contratos, QA para plan de validación, review para revisión documental. NO ejecutadas suites ni navegador, Docker ni integración Supabase: no hay implementación que validar. No afirmaciones de tests pasados.

Revisión documental: motor sigue como autoridad; JWT y sala separados; clave privilegiada solo backend; unicidad persistente y transacción, no revisión de sala como deduplicación durable; los dos caminos de cierre cubiertos; límites de pérdida explícitos; configuración SMTP/cold start incluida. Ningún cambio funcional. Revisión de implementación aún pendiente.

Riesgos/decisiones pendientes: aceptar límite de recompensas pendientes tras reinicio; abuso de partidas para cultivar XP (sin impacto en balance); dependencia SMTP para registro público; sesión JWT local hasta expiración; costes/límites free sujetos a servicios; SDK empaquetado y presupuesto memoria JVM/Render a validar. Recuperación de partidas exigiría otro alcance, no se añade silenciosamente.

## Implementación local y evidencia actual (2026-10-05)

Contrato integrado: `GET /api/cuentas/config` publica habilitado/URL/publishableKey; `GET/POST /api/perfil` usa JWT de cuenta y solo permite renombrar. Crear/unirse usa `X-Tesis-Account-Authorization`, mientras Authorization de salas sigue siendo el token propio. `Sala.progreso` presenta INVITADO/VINCULADA/PENDIENTE/CONFIRMADA/ERROR y cambia sin incrementar revisión de juego. Captura una vez FIN_PARTIDA usando referencias de Jugador; no interpreta nombres de eventos ni entradas de navegador. La política es 100 XP + 50 por ganar, nivel cada 500, empate para todos los máximos.

División real realizada sin escritores compartidos: Lead en web/progresión, Docker, ignore, documentación y pruebas HTTP/cierre; especialista cuentas en paquete cuentas, sus tests y pom (posteriormente cedido al Lead); especialista SQL en supabase/; especialista frontend en static/ y tests Node. El especialista frontend pasó después a revisión combinada de solo lectura. QA/review usan las skills relevantes, sin crear un equipo de cuatro roles permanente.

Evidencia automatizada:

- `mvn test` completo y empaquetado `mvn package`: **176 tests, 0 fallos, 0 errores** en la ejecución final. Recuento de XML actuales; descartado el XML antiguo BalanceMesaTest del 24/09, ajeno a esta ejecución. El primer intento sandbox tuvo errores de permisos/loopback; la suite íntegra escalada pasó sin cambiar las pruebas para ocultarlos.
- Seis suites Node pasan: las cuatro anteriores más accounts y progress_polling. Restauración lenta de Auth no crea invitados accidentalmente; fallback explícito borra solo cuenta, conserva sala; recibo misma revisión no repite efectos.
- `node supabase/tests/run-pglite.mjs`: PASS con PostgreSQL WASM/PGlite 0.5.8 local: migración, trigger, RLS, edición de nombre, prohibición de XP/RPC, empates, invitados, reintentos, resultado contradictorio y rollback. No conectar esta evidencia a Supabase Auth/PostgREST ni a concurrencia entre dos conexiones.
- Nuevos JUnit: JWT firma ES256/RS256, issuer/audience/exp/nbf/UUID, JWKS cache/kid desconocido/caída, timeout incluso después de headers, cuerpo excesivo, claves privilegiadas segregadas, HTTP perfil/sala, suplantaciones, cuentas duplicadas por valor UUID, fin manual/GET, 64 consultas simultáneas, recibo sin nueva revisión, reintento ambiguo mismo UUID/hash. Dos perfiles HTTP bloqueados dejan disponibles salas y rechazan otro perfil con 503.
- Build/runtime: paquete tesis-2.0.0.jar y dependencias runtime generados; Java directo `java -cp target/classes;target/lib/* es.tesis.web.ServidorWeb 8091` arrancó y atendió QA local. Servidor de prueba detenido al terminar. Docker no disponible: no afirmar que se construyó la imagen.

QA navegador dirigida con Chrome/Playwright ya instalados: tres invitados reales, lobby/tabla a 1440×900 y 390×844, registro mínimo6/rechazo5, máximo nombre24, Escape y fallback preservando sala. Auth se simula/intercepta para esta QA; no hubo llamadas reales de registro. Sin errores JavaScript. Capturas revisadas en target/qa-cuentas, ignorado por Git; contraste del diálogo corregido y vuelto a comprobar.

`tools/qa_multiplayer.mjs` (3 jugadores, modo rápido) quedó incompleto: su clic de Ver personajes en línea71 fue interceptado por el diálogo de selección ya abierto. No se cambió el script ni se atribuye el fallo a este diff sin comparación baseline. Partidas completas 3/5 por HTTP y motor sí pasan en JUnit; la partida completa mediante UI de ese script no se certifica.

Revisión combinada encontró dos problemas relevantes y se corrigieron: carrera de restauración Auth al entrar y ocupación de los cuatro trabajadores HTTP por Supabase lento. Pruebas nuevas confirman ambos. Revisados nuevos archivos, límite de respuesta HTTP durante recepción, licencias/hash SDK y ausencia de archivos generados/secretos. Motor/reglas/dominio/acciones/habilidades no modificados; solo adaptador web observa el fin.

Pendientes para validación remota/publicación: Confirm email Off guardado por el usuario no está comprobado; verificar clave actual ES256/RS256, aplicar migración, introducir claves directamente en entorno/Render y probar Auth/PostgREST real y dos transacciones concurrentes. Supabase y Render no se modificaron durante implementación. Google/Apple, SMTP, recuperación de cuenta/partida, borrado de cuenta durante entrega y durabilidad de resultados pendientes tras reinicio permanecen fuera del alcance.

## Fuentes oficiales consultadas (2026-10-05)

- Supabase Auth passwords: https://supabase.com/docs/guides/auth/passwords
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Redirects: https://supabase.com/docs/guides/auth/redirect-urls
- Signing keys/JWKS: https://supabase.com/docs/guides/auth/signing-keys
- API keys: https://supabase.com/docs/guides/getting-started/api-keys
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Functions/EXECUTE: https://supabase.com/docs/guides/database/functions
- Production/Free pausa: https://supabase.com/docs/guides/deployment/going-into-prod
- Render Free: https://render.com/docs/free
- Render Docker: https://render.com/docs/docker
- Render web services/puerto: https://render.com/docs/web-services

## Estado

Implementación local terminada y revisada; validación de servicios reales y publicación pendientes. No commit, push, merge ni despliegue. El servicio Render anterior al cambio sigue intacto; el nuevo `tesis` aún sirve el código previo. Guía operativa: `docs/CUENTAS_SUPABASE_RENDER.md`.

### Preparación remota autorizada posteriormente (2026-10-05)

El usuario abrió Supabase y autorizó configurar el servicio; luego pidió expresamente crear un Render nuevo llamado `tesis`. Esta autorización permite la publicación base del código existente, NO implementar cuentas ni hacer commit/push/merge. Se preserva release/v2.0.0 local y el único archivo seguido nuevo es este plan. No se cambió el servicio Render anterior.

- Supabase proyecto `ncvyaxhfbcknviznucii`, Healthy, West EU/Ireland; GitHub ya conectado por el usuario. Email y Confirm email estaban activos; Google/Apple y anonymous sign-ins desactivados. Custom SMTP comprobado desactivado: queda pendiente elegir/configurar proveedor sin enviar secretos por chat.
- Nuevo Render Web Service `tesis`, ID `srv-db1dp89srm7s73b7g44g`, Docker, Frankfurt, Free ($0/mes compute), fuente main commit a8f22dc; release/v2.0.0 aún no publicada. Auto-Deploy Off. Health check existente `/api/config`. Dominio asignado `https://tesis-dm5l.onrender.com` (sufijo generado por Render). PUBLIC_ORIGIN configurado a ese dominio; se solicitó rebuild/deploy de configuración. No se añadieron claves Supabase, puesto que código actual no las consume.
- Site URL Supabase guardada `https://tesis-dm5l.onrender.com`; allowlist exacta `https://tesis-dm5l.onrender.com/` y `http://localhost:8080/`. La URL del Render anterior añadida durante inspección fue retirada por corrección del usuario. El usuario pidió conservar producción y local.
- Contraseña mínima: 6 caracteres guardados tras confirmación explícita del usuario; comprobado reabriendo Email (Save deshabilitado y campo 6 en evidencia visual). El usuario decide no configurar SMTP propio y pide desactivar Confirm email. Toggle preparado en UI sin guardar; pendiente de confirmación de acción por política del navegador al reducir protección de autenticación. No afirmar que confirmación está desactivada remotamente hasta guardar/verificar.
- Verificación actual: las dos publicaciones Render completadas; la última con PUBLIC_ORIGIN, deploy dep-db1dpt1mgk9c73d98mhg, identificada Live. Homepage responde por HTTPS y muestra Tesis. Prueba manual de creación de una sala con un único participante ficticio `Prueba Render` completada; valida estáticos y POST desde origen HTTPS, no partida completa. Auto-Deploy Off comprobado en ajustes. No hay Auth integrado ni pruebas de login/registro/progresión. Evidencias de UI en target/supabase-config (ignorado por Git); no contienen claves.

Siguiente paso de configuración: confirmar guardado de Confirm email desactivado. SMTP propio queda excluido por decisión del usuario. Con autoconfirmación, una dirección no prueba propiedad del correo; backend debe identificar cuentas por sub verificado, no por confiar en propiedad del email. No prometer recuperación de contraseña pública por correo: sigue sujeta a restricciones del SMTP predeterminado. Ajustar alcance de recuperación en implementación y feedback sin inventar mecanismo alternativo. La implementación funcional fue autorizada posteriormente y completada localmente; consultar el estado de implementación actual arriba. Los pasos anteriores de configuración son referencia histórica; dominio real, mínimo 6 y decisiones de este apartado prevalecen sobre recomendaciones anteriores.


### Migración remota aplicada con confirmación (2026-10-05)

El usuario confirmó explícitamente aplicar la migración en Tesis ncvyaxhfbcknviznucii. SQL Editor ejecutó 202610050001_cuentas_progresion.sql y devolvió Success. No rows returned. Se comprobó existencia de profiles, matches, match_participants y reward_ledger, las cuatro con RLS=true. Permisos reales: anon_rpc=false, usuario_rpc=false, backend_rpc=true, usuario_edita_xp=false, usuario_edita_nombre=true, usuario_accede_private=false. Confirm email ya estaba guardado Off; mínimo6 y clave actual ECC P-256 verificados sin modificar Auth. Evidencias en target/supabase-config/migracion-aplicada.jpg y rls-verificado.jpg, ignoradas. Consulta de migración guardada en SQL Editor; no repetir migración. No hubo secretos, commit, push, merge ni deploy. Pendientes: claves Render, Auth/PostgREST funcional, concurrencia con dos conexiones y publicación autorizada.


### Publicación autorizada (2026-10-05)

Variables SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY guardadas por el usuario en Render; presencia confirmada sin revelar valores. El usuario autoriza commit y push de release/v2.0.0 y merge a main para desplegar desde main. Se usa remoto personal (faliideusto/Ciudadela-Academica), conectado a Render; no publicar al origin ajeno Alvarogm15/Ciudadelas. Se actualizan referencias antes de integrar; no force push. Validación anterior final: 176 JUnit/6 suites Node/SQL PGlite y QA navegador dirigida; no cambios funcionales desde entonces. Pendiente despliegue y comprobación de producción, sin prometer Auth real probado hasta hacerlo.

El usuario solicita además Auto-Deploy en Render tras cada push a main. Se activará para el servicio tesis manteniendo main como fuente y se verificará publicación del commit integrado.
