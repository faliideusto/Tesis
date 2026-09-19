package es.tesis.habilidades;

import es.tesis.dominio.IdeaCarta;
import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

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
