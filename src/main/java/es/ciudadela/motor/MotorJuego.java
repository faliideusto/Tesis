package es.ciudadela.motor;

import es.ciudadela.acciones.AccionTurno;
import es.ciudadela.dominio.Partida;

public interface MotorJuego {

    void iniciarPartida(Partida partida);

    void avanzarFase();

    void ejecutarAccion(AccionTurno accion);

    Partida partida();

    ContextoJuego contexto();
}