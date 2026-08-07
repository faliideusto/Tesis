package es.ciudadela.acciones;

import es.ciudadela.motor.ContextoJuego;

public interface AccionTurno {

    String nombre();

    void ejecutar(ContextoJuego contexto);
}