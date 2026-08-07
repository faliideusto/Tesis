package es.ciudadela.habilidades;

import es.ciudadela.dominio.Estudio;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class Revisor2Habilidad implements HabilidadPersonaje {

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        Jugador otro = contexto.buscarJugador(objetivo);
        if (otro == null) {
            throw new IllegalArgumentException("No existe el jugador objetivo: " + objetivo);
        }
        Estudio estudio = otro.estudios().stream()
                .filter(est -> est.estado().name().equals("EN_DESARROLLO"))
                .findFirst()
                .orElse(null);
        if (estudio != null) {
            estudio.agregarTrabajo(-1);
            contexto.publicarEvento("habilidad.revisor_2", java.util.Map.of(
                    "actor", actor.nombre(),
                    "objetivo", otro.nombre()
            ));
        }
    }
}