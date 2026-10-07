# Personalización de perfil

## Objetivo
Pantalla fiel al mockup con preview, seis slots principales y slot futuro de Interacciones, colección filtrable, detalle y archivo de temporadas, conectada al inventario y equipamiento propios.

## Contexto
Rama codex/infra-pase-temporada. Infraestructura del pase ya implementada y migración005 aplicada; cambios locales aún sin commit se conservan.

## Alcance
Acceso visible desde Mi perfil, ruta #personalizacion y regreso al resumen. Catálogo con requisitos y temporadas reales mediante ampliación compatible de GET /api/cosmeticos. POST de equipamiento existente. Placeholders actuales con IDs estables.

## Fuera de alcance
Rediseño de Misiones, integración cosmética en Ranking/Amigos/partida, nuevos cosméticos definitivos, commits o publicación.

## Fuente de verdad
RPC cosmeticos/equipar_cosmetico, inventario y loadout permanentes de Supabase. Actor JWT. Ninguna decisión de propiedad se confía al navegador.

## Áreas y división
- Lead: account-panel.js, index.html, integración, plan y revisión.
- customization_screen: profile-customization.js y profile-customization.css.
- customization_data: CuentasSupabase.java, migración006, pruebas de datos y contrato documentado.
- friends_frontend (QA): pruebas/preview independientes y evidencia visual, después de integración.

## Contrato acordado
Cosmeticos mantiene inventario y equipamiento. Añade catalogo [{cosmetico,temporada:{id,nombre},nivel}] y temporadas [{id,nombre,inicio,fin,nivel,maxNivel,recompensasObtenidas,totalRecompensas}]. Datos públicos del catálogo, progreso únicamente del actor. Campos nuevos opcionales durante despliegue; fallback UI al pase actual.

## Plan
- [x] Inspección y contratos.
- [x] Implementación pantalla y catálogo.
- [x] Integración y QA automática/visual responsive.
- [x] Revisión combinada y documentación.

## Criterios
Sin quinta pestaña principal. Equipamiento real actualiza preview tras confirmación, bloqueados muestran requisitos. Categorías, filtros, búsqueda, ordenación, detalle, desequipar y archivo funcionan. Errores visibles, mutaciones serializadas, respuestas antiguas descartadas al salir/cambiar cuenta. Teclado y móvil sin desbordamiento.

## Tests y riesgos
Maven completo: 211 pruebas PASS. PGlite: ocho migraciones/suites PASS. Suites Node anteriores PASS; nueva suite lifecycle/escape/Interacciones PASS. QA funcional navegador con fixtures: filtros, categorías, búsqueda, orden, requisitos, equipar/quitar, error503 sin reintento, respuestas tardías al salir/cerrar sesión PASS. Capturas finales responsive a1672,1280,768 y390px PASS después de corregir overflow a768px. Teclado, foco de búsqueda, assets y categoría Interacciones vacía PASS. Evidencia en docs/qa/personalizacion/README.md y target/qa-profile-customization.

No afirmar que fixtures prueban Supabase Auth/PostgREST con una cuenta real. Migración006 aplicada al proyecto Tesis el7octubre2026; seis controles administrativos de instalación PASS. Flujo remoto completo de una cuenta real y lector de pantalla no ejecutados. Diff combinado y archivos nuevos revisados sin bloqueantes, diffcheck PASS. Sin cambios en Misiones ni motor ni navegación principal, sin commits/push/merge nuevos.

## Decisiones
2026-10-07: ampliación del usuario para tipo `interaccion`, inventario y séptimo slot de loadout. Categoría vacía; sin cosméticos concretos, animación ni acciones de juego. Se conserva el catálogo inicial de11 piezas y los seis slots principales del mockup.

## Estado
Terminado. Demo local identificada como datos simulados abierta en http://127.0.0.1:8095/#personalizacion. Assets e IDs iniciales conservados.
