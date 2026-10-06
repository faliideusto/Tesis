# Perfil fiel a la referencia

## Objetivo
Reproducir la imagen aportada: biblioteca nocturna, cabecera central Tesis, pestañas, carnet, progresión, estadísticas y siete rangos con los PNG propios.

## Contexto
Rama release/v2.5.0; al empezar únicamente Rango-Niveles/ estaba sin seguimiento (assets del usuario). Perfil y comunidad ya existen y consumen cuentas. Se mantiene la lógica de reglas y cuentas; un ajuste MIME del servidor permite servir SVG locales.

## Alcance y áreas
Frontend estático: account-panel.js, profile-ranks.js, accounts.css, cabecera en app.js/community-panel.js, index.html y nueva academy-header.css. Arte decorativo en assets/Tesis-assets/profile-v250. ServidorWeb.java admite MIME image/svg+xml, preservando CSP; su test HTTP verifica el contrato. QA y capturas en target.

## Fuente de verdad
Datos de perfil recibidos del servidor, progresión existente en profile-ranks.js. Autenticación, rutas e identidad actuales permanecen.

## Plan
- [x] Inspección y contratos de archivos.
- [x] Implementación perfil y cabecera (tres iteraciones visuales).
- [x] Generar y guardar cuatro ilustraciones sin texto y tres SVG nativos.
- [x] Integración y validación automática/navegador.
- [x] Revisión del diff combinado y actualización del plan.

## División multiagente
| Agente | Archivos exclusivos | Contrato y aceptación |
| --- | --- | --- |
| profile_design | account-panel.js, profile-ranks.js, accounts.css, test rangos | Perfil real, PNG propios, responsive; no altera cabecera |
| shared_header | academy-header.css, app.js, academyTabs de community-panel.js, index.html | Cabecera consistente; preserva handlers; navegación 67px y pestañas 56px |
| visual_qa | tools/qa_profile_reference.mjs, evidencias target | Fixture local sin Supabase real, capturas y geometría en 1672/1440/390/360; revisión final |
| Lead | arte profile-v250, plan e integración | Assets generados sin texto; coordinar, revisar y corregir tras cierre de escritores |

## Criterios de aceptación
Composición cercana a referencia 1672x941 con datos iniciales; cabecera compartida en academia/inicio/lobby, PNG originales usados, móvil sin overflow, controles de cuenta y navegación conservados. No simular datos en producción.

## Tests
- `mvn test`: 194 pruebas, cero fallos/errores; incluye MIME SVG y CSP vigente.
- Todas las 11 suites Node con `node --experimental-vm-modules`: pasan.
- `tools/qa_profile_reference.mjs`: 19 capturas y escenarios con Chrome real; SDK/HTTP de cuentas simulados. Perfil Madera/Eterno, 1672/1440/390/360, rutas/historial/recarga, alias, Escape/foco, login/registro/error. Sin desbordamiento ni errores JS ni infracciones CSP.
- `tools/qa_community.mjs`: pasa, 9 capturas; amistades/ranking/misiones y 1440/390/360.
- Iteración 3 comprobada: identidad/récord x41.8/x594.94, y149, altura480; ruta y647, altura242.72. Captura final target/qa-profile-reference/profile-reference-1672.png; comparación manual con referencia aportada.
- `tools/qa_profile.mjs`: pasa íntegro, incluidos tres invitados/lobby, conservación token de sala, avance de fase detrás del perfil y vuelta al tablero. Se corrigió su fixture para GET invalidado por recarga y se adaptaron selectores a la navegación privada ya existente.
- No se verifica Supabase remoto ni QA completa multiplayer/cartas, fuera del alcance visual. Arranque Maven requiere permiso de loopback fuera del sandbox y funciona en 8091.

## Riesgos y decisiones
Decoración debe mantener legibilidad y accesibilidad. Textos dinámicos escapados. Arte generado es decorativo; no contiene estadísticas ni controles. No commit, merge ni publicación.

La CSP bloqueó las primeras decoraciones data URL; se reemplazaron por SVG locales con MIME correcto. Se conservó img-src self. La antigua hoja v240 cortaba el scroll del perfil: se restauró altura natural y se corrigió la navegación absoluta de login. Se revisaron también todos los archivos nuevos. Revisión combinada sin bloqueantes de lógica, contratos ni privacidad.

## Estado
Terminado: tres iteraciones, QA ejecutada y revisión combinada sin bloqueantes. El usuario autorizó después el commit en release/v2.5.0 y la integración en main de personal y origin. Servidor local de vista previa en 8091.
