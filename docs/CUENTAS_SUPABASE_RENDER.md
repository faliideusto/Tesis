# Cuentas y progresión en Tesis 2.0.0

Estado remoto comprobado el 2026-10-05: migración aplicada con confirmación del usuario en el proyecto Tesis; cuatro tablas con RLS y permisos de RPC/columnas verificados. No volver a ejecutar la migración manualmente. Confirm email Off, mínimo 6 y firma actual ECC P-256 comprobados. Las tres variables Supabase aparecen guardadas en Render con valores ocultos; su validez funcional Auth/PostgREST sigue pendiente. El usuario autorizó publicar la release, integrarla en main y desplegar desde main.

El frontend y el backend Java se sirven desde un único origen. Supabase gestiona correo/contraseña y PostgreSQL; Java verifica JWT ES256/RS256 con JWKS antes de vincular una cuenta al asiento. El token de sala continúa siendo la única identidad para jugar. El navegador no recibe la clave secreta ni dispone de una ruta para declarar resultados.

## Preparar Supabase

1. Usar el proyecto Tesis `ncvyaxhfbcknviznucii` ya creado. Mantener habilitada Data API; **no exponer `private`**. Desactivar exposición automática de tablas nuevas si estuviera activada. La migración aplica RLS y permisos explícitos.
2. En Authentication → Sign In / Providers, Email y nuevos registros habilitados, mínimo **6** caracteres y **Confirm email desactivado**, según la decisión del proyecto y verificados en el panel. Google, Apple y anonymous sign-ins quedan desactivados.
3. No configurar SMTP propio. La primera versión no ofrece recuperación pública por correo ni acredita la propiedad de la dirección. El identificador fiable es el UUID `sub` del JWT verificado.
4. En URL Configuration, Site URL `https://tesis-dm5l.onrender.com`; redirects exactos `https://tesis-dm5l.onrender.com/` y `http://localhost:8080/`. Email/password con autoconfirmación no requiere una redirección de verificación. Las opciones permanecen preparadas para uso futuro.
5. En JWT Signing Keys, comprobar que la clave **actual** usa ES256 o RS256. Una clave standby no basta. El backend rechaza HS256 y nunca necesita el JWT secret. Si el proyecto todavía usa la clave legacy, migrar a una clave asimétrica desde el panel siguiendo la documentación oficial; después volver a iniciar sesión.
6. Aplicar una vez `supabase/migrations/202610050001_cuentas_progresion.sql` con SQL Editor o CLI, primero en un proyecto de pruebas. Es una migración versionada, no un script que se ejecuta en cada arranque. Crea perfiles incluso para cuentas anteriores. No conectar migraciones automáticas de GitHub sin decidir expresamente cuándo publicarlas.
7. Ejecutar `supabase/tests/cuentas_progresion.sql` **solo en un proyecto de pruebas** como propietario. Verifica trigger, permisos, empate, reintento, rollback y RLS; termina con rollback. No reemplaza la prueba concurrente con dos conexiones.
8. En Project Settings → API Keys, localizar Project URL, publishable key y secret key. Introducir las claves directamente en el entorno local/Render; no pegarlas en conversaciones, commits, capturas ni JavaScript. La publishable key es pública; la secret key solo se consume en Java.

## Render preparado, publicación pendiente

Ya existe el nuevo Web Service `tesis`, Free, Docker, Frankfurt, URL `https://tesis-dm5l.onrender.com`, Auto-Deploy **Off** y health `/api/config`. Actualmente sirve el código anterior desde `main`. Crear archivos locales no cambia ese servicio.

Cuando se autoricen por separado publicación y despliegue, seleccionar la revisión aprobada de `release/v2.0.0` y añadir en **Environment**:

