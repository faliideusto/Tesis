package es.tesis;

import es.tesis.dominio.IdeaCarta;
import es.tesis.dominio.Jugador;
import es.tesis.dominio.Mazo;
import es.tesis.dominio.Partida;
import es.tesis.dominio.Personaje;
import es.tesis.habilidades.ComiteEticaHabilidad;
import es.tesis.motor.ContextoJuego;
import es.tesis.motor.EstadoSeleccionRoles;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EstadoSeleccionRolesTest {

    @Test
    void alEntrarEnSeleccionRolesSeDescartaUnaCarta() {

        var mazoRoles = new Mazo<Personaje>(List.of(
                new Personaje("Comité de Ética", 1, new ComiteEticaHabilidad()),
                new Personaje("Estadístico", 2, new ComiteEticaHabilidad()),
                new Personaje("Plagiador", 3, new ComiteEticaHabilidad())
        ));

        var mazoIdeas = new Mazo<IdeaCarta>(List.of());

        var jugadores = List.of(
                new Jugador("Ana")
        );

        var partida = new Partida(jugadores, mazoRoles, mazoIdeas);

        ContextoJuego contexto = new ContextoJuegoTest(partida);

        var estado = new EstadoSeleccionRoles();

        assertEquals(3, partida.mazoRoles().cartas().size());

        estado.entrar(contexto);

        assertEquals(2, partida.mazoRoles().cartas().size());
    }
}