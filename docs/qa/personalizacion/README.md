# QA de Personalización

Las pruebas de navegador usan exclusivamente una demo local con respuestas simuladas; no autentican cuentas reales ni escriben en Supabase. El catálogo reproduce los once identificadores y diez recompensas de la migración005, incluido el lote de nivel10. `interaccion` aparece vacío, con equipamiento nulo.

## Comandos

```powershell
$env:TESIS_PREVIEW_PORT='8095'; node tools/preview_customization.mjs
$env:TESIS_URL='http://127.0.0.1:8095'; node tools/qa_profile_customization.mjs
node --experimental-vm-modules tests/profile_customization.test.mjs
```

Playwright se obtiene del runtime local existente de Codex; `TESIS_PLAYWRIGHT` y `TESIS_CHROME` permiten indicar otras instalaciones. No se instalaron dependencias. `TESIS_VISUAL_ONLY=1` repite únicamente capturas, geometría, categorías y teclado.

## Evidencia

- Prueba funcional automática: navegación desde perfil, categorías, filtros de propiedad/equipamiento, búsqueda, ordenación, requisitos bloqueados, equipar y desequipar con estado del servidor, error503 sin reintento automático, actualización manual, navegación durante guardado y logout durante lectura tardía. PASS.
- Prueba Node automática: descarte tras destroy/cambio de identidad, eliminación de listeners, escape de nombres no confiables, rechazo de assets externos en el render y séptimo slot vacío. PASS.
- Capturas y resultados JSON: `target/qa-profile-customization/`. Tamaños1672×941,1280×941,768×941 y390×844.
- Revisión visual manual de escritorio y móvil: estructura coherente con el perfil, contenido legible, tarjetas y detalle adaptados al ancho. Los cosméticos siguen usando assets provisionales del catálogo.

La ampliación tipográfica produjo un desbordamiento horizontal a768px en el selector de ordenación. El agente de UI lo corrigió mediante wrapping y límites de ancho. La ejecución final volvió a pasar en los cuatro tamaños: cinco capturas, siete categorías, Interacciones vacía, assets y ausencia de desbordamiento. También pasó la activación de categoría con Enter y la búsqueda escrita con teclado conservando foco. Evidencia final en `visual-result.json`.

No se verificaron operaciones de una cuenta real, un lector de pantalla ni persistencia remota desde este harness. La validación HTTP/SQL real corresponde a las suites del equipo de backend.
