package es.ciudadela.habilidades;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class PreDoctoralHabilidad implements HabilidadPersonaje {

    @Override
    public int modificarPuntosTrabajo(ContextoJuego contexto, Jugador actor, int puntosBase) {
        return puntosBase + 1;
    }
}