# Ciudadela Académica

Motor Java/Maven para una adaptación didáctica de Ciudadelas orientada a proceso didactico.

## Lectura funcional del informe

El diseño parte de estas decisiones del documento base:

- Objetivo de partida: publicar 3 artículos y finalizar la ronda en la que un jugador llegue a ese umbral.
- Recursos: monedas, cartas de idea, puntos de trabajo y puntos de prestigio.
- Ronda dividida en selección de roles y turnos de acción.
- Acciones base: cobrar, pensar, iniciar estudio y trabajar.
- Roles con habilidades específicas: Comité de Ética, Estadístico, Plagiador, Investigador Principal, Decana, Editorial, Pre-Doctoral y Revisor 2.

## Arquitectura propuesta

El proyecto separa el dominio del motor para que las reglas académicas puedan cambiarse sin reescribir el núcleo.

- `dominio`: entidades puras como `Jugador`, `Carta`, `Personaje`, `Mazo`, `Partida` y `Tablero`.
- `motor`: orquestación de la partida, máquina de estados y contexto de ejecución.
- `acciones`: patrón Command para las acciones de turno.
- `habilidades`: Strategy para los efectos de personaje.
- `reglas`: políticas intercambiables que encapsulan la variante académica.
- `eventos`: Observer para notificar cambios de estado, útil para CLI, UI o registro.

## Patrones empleados

- State: fases de selección de roles, turno y fin de ronda.
- Command: acciones ejecutables como objetos.
- Strategy: habilidades de personajes y reglas de variante.
- Observer: publicación de eventos de partida.

## Extensión rápida

Para añadir una mecánica nueva:

1. Crear una clase en `acciones` si se trata de una acción de jugador.
2. Añadir o ampliar una estrategia en `habilidades` si modifica un personaje.
3. Ajustar `reglas/ReglasAcademicas` si afecta a validación, puntuación o victoria.
4. Escuchar eventos desde `eventos` para mostrar feedback en UI o logs.

Para añadir un personaje nuevo:

1. Crear su habilidad en `habilidades`.
2. Instanciar un `Personaje` con el nombre, orden y habilidad.
3. Incorporarlo al mazo de roles que se construye en `Main` o en una fábrica dedicada.

## Ejecución

```bash
mvn clean compile exec:java
```

La clase `Main` crea una partida mínima, arranca el motor y ejecuta acciones base de prueba para validar que el scaffolding compila y ejecuta sin errores.
