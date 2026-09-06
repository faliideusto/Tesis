package es.ciudadela.motor;

import es.ciudadela.dominio.FaseDeTurno;

public class EstadoTurno implements EstadoJuego {

    @Override
    public String nombre() {
        return "turno_jugador";
    }

    @Override
    public void entrar(ContextoJuego contexto) {
        contexto.partida().faseActual(FaseDeTurno.TURNO_JUGADOR);

        contexto.jugadorActual()
                .personaje()
                .habilidad()
                .alInicioDeTurno(contexto, contexto.jugadorActual());

        contexto.publicarEvento("fase.turno", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre()
        ));
    }

    @Override
    public void avanzar(ContextoJuego contexto) {

        int ordenActual = contexto.jugadorActual().personaje().ordenTurno();

        int mayorOrden = contexto.partida().jugadores().stream()
                .mapToInt(jugador -> jugador.personaje().ordenTurno())
                .max()
                .orElse(ordenActual);

        if (ordenActual == mayorOrden) {

            if (contexto instanceof MotorJuegoImpl motorJuego) {
                motorJuego.establecerEstado(new EstadoFinRonda());
            }

        } else {

            contexto.partida().siguienteJugadorPorPersonaje();

            entrar(contexto);
        }
    }
}