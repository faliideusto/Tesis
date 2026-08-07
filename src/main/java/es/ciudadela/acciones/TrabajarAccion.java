package es.ciudadela.acciones;

import es.ciudadela.dominio.EstadoEstudio;
import es.ciudadela.dominio.Estudio;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class TrabajarAccion implements AccionTurno {

    private final int indiceEstudio;

    public TrabajarAccion(int indiceEstudio) {
        this.indiceEstudio = indiceEstudio;
    }

    @Override
    public String nombre() {
        return "trabajar";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        Jugador jugador = contexto.jugadorActual();
        Estudio estudio = jugador.estudios().get(indiceEstudio);
        if (estudio.estado() == EstadoEstudio.PUBLICADO) {
            throw new IllegalStateException("El estudio ya fue publicado");
        }
        int puntosTrabajo = contexto.reglas().puntosTrabajoBase();
        if (jugador.personaje() != null) {
            puntosTrabajo = jugador.personaje().habilidad().modificarPuntosTrabajo(contexto, jugador, puntosTrabajo);
        }
        estudio.agregarTrabajo(puntosTrabajo);
        if (estudio.estado() == EstadoEstudio.PUBLICADO) {
            jugador.sumarPrestigio(estudio.carta().prestigio());
        }
        contexto.publicarEvento("accion.trabajar", java.util.Map.of(
                "jugador", jugador.nombre(),
                "trabajo", puntosTrabajo,
                "estado", estudio.estado().name()
        ));
    }
}