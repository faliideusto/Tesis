# Perfil y rangos visuales de Tesis

## Objetivo
Reemplazar botón flotante y perfil básico por un acceso de cabecera y una ventana propia del juego: insignias, niveles, avance y rangos culminando en morado/dorado.

## Contexto
Árbol limpio en main bf15b40. release/v2.0.0 637248c tiene el mismo árbol; se vuelve a la rama de trabajo existente sin trasladar cambios locales. Petición autoriza rediseño; no se interpreta como publicar otra vez automáticamente. Render sigue main On Commit: no tocar main/commit/push/deploy en esta tarea.

## Alcance y fuente de verdad
Frontend static/js/account-panel.js, app.js, css/accounts.css; nueva profile-ranks.js, insignias SVG inline y pruebas Node. Perfil entregado por Java sigue autoritativo. Fórmula 500 XP por nivel, recompensas y balance sin cambios. Rangos cosméticos (1/5/10/20/35/50/75), último Eterno; nivel sigue creciendo sin tope.

## Plan
- [x] Inspeccionar rama, estado, interfaz y assets; leer tesis-frontend.
- [x] Integrar cabecera/home/lobby y sustituir ventana Auth/perfil.
- [x] Insignias, ruta de rangos y barra de avance.
- [x] QA Node y Chrome desktop/mobile/teclado/loading/error con perfiles simulados; revisar capturas.
- [x] Revisar diff, privacidad y preservación de sala/polling; actualizar evidencia.

## División
Lead: account-panel.js, app.js, accounts.css, plan, integración y navegador. Un especialista independiente: profile-ranks.js (metadatos, SVG y cálculo de presentación) y tests/profile_ranks.test.mjs. Sin escritores simultáneos sobre archivos. Review posterior al resultado combinado, no equipo completo por defecto.

## Aceptación
Acceso perfil integrado en inicio/lobby y utilidad tablero. Ventana amplia con insignia, nombre, nivel, XP y porcentaje accesible hasta próximo nivel; estadísticas, ruta de rangos, editar alias y logout. Login/registro coherentes con diseño y mínimo6. Nombres escapados, estados carga/fallo honestos, teclado/Escape/foco; mobile sin overflow horizontal. Polling no cierra ni reconstruye formularios en edición. Rangos sin ventajas y sin cambiar contrato Java.

## Riesgos
Modal general game.css aporta fondo/pseudo-elementos y puede interferir: override scoped #account-panel. Reubicación del único botón DOM debe conservar handler al rerenderhome/board. SDK renovación emite cambios: no borrar borradores de formulario. Rangos extremos no topan XP/nivel. No mostrar UUID/emails ajenos.

## Estado / pruebas
Implementación y revisión terminadas el 2026-10-05, en release/v2.0.0. Entrega visual inicial sin publicar; posteriormente el usuario autoriza explícitamente «haz push en rama y main»: commit en release/v2.0.0, push a personal, merge a main y push a personal/main (activa Auto-Deploy On Commit en Render). Referencias remotas actualizadas y sin cambios externos antes de integrar.

Tests automáticos: siete suites Node ejecutadas con `Get-ChildItem tests/*.test.mjs | ForEach-Object { node --experimental-vm-modules $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Fallo" } }`; todas pasan. Cobertura adicional de umbrales/rango final, normalización/SVG, escape de alias malicioso en texto/input. `mvn resources:resources` BUILD SUCCESS (copia frontend para servidor QA; no equivale a tests Java).

QA Chrome local ejecutada con `tools/qa_profile.mjs`, TESIS_URL opcional (localhost:8091), TESIS_PLAYWRIGHT apuntando al módulo Playwright instalado y TESIS_CHROME al Chrome instalado (valor por defecto Windows). Todas las aserciones pasan: 1440×1000, 390/360×844, cabecera360×800 sin solapamiento ni overflow; perfil Madera/Eterno, barra XP accesible, edición/guardado de alias incluso con renovación y cambio XP en background, Escape y retorno de foco, logout/login/registro mínimo6, fallo configuración/perfil, creación/unión de tres invitados reales en motor local, lobby→home→resume, polling conservando formulario, botón de cuenta en tablero. Ningún pageerror. Auth/perfiles son mocks locales y no se llama a Supabase real ni se escriben recompensas.

Revisión manual de capturas reales en target/qa-profile/: home-desktop.png, profile-madera-desktop.png, profile-eterno-desktop.png, profile-eterno-390.png, login/register mobile y registro desktop, board-desktop.png, error-mobile.png. Composición sin solapamientos; móvil usa scroll vertical del modal para ruta/footer. Ajustado espacio entre frases del arte Auth móvil tras revisar capturas.

Revisión combinada de especialista, skill tesis-review en solo lectura, sin bloqueantes/importantes. Lead revisó también nuevos archivos y `git diff --check`, sin errores. Sin cambios Java, Auth API, SQL, tokens ni autoridad de recompensas. Rangos visuales se calculan del nivel recibido; tema Eterno morado/oro y animación de resplandor respetan reduced-motion.

No ejecutados: autenticación real Supabase en esta fase visual, lector de pantalla físico, partida completa hasta FIN_PARTIDA ni pruebas Java (no hubo cambios Java). Evidencias generadas en target ignorado; plan, módulo, tests y script QA sí forman parte del cambio. La autorización posterior permite publicar; no implica una comprobación de que Render haya terminado el despliegue.
