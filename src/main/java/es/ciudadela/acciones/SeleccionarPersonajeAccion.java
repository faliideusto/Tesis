package es.ciudadela.acciones;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.dominio.Personaje;
import es.ciudadela.motor.ContextoJuego;

public class SeleccionarPersonajeAccion implements AccionTurno {

    private final int indice;

    public SeleccionarPersonajeAccion(int indice) {
        this.indice = indice;
    }

    @Override
    public String nombre() {
        return "seleccionar_personaje";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        String nombreJugador = contexto.jugadorActual().nombre();

        Personaje personaje = contexto.partida().mazoRoles().retirar(indice);
        contexto.jugadorActual().asignarPersonaje(personaje);

        contexto.publicarEvento("accion.seleccionar_personaje", java.util.Map.of(
                "jugador", nombreJugador,
                "personaje", personaje.nombre()
        ));

        boolean todosTienenPersonaje = contexto.partida().jugadores().stream()
                .allMatch(jugador -> jugador.personaje() != null);

        if (todosTienenPersonaje) {
            contexto.partida().establecerJugadorInicialPorPersonaje();

            if (contexto instanceof es.ciudadela.motor.MotorJuegoImpl motorJuego) {
                motorJuego.establecerEstado(new es.ciudadela.motor.EstadoTurno());
            }
        } else {
            contexto.partida().siguienteJugador();
        }
            }
}