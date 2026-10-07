# Assets definitivos — 7 octubre 2026

## Implementación
IDs y recompensas estables. Migración008 actualiza presentación: diez imágenes principales, dos títulos sin imagen y cuatro piezas de interacción (libro compartido con miniatura). Defaults sintéticos `default:tipo` están fuera del inventario; equiparlos envía id:null. Mesa sólo avatar/marco/reverso/interaccion, snapshot al entrar; título/insignia/placa quedan sociales. Sin animación ni rediseño de Misiones.

## Validación ejecutada
- Maven completo:218 pruebas PASS (incluye ownership, privacidad y entrada sala privada/invitación/matchmaking).
- Todos los tests Node existentes, más table_cosmetics: PASS.
- PGlite:10 migraciones y ocho comprobaciones administrativas PASS.
- Supabase Tesis main:008 aplicada, verificación readonly ocho PASS. SHA256 AE079F0786870EE20CDDCBFD7CD093AB4B14732EB41D8CF5231318A5F30DF455.
- `tools/qa_profile_customization.mjs`:14 capturas, cuatro viewports, búsqueda/filtros/orden/requisitos, equipamiento, errores sin reintento, identidad/logout/respuestas tardías, restauración siete defaults con foco conservado y cuatro PNG interacción PASS. El resumen de Mi perfil conserva el emblema del rango incluso con cosméticos equipados; la preview cosmética permanece en Personalización.
- `tools/qa_profile_summary.mjs`: fondo a ancho completo sin franjas laterales, sin scroll exterior ni interior en 1920×1080, 1672×941, 1440×900, 1366×768, 1280×720, 1280×650 y 1024×600. Móvil 390×844 con flujo vertical; edición del nombre y acceso/retorno de Personalización PASS. Capturas en `target/qa-profile-summary/`.
- `tools/qa_season_table_assets.mjs`: mesa pública con fixtures de tres jugadores, dos cosméticos equipados y un default; desktop1672 y móvil390, restauración originales, assets cargados y sin interacción animada PASS.
- Inspección PNG: cuadrados1254 para avatar/marco/insignia/interacción; placa2172×724 (3:1), reverso1024×1536 (2:3). Marcos, insignias, placa e interacciónRGBA; avatares/reversoRGB. Sin modificar PNG originales.
- Revisión estática combinada: sin bloqueantes; corregida pérdida de foco al restaurar default, con aserción navegador.

Capturas en `target/qa-profile-customization/` y `target/qa-season-assets/`. Preview local `TESIS_PREVIEW_PORT=8100 TESIS_DEMO_COLLECTION=completa node tools/preview_customization.mjs`: todos los cosméticos simulados para probar; ningún derecho real concedido.

## Límites
Los escenarios visuales usan APIs/DTOs simulados, no una sesión real Supabase Auth/PostgREST ni una partida real con cuentas. Los flujos de sala están cubiertos por tests HTTP y de adaptadores. No se verificó concurrencia entre conexiones SQL. Cambios de equipamiento después de entrar afectan próximas entradas, no una partida existente.
