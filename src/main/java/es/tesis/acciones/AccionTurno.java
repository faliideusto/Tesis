package es.tesis.acciones;

import es.tesis.motor.ContextoJuego;

public interface AccionTurno {

    String nombre();

    void ejecutar(ContextoJuego contexto);
}