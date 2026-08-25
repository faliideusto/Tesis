package es.ciudadela;

import es.ciudadela.dominio.IdeaCarta;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.dominio.Mazo;
import es.ciudadela.dominio.Partida;
import es.ciudadela.dominio.Personaje;
import es.ciudadela.habilidades.ComiteEticaHabilidad;
import es.ciudadela.motor.ContextoJuego;
import es.ciudadela.motor.EstadoSeleccionRoles;
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