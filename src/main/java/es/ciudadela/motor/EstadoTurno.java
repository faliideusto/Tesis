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
        contexto.publicarEvento("fase.turno", java.util.Map.of(
                "jugador", contexto.jugadorActual().nombre()
        ));
    }

    @Override
    public void avanzar(ContextoJuego contexto) {
        if (contexto instanceof MotorJuegoImpl motorJuego) {
            motorJuego.establecerEstado(new EstadoFinRonda());
        }
    }
}