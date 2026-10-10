/**
 * Habilidades de Tesis para partidas de tres a cinco personas.
 *
 * <p>Comité, Estadístico, Pre-Doctoral y Revisor se activan una vez por turno.
 * Un objetivo inválido no consume el uso
 * ni recursos. Las habilidades no consumen las dos acciones base.
 *
 * <p>El Comité nombra un rol antes de su primera acción base. El veto dura
 * hasta el final de la ronda y suprime tanto acciones como efectos de inicio
 * del turno vetado. Nombrar un rol no elegido consume el uso sin efecto.
 * No puede nombrarse a sí mismo ni a la Decana, cuya inmunidad frente al veto,
 * el intercambio de manos y la retirada de trabajo existe desde que recibe
 * el rol, incluso antes de su propio turno.
 *
 * <p>El Estadístico bonifica un estudio propio publicado. El Investigador roba al empezar su
 * turno y obtiene la primera selección de la siguiente ronda; si no quedan
 * ideas, mantiene el cambio de jugador inicial sin robar.
 *
 * <p>Editorial cobra por todas las publicaciones en mesa al empezar su turno.
 * Pre-Doctoral aporta un punto de trabajo a un estudio propio en desarrollo.
 * El Revisor quita, sin coste, un punto de trabajo a un estudio
 * rival en desarrollo que tenga trabajo; no revisa estudios propios ni
 * publicados.
 * Plagiador solo se conserva para leer partidas antiguas y no está en el mazo nuevo.
 */
package es.tesis.habilidades;
