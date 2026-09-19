package es.tesis.acciones;

import es.tesis.motor.ContextoJuego;

public abstract class AccionBase implements AccionTurno {

    @Override
    public final void ejecutar(ContextoJuego contexto) {
        contexto.reglas().validarAccionBase(contexto);
        realizar(contexto);
        contexto.partida().registrarAccionBase();
    }

    protected abstract void realizar(ContextoJuego contexto);
}
