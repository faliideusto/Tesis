package es.tesis.acciones;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class UsarHabilidadAccion implements AccionTurno {

    private final String objetivo;
    private final Integer indiceEstudio;

    public UsarHabilidadAccion(String objetivo) {
        this.objetivo = objetivo;
        this.indiceEstudio = null;
    }

    public UsarHabilidadAccion(int indiceEstudio) {
        this.objetivo = null;
        this.indiceEstudio = indiceEstudio;
    }

    public UsarHabilidadAccion(String objetivo, int indiceEstudio) {
        this.objetivo = objetivo;
        this.indiceEstudio = indiceEstudio;
    }

    @Override
    public String nombre() {
        return "usar_habilidad";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        contexto.reglas().validarHabilidad(contexto);
        Jugador jugador = contexto.jugadorActual();
        var habilidad = jugador.personaje().habilidad();
        if (indiceEstudio != null && objetivo != null) {
            habilidad.ejecutarSobreEstudio(contexto, jugador, objetivo, indiceEstudio);
        } else if (indiceEstudio != null) {
            jugador.personaje().habilidad().ejecutarEnEstudio(contexto, jugador, indiceEstudio);
        } else {
            jugador.personaje().habilidad().ejecutar(contexto, jugador, objetivo);
        }
        contexto.partida().registrarHabilidad();
    }
}
