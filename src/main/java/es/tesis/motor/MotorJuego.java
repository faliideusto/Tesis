package es.tesis.motor;

import es.tesis.acciones.AccionTurno;
import es.tesis.dominio.Partida;

public interface MotorJuego {

    void registrarObservador(es.tesis.eventos.ObservadorJuego observador);

    void retirarObservador(es.tesis.eventos.ObservadorJuego observador);

    es.tesis.persistencia.PartidaGuardada guardarPartida();

    void recuperarPartida(es.tesis.persistencia.PartidaGuardada guardada);

    java.util.List<es.tesis.eventos.RegistroEvento> historial();

    void iniciarPartida(Partida partida);

    void avanzarFase();

    void ejecutarAccion(AccionTurno accion);

    Partida partida();

    ContextoJuego contexto();
}
