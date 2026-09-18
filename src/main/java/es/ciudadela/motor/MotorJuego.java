package es.ciudadela.motor;

import es.ciudadela.acciones.AccionTurno;
import es.ciudadela.dominio.Partida;

public interface MotorJuego {

    void registrarObservador(es.ciudadela.eventos.ObservadorJuego observador);

    void retirarObservador(es.ciudadela.eventos.ObservadorJuego observador);

    es.ciudadela.persistencia.PartidaGuardada guardarPartida();

    void recuperarPartida(es.ciudadela.persistencia.PartidaGuardada guardada);

    java.util.List<es.ciudadela.eventos.RegistroEvento> historial();

    void iniciarPartida(Partida partida);

    void avanzarFase();

    void ejecutarAccion(AccionTurno accion);

    Partida partida();

    ContextoJuego contexto();
}
