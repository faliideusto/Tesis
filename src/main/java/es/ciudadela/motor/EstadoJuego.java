package es.ciudadela.motor;

public sealed interface EstadoJuego permits EstadoSeleccionRoles, EstadoTurno, EstadoFinRonda, EstadoFinPartida {
    String nombre();
    void entrar(ContextoJuego contexto);
    EstadoJuego avanzar(ContextoJuego contexto);
}
