# Ranking de referencia y temporadas mensuales

## Objetivo
Reproducir la referencia del usuario con cinco tarjetas, filtros, podio 2/1/3, tabla con rango y perfil accesible, y tarjeta lateral de progreso. Clasificaciones Global, Amigos, Semanal y Temporada; temporada termina al finalizar el mes natural Europe/Madrid y nueva ventana inicia automáticamente.

## Contexto y fuente de verdad
main limpio en 7ff322c. Frontend vanilla, community-panel.js ranking actual básico. Estadísticas vitalicias profiles; resultados reales private.matches/match_participants/reward_ledger y mission_claims. No modificar motor, XP autoritativo o datos de perfil; ningún reinicio destructivo. Referencia estética no prescribe estadísticas incoherentes ni identidades inventadas.

## Contrato
GET /api/ranking?criterio=xp&ambito=global. Criterio xp/victorias/partidas; ambito global/amigos/semanal/temporada, defaults y antigua query soportados. RPC nueva ranking_periodo(text,text); legacy ranking(text) conservada. DTO {criterio,ambito,entradas,propia,periodo:null|{id,inicio,fin,zonaHoraria}}. Entrada mantiene posicion,codigo,nombre,nivel,xp,victorias,partidas,yo; nivel vitalicio. Propia se devuelve fuera top50. Periodos [inicio,fin), no futuros; Madrid mes1→siguiente1 y lunes→siguientelunes. XP período ledger y misiones por fecha, victorias/partidas resultados. Amigos sólo aceptados+actor; no UUID/correo/token.

## Equipo y áreas
Backend: CuentasSupabase/ServidorWeb, migración004, SQL/JUnit/run-pglite/README. Frontend: community-panel.js/nuevo ranking-panel.js/ranking.css/testsranking. QA: tools/qa_ranking_reference.mjs y evidencias después integración. Lead: auth.js/index.html/demo/assetgenerado/plan, integración y revisión, activación Supabase autorizada en contexto.

## Pasos
- [x] Inspección y contrato.
- [x] Backend temporadas, validación SQL/HTTP.
- [x] Diseño fiel con assets propios y nuevos necesarios.
- [x] Integración y QA desktop/móvil/teclado/errores.
- [x] Revisión combinada y Supabase.

## Aceptación y pruebas
Tabla/podio datos reales y empates veraces; perfil clickable; progreso total preservado al cambiar ámbito; cero/1/2/muchos participantes y propia fuera50. Cambio de filtro/orden/refresh conserva estado ante fallos, generaciones y foco; no overflow ni badges desproporcionados en desktop1672x941 o móvil390/360. Maven/Node/PGlite y QA navegador; mes31/diciembre/bisiesto/DST de Madrid, privacidad y amistades. No nuevos framework, commits, push o despliegue sin petición vigente para esta tarea.

## Estado
Terminado. 203 pruebas Maven pasan (responsable backend, stdout BUILD SUCCESS), seis migraciones/suites PGlite pasan, 14 suites Node pasan (Lead y QA). Chrome real con API/Auth simulados: 14 capturas y escenarios en target/qa-ranking-reference, desktop1672/1680 y móvil390/360, vacíos/1/2/50, puesto propio72 fuera lista, empates, scopes/criterios/fallo/foco/modal/GET tardío/logout. Cambio semanal con reloj de navegador y recuperación al volver visible comprobado; fechas mensuales de Madrid verificadas. Tabla de50 contenida en285px y accesible con PageDown/Ctrl+End. Revisión visual: podio primero448px, secundarios460px y tabla597px coinciden con referencia; rangos proporcionales y laurel no superpuesto. Revisión combinada sin bloqueantes; motor/revisiones/privacidad preservados. git diff --check pasa.

Migración004 aplicada manualmente en Supabase Tesis main/PRODUCTION ncvyaxhfbcknviznucii el 2026-10-07; éxito y smoke SQL de cuatro ámbitos/perfil actor/mesMadrid/proyección/grants dentro BEGIN/ROLLBACK. Evidencia en docs/qa/ranking/supabase-verificacion.md. No intercambio Auth/PostgREST de cuentas reales ni despliegue web certificado.

Fondo original generado en ranking-v260/ranking-library.webp; rangos del usuario reutilizados. Avatar por defecto actual profile-v250/user-icon.svg centralizado para futuro catálogo, sin selector ni campos arbitrarios nuevos. Demo8092 ampliada con filtros y periodos simulados, ranking abierto en navegador. Sin commits, push ni despliegue de aplicación en esta tarea.
