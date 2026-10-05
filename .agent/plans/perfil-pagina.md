# Perfil como apartado completo

## Objetivo y contexto
Usuario pide abandonar el modal, abrir un apartado de perfil y poder volver; mejorar el acceso de inicio. Árbol limpio en main b48997f; release/v2.0.0 e0e5839 contiene el mismo árbol. Trabajar en release existente. Autorización de publicación previa permanece: completar QA/revisión antes de commit/push a release y merge/push main.

## Alcance y contrato
index.html, account-panel.js, app.js y accounts.css; adaptar tools/qa_profile.mjs y tests pertinentes. Perfil independiente con URL #perfil, historial del navegador y vuelta al contexto anterior. Preservar DOM/token de sala, polling, formulario y API Auth. Java, XP, rangos, SQL y reglas no cambian. CSS sigue limitado a cuentas.

## Plan y división
- [x] Inspección rama, estado y skill frontend.
- [x] Página dedicada, navegación/foco y conservación de sala.
- [x] Composición editorial de perfil y nuevo acceso sin escudo diminuto.
- [x] Suites Node y navegador escritorio/móvil/back/reload/lobby/tablero.
- [x] Revisión combinada y preparación de publicación autorizada.

Lead ejecuta secuencialmente: navegación y CSS están acoplados; no hay necesidad de varios escritores. QA/review tras implementación comprobable siguiendo skills correspondientes.

## Aceptación y riesgos
Perfil ocupa todo el viewport, sin borde de modal ni inicio difuminado; scroll de página y volver explícito. Acceso compacto con monograma y nombre/nivel, sin insignia comprimida. Direct link/recarga/back funcionan. Sala conserva token y polling; diálogos de fase no invaden perfil. Formularios accesibles, borradores protegidos, nombres escapados. Móvil360/390 sin overflow, reduced-motion.

## Evidencia
Implementación terminada 2026-10-05. Siete suites Node pasan; nueva aserción de polling avanza fase sin abrir diálogos sobre el apartado. `mvn resources:resources` BUILD SUCCESS para copiar recursos al servidor local; no equivale a ejecutar tests Java.

`tools/qa_profile.mjs` ejecutado en Chrome real local (Playwright instalado, TESIS_PLAYWRIGHT ruta al módulo). Pasa desktop1440×1000, móvil390/360×844 y home360×800; ancho completo y main oculto/inert; URL #perfil, Atrás/Adelante, recarga directa, vuelta explícita/Escape/foco, alias conservado ante refresh/token, guardado/logout, mínimos y fallos de perfil/configuración. Sala real de tres invitados; lobby/home/resume y sondeo no borran borradores. Inicio de partida vía API mientras se consulta cuenta: polling actualiza tablero oculto sin abrir selección por encima; token idéntico al volver y diálogo de fase vigente recuperado. Sin pageerrors. Auth/perfiles simulados, sin secretos ni Supabase real.

Capturas actuales revisadas manualmente en target/qa-profile: home-desktop.png, profile-madera/eterno-desktop.png, profile-eterno-390.png, home-mobile.png y register-desktop.png. Se usa scroll de documento natural, sin caja/scrollbar interna de modal. Cabecera compacta monograma+nombre+nivel, sin escudo pequeño. Se retiraron estilos antiguos de borde/backdrop y cierre de modal; reduced-motion preservado.

Lead aplicó tesis-qa y tesis-review secuencialmente: diff combinado y archivos nuevos revisados; sin bloqueantes/importantes, sin cambios API/Java/SQL o privacidad. Retorno preserva foco y scroll. No ejecutados: lector de pantalla físico, Auth real, partida completa ni tests Java (cambio frontend). Primer intento QA de recarga falló porque su fixture reinicia nivel a1; se corrigió expectativa del mock y volvió a pasar la prueba completa.

Publicación autorizada por instrucción anterior del usuario de push rama y main; usar personal, nunca origin. Commit/push de release y merge/push main después de esta evidencia. Render autodespliega main; push no demuestra que el servicio esté Live.
