# Tareas pendientes

Documento de trabajo para continuar el desarrollo de la adaptación académica de Ciudadelas.

## 1. Completar el flujo real de partida ✅

- Implementar la selección de roles completa por orden de turno. ✅
- Modelar el descarte automático de una carta de rol al inicio de la fase. ✅
- Asignar y registrar el personaje elegido por cada jugador en cada ronda. ✅
- Hacer que el orden de turno dependa realmente del rol seleccionado. ✅
- Cerrar la ronda completa cuando un jugador publique su tercer artículo. ✅

## 2. Afinar las acciones base ✅

- Validar límites y errores al ejecutar `Cobrar`, `Pensar`, `IniciarEstudio` y `Trabajar`. ✅
- Hacer que `IniciarEstudio` use una carta real de la mano y descuente su coste. ✅
- Evitar que se puedan trabajar estudios publicados. ✅
- Aplicar correctamente las bonificaciones de personajes como `Pre-Doctoral` y `Editorial`. ✅
- Revisar que la acción de trabajo publique el artículo automáticamente al llegar al trabajo requerido. ✅

## 3. Completar habilidades de personajes ✅

- Definir con precisión el efecto de cada personaje según el informe. ✅
- Implementar el veto temporal del `Comité de Ética`. ✅
- Revisar el efecto del `Revisor 2` para que retire trabajo sin romper el estado del estudio. ✅
- Confirmar si `Decana` bloquea habilidades durante toda la ronda o solo acciones concretas. ✅
- Añadir reglas de duración, objetivo y prioridad para todas las habilidades. ✅

## 4. Mejorar el motor y el diseño ✅

- Separar mejor el contexto de juego del motor para reducir acoplamiento. ✅
- Añadir una máquina de estados más explícita para las fases de ronda. ✅
- Introducir validaciones centralizadas en `ReglasJuego`. ✅
- Crear una fábrica para construir mazos de roles e ideas. ✅
- Sustituir listas mutables por colecciones controladas cuando sea necesario. ✅

## 5. Añadir persistencia y trazabilidad ✅

- Guardar el estado de la partida en memoria para continuar turnos. ✅
- Crear un registro de eventos de partida para depuración y seguimiento. ✅
- Preparar una posible serialización a JSON si la práctica la requiere. ✅

## 6. Crear interfaz de usuario básica ✅

- Desarrollar una CLI para elegir acciones y objetivos por teclado. ✅
- Mostrar en pantalla el estado actual de jugadores, cartas y estudios. ✅
- Informar de eventos relevantes como publicaciones, robos y cambios de fase. ✅

## 7. Añadir pruebas automáticas

- Crear tests de reglas iniciales y fin de partida.
- Probar que publicar un tercer artículo termina la ronda correcta.
- Verificar la lógica de cada acción base.
- Añadir tests de habilidades de personajes con casos mínimos.
- Revisar los casos límite de mazos vacíos y manos vacías.

## 8. Documentación final

- Ampliar el `README.md` con ejemplos de uso real.
- Añadir un mapa de paquetes y clases principales.
- Documentar cómo añadir nuevas mecánicas o personajes adaptados.
- Incluir una sección de decisiones de diseño y supuestos del informe.

## Prioridad recomendada

1. Flujo real de partida.
2. Acciones base y habilidades.
3. Pruebas automáticas.
4. Interfaz básica.
5. Documentación final.

## Conectividad entre dispositivos

- Este paso lo vamos a dejar para las últimas fases del desarrollo

## Interfaz web local

- [x] API Java sobre el motor existente, sin reimplementar reglas en JavaScript.
- [x] Inicio configurable y mesa con cartas, personajes, recursos y estudios reales.
- [x] Selección, habilidades, acciones, publicación automática, turnos, rondas y clasificación.
- [x] Relevo privado, DTOs filtrados, revisión de estado y notificaciones.
- [x] Integración de assets originales, responsive, tooltips y movimiento reducido.
- [x] Pruebas HTTP y de flujo completo; se conservan las pruebas originales.
- [x] README de arranque y decisiones documentadas en `docs/WEB.md`.
- [x] Segunda pasada UI/UX y revisión visual con Chrome: tres resoluciones de escritorio, personajes, cartas, estudios, acciones y cinco jugadores. Evidencia en docs/UI-REVISION.md.
- [ ] Resolver a nivel de reglas el posible agotamiento de ideas sin tres publicaciones (no se cambia silenciosamente).
- [ ] Definir un mazo ampliado si se desean seis o siete jugadores reales.
- [ ] Importar/exportar partidas desde la web, actualmente disponible solo en el CLI.
