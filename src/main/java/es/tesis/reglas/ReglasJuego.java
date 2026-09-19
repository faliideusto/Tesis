package es.tesis.reglas;

import es.tesis.motor.ContextoJuego;

public interface ReglasJuego {

    void validarPartida(es.tesis.dominio.Partida partida);
    void validarActiva(ContextoJuego contexto);
    void validarSeleccion(ContextoJuego contexto);
    void validarInicioTurnos(ContextoJuego contexto);
    void validarAccionBase(ContextoJuego contexto);
    void validarFinTurno(ContextoJuego contexto);
    void validarHabilidad(ContextoJuego contexto);

    void prepararPartida(ContextoJuego contexto);

    boolean debeFinalizarPartida(ContextoJuego contexto);

    int monedasIniciales();

    int cartasIdeaIniciales();

    int puntosTrabajoBase();
}