| Variable | Valor / visibilidad |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `PORT` | Render lo proporciona; Docker usa 10000 por defecto |
| `PUBLIC_ORIGIN` | `https://tesis-dm5l.onrender.com` |
| `SUPABASE_URL` | `https://ncvyaxhfbcknviznucii.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública `sb_publishable_…`; API de configuración pública |
| `SUPABASE_SECRET_KEY` | Secreto `sb_secret_…`, solo backend; no sale en DTO ni errores |

Las tres variables Supabase ausentes permiten jugar como invitado. Una configuración parcial impide arrancar para evitar una instalación engañosa. `.env.example` es referencia: Java **no** carga `.env` automáticamente. Para desarrollo, configurar las variables mediante el IDE o el entorno de la terminal sin imprimir secretos. No hace falta contraseña PostgreSQL ni conexión JDBC. Las claves legacy anon/service_role son compatibles para la Data API, pero se recomiendan las nuevas claves; la firma del JWT de usuario debe seguir siendo asimétrica.

El Dockerfile compila y copia dependencias en build; el contenedor final ejecuta Java17 JRE directamente, sin Maven ni descarga de dependencias al arrancar. No se ha construido con Docker en esta máquina si no está instalado.

## Progreso y límites de la primera versión

- Cada cuenta vinculada recibe 200 XP por terminar y 100 adicionales si gana. El motor desempata el máximo prestigio por monedas y después por cartas en mano; solo quienes sigan empatados comparten la victoria y los 100 XP. Invitados y partidas abandonadas no generan XP.
- Nivel = `1 + floor(XP / 500)`. No altera cartas, costes, turnos ni ventajas. Nombre del perfil editable; el nombre y la cuenta del asiento actual permanecen fijados al entrar. No se recupera un token de sala mediante correo o nombre.
- Se captura una sola vez un resultado mínimo con UUID propio, asientos, prestigio y ganadores. La transacción guarda partida, recibos únicos `(partida, cuenta)` y contadores conjuntamente. Los reintentos mantienen UUID/hash y no vuelven a adjudicar XP.
- Supabase temporalmente indisponible: la partida continúa; dos trabajadores independientes reintentan resultados con espera creciente hasta 60 segundos y variación pequeña. Como máximo 4096 resultados pendientes por proceso. Las consultas de cuenta tienen límite de concurrencia dos, reservando trabajadores HTTP para salas.
- `PENDIENTE` significa que aún no hay confirmación; `CONFIRMADA`, que el backend recibió éxito de la transacción; `ERROR`, que hacen falta intervención/diagnóstico (rechazo permanente o saturación), sin prometer recuperación automática. Si Supabase confirmó pero se perdió la respuesta, repetir el mismo resultado es seguro.
- Render puede reiniciar o suspender la instancia gratuita. Salas, identidades y resultados todavía pendientes viven en memoria y pueden perderse. **Perfiles y XP ya confirmados permanecen en PostgreSQL**. No se promete reanudar una partida ni liquidar un resultado perdido antes de guardarlo. Una sala que caduca sin reinicio no elimina el reintento pendiente.
- Cerrar sesión conserva la sala y su vínculo original. Iniciar sesión después de entrar como invitado no reclama experiencia pasada. Sesiones Auth viven en `sessionStorage` de la pestaña y se renuevan mediante el SDK oficial. La validación local de un JWT permite su uso hasta caducidad y caché JWKS; no es revocación instantánea.

## Validación tras configurar y antes de publicar

Probar registro con seis caracteres, inicio/cierre/renovación de sesión, edición del nombre, reload, sala con cuentas e invitados, cierre manual y automático, empate, polling paralelo y caída temporal. Comprobar que el perfil aumenta una vez y que usuario B/anon no pueden consultar A ni escribir XP o ejecutar RPC. Ensayar dos partidas simultáneas con cuentas comunes usando dos conexiones PostgreSQL. Revisar errores del navegador y tamaño móvil. No usar cuentas reales ni claves en fixtures.

Fuentes verificadas: [Signing keys/JWKS](https://supabase.com/docs/guides/auth/signing-keys), [claves API](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones y permisos](https://supabase.com/docs/guides/database/functions), [SMTP predeterminado](https://supabase.com/docs/guides/auth/auth-smtp), [Render Free](https://render.com/docs/free), [Docker en Render](https://render.com/docs/docker). XP, nivel, invitados y la política de fallos son decisiones de Tesis; los límites de los servicios dependen de sus planes actuales.
