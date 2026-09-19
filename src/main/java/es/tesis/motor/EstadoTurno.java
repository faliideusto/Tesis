package es.tesis.motor;

public final class EstadoTurno implements EstadoJuego {
    @Override public String nombre() { return "turno_jugador"; }
    @Override public void entrar(ContextoJuego contexto) {
        if (contexto.estaVetado(contexto.jugadorActual().nombre())) return;
        var jugador = contexto.jugadorActual();
        int ingresos = jugador.estudiosPublicados().stream().mapToInt(e -> e.carta().ingresoPorTurno()).sum();
        if (ingresos > 0) {
            jugador.sumarMonedas(ingresos);
            contexto.publicarEvento("articulo.ingresos", java.util.Map.of("actor", jugador.nombre(), "monedas", ingresos));
        }
        contexto.jugadorActual().personaje().habilidad().alInicioDeTurno(contexto, contexto.jugadorActual());
        contexto.publicarEvento("fase.turno", java.util.Map.of("jugador", contexto.jugadorActual().nombre()));
    }
    @Override public EstadoJuego avanzar(ContextoJuego contexto) {
        if (!contexto.estaVetado(contexto.jugadorActual().nombre())) {
            contexto.reglas().validarFinTurno(contexto);
        }
        if (contexto.partida().avanzarTurno()) return new EstadoTurno();
        return new EstadoFinRonda();
    }
}
