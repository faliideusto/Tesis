package es.tesis.motor;

public final class EstadoFinRonda implements EstadoJuego {
    @Override public String nombre() { return "fin_ronda"; }
    @Override public void entrar(ContextoJuego contexto) {
        contexto.publicarEvento("fase.fin_ronda", java.util.Map.of("ronda", contexto.partida().ronda()));
    }
    @Override public EstadoJuego avanzar(ContextoJuego contexto) {
        contexto.reglas().validarActiva(contexto);
        if (contexto.reglas().debeFinalizarPartida(contexto)) {
            contexto.partida().finalizar();
            return new EstadoFinPartida();
        }
        contexto.partida().iniciarSiguienteRonda(contexto.jugadorInicialSiguienteRonda());
        return new EstadoSeleccionRoles();
    }
}
