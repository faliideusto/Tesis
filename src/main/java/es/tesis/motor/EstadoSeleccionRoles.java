package es.tesis.motor;

public final class EstadoSeleccionRoles implements EstadoJuego {
    @Override public String nombre() { return "seleccion_roles"; }
    @Override public void entrar(ContextoJuego contexto) {
        if (contexto.partida().prepararSeleccion()) {
            contexto.publicarEvento("fase.seleccion_roles", java.util.Map.of("ronda", contexto.partida().ronda()));
        }
    }
    @Override public EstadoJuego avanzar(ContextoJuego contexto) {
        contexto.reglas().validarInicioTurnos(contexto);
        contexto.partida().iniciarTurnos();
        return new EstadoTurno();
    }
}
