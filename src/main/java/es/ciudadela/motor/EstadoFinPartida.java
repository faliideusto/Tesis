package es.ciudadela.motor;

public final class EstadoFinPartida implements EstadoJuego {
    @Override public String nombre() { return "fin_partida"; }
    @Override public void entrar(ContextoJuego contexto) {
        contexto.publicarEvento("partida.fin", java.util.Map.of(
                "ronda", contexto.partida().ronda(),
                "ganadores", contexto.partida().ganadores().stream().map(es.ciudadela.dominio.Jugador::nombre).toList()));
    }
    @Override public EstadoJuego avanzar(ContextoJuego contexto) {
        throw new IllegalStateException("La partida ha terminado");
    }
}
