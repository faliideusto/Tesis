# Lanzamiento de libro

## Objetivo y alcance
Primera interacción visual multijugador independiente del motor: control privado pequeño, selección sin modal, animación de libro/páginas/impacto, cooldown15s y eventos compartidos. Sin cambios de reglas, revisión funcional, Misiones o cosméticos sociales.

## Contexto y fuente
Rama codex/infra-pase-temporada con trabajo anterior sin commit. SalaJuego sincroniza tokens y cuentas; CosmeticosPartida proyecta cuatro equipados; CuentasSupabase valida inventario/loadout; app.js polling funcional900ms. Assets definitivos existentes.

## Contrato acordado
GET /api/salas/{codigo}/interacciones?desde=N Bearer sala devuelve {ultimo,ahora,propia:{interactionId,disponibleEn},eventos:[{numero,emisor,objetivo,interactionId,fecha}]}. Tiempos epoch ms. GET inicial sin desde no reanima histórico: sólo establece cursor; posteriores cursor incremental. POST misma ruta {interactionId,objetivo}, Bearer sala + X-Tesis-Account-Authorization cuenta; emisor derivado token, cuenta coincide vinculada, loadout/inventario actual validado fuera locks y pertenencia/cooldown verificados bajo lock. Respuesta mismo canal. Ring limitado y eventos recientes; contador distinto de revisión. Sin llamar vista()/actuar()/avance ronda desde canal cosmético. No JWT/inventarios en eventos.

## División
- customization_data: Java canal/DTO/validación y JUnit, sin frontend.
- customization_screen: JS controlador/transporte/app/control propio/CSS interacción y tests JS, sin renderer animación.
- friends_frontend: renderer nuevo js/interaction-effects.js con API playInteraction(event,{state,signal}), cancelación/motion/CSS propio; sin archivos compartidos con controlador.
- Lead: integración, preview local multiventana, QA navegador/documentación/revisión.

## Aceptación
Propio control sólo con interacción equipada; no self; Escape/fuera; terceros ven evento, no control ajeno; cooldown15s servidor/cliente/reload; funcional inalterado; animación1–1.5s no bloquea juego; motion reducido y geometría real; catálogo renderer extensible.

## Pasos
- [x] Inspección y reparto de contratos.
- [x] Canal y cliente/renderer.
- [x] QA seguridad, cooldown y funcional; visual multiventana.
- [x] Revisión final y documentación.

## Riesgos y decisiones
Requests cosméticos fuera cola funcional para no bloquear juego; generaciones/cursor para duplicados/reconexión; timers/DOM cleanup; servidor sin red bajo lock. Sin migración DB necesaria: canal por sala en memoria igual que partida; reinicio elimina sala y cooldown conjuntamente.

## Estado/tests
Implementación cerrada. Maven226PASS y19suitesNodePASS; QA Chrome tres clientes/salas reales con Auth local simulado, 15s reales y desktop/móvil. Revisión corrigió hueco de cursor entre GET/POST concurrentes y geometría del puntero dentro de placa. Documentado en docs/qa/interaccion-libro.md. No commits/publicación para esta tarea.
