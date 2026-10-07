# Assets definitivos y opciones originales

## Objetivo
Sustituir placeholders conservando IDs, mostrar opciones originales explícitas e integrar avatar, marco y reverso en mesa.

## Contexto
Rama codex/infra-pase-temporada con trabajo previo sin commit. Migraciones 005–007 desplegadas; conservarlas intactas. PNG definitivos aportados por usuario.

## Alcance y exclusiones
Catálogo, metadatos de interacción, Personalización, preview y proyección pública en sala. Sin animación de interacción, sin cambios de reglas ni rediseño de Misiones.

## Contrato
Cosmetico conserva id/tipo/nombre/asset/rareza; asset admite null sólo para titulo, rutas locales seguras en assets/seasons y assets/Tesis-assets. Campo opcional assets (mapa de rutas) para piezas de interacción. Vistas.Jugador.cosmeticos contiene sólo avatar/marco/reverso/interaccion equipados, nunca inventario ni categorías sociales. Defaults son opciones sintéticas del cliente y POST id:null, fuera del inventario. Loadout de sala se resuelve fuera de locks y usa identidad autenticada.

## División
- customization_data: Java, migración008 y tests backend/SQL; sin archivos frontend.
- customization_screen: Personalización JS/CSS y account-panel; sin mesa ni herramientas QA.
- friends_frontend: players/effects/CSS mesa y tests JS de mesa; consume jugador.cosmeticos.
- Lead: inspección PNG, integración, fixture/QA, documentación y revisión final.

## Plan
- [x] Inspección inicial y contratos.
- [x] Catálogo/servidor y UI/mesa.
- [x] Validación automática y visual responsive.
- [x] Migración Supabase y revisión combinada.

## Aceptación
Todos los PNG cargan; títulos texto; siete defaults restauran originales; marco alrededor del avatar solamente; reverso sólo cartas ocultas de propietario; interacción sin animación; IDs y recompensas estables.

## Riesgos
Assets transparentes con margen, rutas seguras, privacidad de sala, respuestas obsoletas y mutaciones ambiguas. No almacenar JWT en sala ni hacer RPC bajo sus locks.

## Tests y estado
Implementado y revisado. Maven218 PASS,17 suites Node PASS, PGlite10 migraciones PASS; Supabase008 aplicada y ocho verificaciones readonly PASS. QA responsive de Personalización y mesa con fixtures: assets sin roturas, proporciones y defaults restaurados. Hallazgo de foco corregido y comprobado. Evidencia detallada en docs/qa/assets-cronicas.md. Preview simulada completa en8100. Mesa usa snapshot al entrar; no actualiza partidas existentes. No verificada sesión Auth/PostgREST real ni concurrencia entre conexiones SQL. Sin commit/merge en esta entrega.
