package es.ciudadela.motor;

import es.ciudadela.dominio.FaseDeTurno;

public class EstadoSeleccionRoles implements EstadoJuego {

    @Override
    public String nombre() {
        return "seleccion_roles";
    }

    @Override
    public void entrar(ContextoJuego contexto) {
        contexto.partida().faseActual(FaseDeTurno.SELECCION_ROLES);
        contexto.publicarEvento("fase.seleccion_roles", java.util.Map.of(
                "ronda", contexto.partida().ronda()
        ));
    }

    @Override
    public void avanzar(ContextoJuego contexto) {
        if (contexto instanceof MotorJuegoImpl motorJuego) {
            motorJuego.establecerEstado(new EstadoTurno());
        }
    }
}