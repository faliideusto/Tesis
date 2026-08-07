package es.ciudadela.acciones;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class UsarHabilidadAccion implements AccionTurno {

    private final String objetivo;

    public UsarHabilidadAccion(String objetivo) {
        this.objetivo = objetivo;
    }

    @Override
    public String nombre() {
        return "usar_habilidad";
    }

    @Override
    public void ejecutar(ContextoJuego contexto) {
        Jugador jugador = contexto.jugadorActual();
        if (jugador.personaje() == null) {
            throw new IllegalStateException("El jugador no tiene personaje asignado");
        }
        jugador.personaje().habilidad().ejecutar(contexto, jugador, objetivo);
    }
}