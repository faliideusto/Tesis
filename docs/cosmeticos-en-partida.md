# Contrato visual preparado para la mesa

La partida solo admite cuatro categorías. `CosmeticosPartida.desde(CuentasSupabase.Cosmeticos)` proyecta el equipamiento validado del servidor y descarta inventario, archivo y categorías sociales. Una pieza ausente, no poseída o de otro tipo se convierte en null para utilizar la presentación predeterminada. El loadout permanente conserva sus siete slots.

| Categoría | Destino de presentación |
| --- | --- |
| avatar | Sustituye la imagen del avatar circular del jugador. |
| marco | Capa alrededor de ese avatar; no modifica la tarjeta, recursos ni indicadores funcionales. |
| reverso | Imagen de las cartas de ese jugador que se presentan boca abajo; no revela información de la carta. |
| interaccion | Efecto visual dirigido a otro jugador; no es una acción del motor. |

Título, insignia y placa quedan exclusivamente en Perfil, Personalización, Amigos, Ranking y otras superficies sociales. No se añaden al contrato de mesa.

La proyección está integrada en `Vistas.Jugador.cosmeticos`. El adaptador resuelve el equipamiento autenticado al crear o entrar en una sala, aceptar una invitación o buscar emparejamiento. Guarda únicamente la proyección pública por miembro, sin JWT, inventario ni categorías sociales. Las llamadas de red suceden fuera de los bloqueos de sala. El equipamiento se captura al entrar: cambiarlo después se refleja en próximas entradas, no altera una partida existente. Los slots vacíos pueden omitirse en el JSON de sala y el cliente utiliza los originales.

`players.js` conserva el personaje/rol en su texto y vista funcional aunque cambie el avatar. El marco ocupa una capa local al avatar con pointer-events:none. El reverso se usa en el contador de mano y vuelos de cartas ocultas según su propietario, sin cambiar índices ni ocultación. Los mazos comunes mantienen su presentación predeterminada porque no pertenecen a un jugador.

`archivo_lanzamiento_libro` es la primera interacción catalogada. Su futura ejecución debe tener un canal cosmético independiente, autenticado y limitado, con pertenencia a sala y objetivo válidos. No se enviará mediante `SesionJuego.actuar`, ni consumirá acciones, cambiará revisión funcional, turno, recursos o estado del motor. Actualmente no existe ese endpoint, evento ni animación; no se puede lanzar ningún efecto todavía.

Pruebas: proyección de los cuatro slots, exclusión de tres categorías sociales, rechazo de selección no poseída o de tipo equivocado, defaults de invitados y transporte en sala privada/invitación/emparejamiento. Node verifica rutas, propietarios y vuelos privados; QA de navegador verifica los renderizadores con DTOs simulados en desktop y móvil. No hay cambios de reglas, recursos o estado.
