package es.tesis;

import es.tesis.dominio.*;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.motor.MotorJuegoImpl;
import es.tesis.persistencia.SerializadorPartidaJson;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MazoIdeasTest {
    @Test void catalogoCoincideConLosOchoArticulos() {
        var valores = new LinkedHashMap<String, List<Integer>>();
        for (var carta : FabricaMazos.crearIdeas().cartas()) {
            valores.put(carta.nombre(), List.of(carta.costeMonedas(), carta.trabajoRequerido(), carta.prestigio()));
        }
        assertEquals(Map.of(
                "Artículo Ecológico", List.of(2, 1, 1),
                "Artículo Transversal", List.of(3, 1, 2),
                "Casos y Controles", List.of(3, 2, 3),
                "Cohortes", List.of(4, 3, 5),
                "Patente", List.of(2, 4, 5),
                "Ensayo Clínico Aleatorizado", List.of(5, 4, 7),
                "Ensayo Comunitario", List.of(9, 4, 9),
                "Revisión Sistemática", List.of(2, 5, 6)), valores);
    }

    @Test void milRobosConservanElCatalogoCompletoYPermitenRepeticiones() {
        var mazo = FabricaMazos.crearIdeas();
        var catalogo = mazo.cartas();
        var nombres = new HashSet<String>();
        for (int i = 0; i < 1000; i++) {
            var carta = i % 2 == 0 ? mazo.robar() : mazo.robarAleatoria();
            assertTrue(catalogo.contains(carta));
            nombres.add(carta.nombre());
            assertEquals(catalogo, mazo.cartas());
            assertFalse(mazo.estaVacio());
        }
        assertEquals(8, nombres.size());
    }

    @Test void guardarYCargarMantieneLosRobosInagotables() {
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(PartidaInicial.crear());
        var json = new SerializadorPartidaJson();
        var guardada = json.deserializar(json.serializar(motor.guardarPartida()));
        var restaurada = Partida.restaurar(guardada.partida());
        assertTrue(restaurada.mazoIdeas().esInagotable());
        for (int i = 0; i < 100; i++) restaurada.mazoIdeas().robar();
        assertEquals(8, restaurada.mazoIdeas().cartas().size());
        assertTrue(restaurada.jugadores().stream().allMatch(j -> j.cartasIdea().size() == 2));
    }

    @Test void guardadoAntiguoSinModalidadSigueSiendoCompatible() {
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(new Partida(List.of(new Jugador("Ana"), new Jugador("Bruno"), new Jugador("Clara")), FabricaMazos.crearRoles(),
                new Mazo<>(FabricaMazos.crearIdeas().cartas())));
        var serializador = new SerializadorPartidaJson();
        var datos = com.google.gson.JsonParser.parseString(serializador.serializar(motor.guardarPartida())).getAsJsonObject();
        datos.getAsJsonObject("partida").remove("ideasInagotables");
        var restaurada = Partida.restaurar(serializador.deserializar(datos.toString()).partida());
        assertFalse(restaurada.mazoIdeas().esInagotable());
        assertEquals(2, restaurada.mazoIdeas().cartas().size());
    }
}
