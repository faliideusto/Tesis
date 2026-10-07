# Catálogo definitivo: Crónicas del Archivo

Pase gratuito mensual de10niveles. Los premios son exclusivamente cosméticos; el progreso del pase es independiente y reclamar no concede XP adicional. Las12piezas se conservan permanentemente.

| Nivel | Tipo | Nombre | ID estable |
| --- | --- | --- | --- |
| 1 | Insignia | Crónicas del Archivo | `academia_insignia` |
| 2 | Avatar | Aprendiz del Archivo | `academia_avatar` |
| 3 | Título | Custodio de Manuscritos | `academia_titulo` |
| 4 | Marco | Pergamino Antiguo | `academia_marco` |
| 5 | Reverso | Archivo Nocturno | `academia_reverso` |
| 6 | Avatar | Erudito de Medianoche | `archivo_erudito` |
| 7 | Placa | Tinta Dorada | `archivo_placa` |
| 8 | Marco épico | Biblioteca Prohibida | `archivo_biblioteca` |
| 9 | Título | Cronista de la Academia | `archivo_cronista` |
| 10 | Marco legendario del set Maestro del Archivo | Maestro del Archivo | `archivo_maestro_marco` |
| 10 | Insignia legendaria del set Maestro del Archivo | Maestro del Archivo | `archivo_maestro_insignia` |
| 10 | Interacción legendaria del set Maestro del Archivo | Lanzamiento de libro | `archivo_lanzamiento_libro` |

El premio `premio_maestro` entrega las tres piezas en una sola reclamación atómica. La interacción se puede inventariar, equipar y desequipar con el contrato existente. No hay animación ni acción de partida todavía.

La migración007 corrige el catálogo provisional registrado y la plantilla de meses nuevos, conservando todos los IDs anteriores. Bloquea primero los perfiles como las RPC, modifica exclusivamente el lote final y restaura los guardas de inmutabilidad dentro de la misma transacción. Quienes ya lo hubieran reclamado reciben únicamente la interacción nueva, sin repetir la reclamación ni modificar progreso, XP o equipamiento. No se alteran temporadas de otro nombre/versión.

La migración008 sustituye los placeholders por los PNG definitivos bajo `/assets/seasons/cronicas-del-archivo/`. Los títulos tienen asset:null y se dibujan como texto/CSS. La interacción conserva `asset` para la miniatura de libro y añade el mapa `assets` con libro, hoja-01, hoja-02 e impacto para su integración futura; todavía no tiene animación.

Validación: nueve migraciones/suites PGlite PASS, incluido lote antiguo reclamado antes de migrar, entrega retroactiva, reclamación doble segura, inventario de tres piezas, equipar/quitar interacción, catálogo de doce y guardas restaurados. No reproduce concurrencia entre conexiones ni Supabase Auth/PostgREST.

Aplicada el7octubre2026 en Supabase Tesis (`ncvyaxhfbcknviznucii`, main). SHA256: `534FC40F5E22DF0330277C196B0BB88CEBE5C7F0A3312787D8F8FFDA08F79FF6`. No repetir en este proyecto. La consulta `verificar_recompensas_archivo_instalacion.sql` devuelve seis PASS: interacción legendaria, plantilla, snapshots, derechos anteriores, guardas y diez premios/doce piezas. No se usaron fixtures en producción.

008 aplicada y verificada en el mismo proyecto: ocho comprobaciones administrativas PASS, incluidas rutas exactas por ID, títulos sin imagen, cuatro piezas de interacción, permisos y guardas. SHA256: `AE079F0786870EE20CDDCBFD7CD093AB4B14732EB41D8CF5231318A5F30DF455`. No repetirla en este proyecto.

QA nueva de navegador con servidor local de fixtures: Personalización en1672/1280/768/390px, siete categorías, restauración de siete opciones originales, proporción/transparencia e interacción4PNG PASS. Mesa con DTOs simulados en1672/390px y defaults PASS. Inventario/progreso reales no fueron modificados para estas capturas. Evidencias y límites en `docs/qa/assets-cronicas.md`.
