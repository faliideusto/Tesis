package es.ciudadela.habilidades;

import es.ciudadela.dominio.IdeaCarta;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.motor.ContextoJuego;

public class InvestigadorPrincipalHabilidad implements HabilidadPersonaje {

    @Override
    public void alInicioDeTurno(ContextoJuego contexto, Jugador actor) {
        boolean cartaRobada = !contexto.partida().mazoIdeas().estaVacio();
        if (cartaRobada) {
            IdeaCarta carta = contexto.partida().mazoIdeas().robar();
            actor.añadirCartaIdea(carta);
        }
        contexto.marcarJugadorInicialSiguienteRonda(actor.nombre());
        contexto.publicarEvento("habilidad.investigador_principal", java.util.Map.of(
                "actor", actor.nombre(),
                "cartaRobada", cartaRobada
        ));
    }
}
