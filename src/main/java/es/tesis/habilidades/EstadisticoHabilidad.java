package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class EstadisticoHabilidad implements HabilidadPersonaje {

    @Override
    public void ejecutarEnEstudio(ContextoJuego contexto, Jugador actor, int indiceEstudio) {
        if (indiceEstudio < 0 || indiceEstudio >= actor.estudios().size()) {
            throw new IllegalArgumentException("Índice de estudio no válido");
        }
        var estudio = actor.estudios().get(indiceEstudio);
        estudio.añadirPrestigioExtra();
        actor.sumarPrestigio(1);
        contexto.publicarEvento("habilidad.estadistico", java.util.Map.of(
                "actor", actor.nombre(),
                "articulo", estudio.carta().nombre()
        ));
    }
}
