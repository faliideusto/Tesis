package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class PreDoctoralHabilidad implements HabilidadPersonaje {

    @Override
    public int modificarPuntosTrabajo(ContextoJuego contexto, Jugador actor, int puntosBase) {
        return puntosBase + 1;
    }
}