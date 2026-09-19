/**
 * Habilidades de Tesis para partidas de hasta seis personas.
 *
 * <p>Comité, Estadístico y Revisor se activan una vez por turno.
 * Un objetivo inválido no consume el uso
 * ni recursos. Las habilidades no consumen las dos acciones base.
 *
 * <p>El Comité nombra un rol antes de su primera acción base. El veto dura
 * hasta el final de la ronda y suprime tanto acciones como efectos de inicio
 * del turno vetado. Nombrar un rol no elegido consume el uso sin efecto.
 * La inmunidad de la Decana tiene prioridad sobre el veto, el intercambio
 * de manos y la retirada de trabajo, incluso antes de su propio turno.
 *
 * <p>El Estadístico bonifica un estudio propio publicado. El Investigador roba al empezar su
 * turno y obtiene la primera selección de la siguiente ronda; si no quedan
 * ideas, mantiene el cambio de jugador inicial sin robar.
 *
 * <p>Editorial cobra por todas las publicaciones en mesa al empezar su turno.
 * Pre-Doctoral trabaja por dos puntos. El Revisor paga una moneda para quitar
 * hasta dos puntos a cualquier artículo con trabajo, incluso propio o publicado.
 * Una publicación revisada vuelve a desarrollo; retira su prestigio hasta que
 * se publique de nuevo, conservando en la carta la bonificación del Estadístico.
 * El trabajo sobrante de una publicación se descarta antes de retirar los puntos.
 * Plagiador solo se conserva para leer partidas antiguas y no está en el mazo nuevo.
 */
package es.tesis.habilidades;
