package es.ciudadela.motor;

import es.ciudadela.dominio.FaseDeTurno;

public class EstadoFinRonda implements EstadoJuego {

    @Override
    public String nombre() {
        return "fin_ronda";
    }

    @Override
    public void entrar(ContextoJuego contexto) {
        contexto.partida().faseActual(FaseDeTurno.FIN_RONDA);
        contexto.publicarEvento("fase.fin_ronda", java.util.Map.of(
                "ronda", contexto.partida().ronda()
        ));
    }

    @Override
    public void avanzar(ContextoJuego contexto) {
        if (contexto instanceof MotorJuegoImpl motorJuego) {
            motorJuego.pasarALaSiguienteRonda();
            motorJuego.establecerEstado(new EstadoSeleccionRoles());
        }
    }
}