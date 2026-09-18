package es.ciudadela.acciones;

import es.ciudadela.dominio.Estudio;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class TrabajarAccion extends AccionBase {

    private final int indiceEstudio;

    public TrabajarAccion(int indiceEstudio) {
        this.indiceEstudio = indiceEstudio;
    }

    @Override
    public String nombre() {
        return "trabajar";
    }

    @Override
    protected void realizar(ContextoJuego contexto) {
        Jugador jugador = contexto.jugadorActual();
        Estudio estudio = jugador.estudioEnDesarrollo(indiceEstudio);
        int puntosTrabajo = contexto.reglas().puntosTrabajoBase();
        if (jugador.personaje() != null) {
            puntosTrabajo = jugador.personaje().habilidad().modificarPuntosTrabajo(contexto, jugador, puntosTrabajo);
        }
        jugador.trabajarEstudio(indiceEstudio, puntosTrabajo);
        contexto.publicarEvento("accion.trabajar", java.util.Map.of(
                "jugador", jugador.nombre(),
                "articulo", estudio.carta().nombre(),
                "prestigio", estudio.carta().prestigio(),
                "trabajo", puntosTrabajo,
                "estado", estudio.estado().name()
        ));
    }
}
