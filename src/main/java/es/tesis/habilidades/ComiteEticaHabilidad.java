package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class ComiteEticaHabilidad implements HabilidadPersonaje {

    @Override
    public boolean requiereResolucionAlInicio() { return true; }

    @Override
    public void ejecutar(ContextoJuego contexto, Jugador actor, String objetivo) {
        if (contexto.partida().accionesBaseRealizadas() != 0) {
            throw new IllegalStateException("El Comité debe nombrar un rol antes de su primera acción base");
        }
        var rol = contexto.partida().mazoRoles().cartasIniciales().stream()
                .filter(r -> r.nombre().equalsIgnoreCase(objetivo)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No existe ese rol"));
        if (rol == actor.personaje()) throw new IllegalArgumentException("El Comité no puede vetarse a sí mismo");
        if (rol.habilidad() instanceof DecanaHabilidad) throw new IllegalArgumentException("El Comité no puede vetar a la Decana");
        // Nombrar un rol descartado o no elegido consume la habilidad sin revelar quién lo tiene.
        contexto.partida().jugadores().stream()
                .filter(j -> j.personaje() == rol)
                .forEach(j -> contexto.vetarJugador(j.nombre()));
        contexto.publicarEvento("habilidad.comite_etica", java.util.Map.of(
                "actor", actor.nombre(),
                "rol", rol.nombre()
        ));
    }
}
