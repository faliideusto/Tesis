/**
 * Habilidades de la variante académica del informe inicial.
 *
 * <p>Comité, Estadístico, Plagiador y Revisor se activan una vez por turno.
 * El informe solo permite explícitamente repetir Editorial: se adopta un uso
 * para las demás habilidades activas. Un objetivo inválido no consume el uso
 * ni recursos. Las habilidades no consumen las dos acciones base.
 *
 * <p>El Comité nombra un rol antes de su primera acción base. El veto dura
 * hasta el final de la ronda y suprime tanto acciones como efectos de inicio
 * del turno vetado. Nombrar un rol no elegido consume el uso sin efecto.
 * La inmunidad de la Decana tiene prioridad sobre el veto, el intercambio
 * de manos y la retirada de trabajo, incluso antes de su propio turno.
 *
 * <p>El Estadístico bonifica un estudio propio publicado. El Plagiador
 * intercambia manos con otro jugador. El Investigador roba al empezar su
 * turno y obtiene la primera selección de la siguiente ronda; si no quedan
 * ideas, mantiene el cambio de jugador inicial sin robar.
 *
 * <p>Editorial cobra por todas las publicaciones en mesa al empezar su turno
 * y compra trabajo en estudios propios por tres monedas cada punto.
 * Pre-Doctoral trabaja por dos puntos. El Revisor paga una moneda para quitar
 * un punto a un estudio en desarrollo elegido de cualquier jugador, incluido
 * él mismo; no puede retirar trabajo inexistente ni afectar a publicaciones.
 */
package es.ciudadela.habilidades;
