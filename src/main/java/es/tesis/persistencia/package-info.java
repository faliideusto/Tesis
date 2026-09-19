/**
 * Guardado de la variante académica mediante instantáneas inmutables versionadas.
 * La memoria pertenece a la sesión; JSON permite continuar en otro proceso.
 * No se serializan motores, observadores ni clases ejecutables.
 *
 * <p>La recuperación reconstruye mazos y jugadores, conserva la identidad de
 * cada estudio del tablero y no ejecuta efectos de entrada de fase.
 * Un motor nuevo importa el historial de la instantánea. En un motor que ya
 * estaba jugando se conserva su historial completo y se registra la recuperación,
 * para no borrar la trazabilidad de las acciones deshechas.
 *
 * <p>Consola: guardar/cargar [nombre], guardados, historial,
 * exportar/importar [archivo]. Sin nombre se usa principal; sin archivo,
 * partida.json. El programa también admite --cargar archivo.json al arrancar.
 * El formato actual admite las reglas académicas y las ocho habilidades conocidas;
 * una nueva variante debe definir su compatibilidad antes de guardarse.
 */
package es.tesis.persistencia;
