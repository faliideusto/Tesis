package es.tesis;

import es.tesis.acciones.SeleccionarPersonajeAccion;
import es.tesis.dominio.*;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.motor.*;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class EstadoSeleccionRolesTest {
    private MotorJuegoImpl iniciar(int jugadores) {
        var roles = new Mazo<Personaje>(FabricaMazos.crearRoles().cartas()) {
            @Override public Personaje robarAleatoria() { return retirar(cartas().size() - 1); }
        };
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(new Partida(IntStream.range(0, jugadores).mapToObj(i -> new Jugador("Jugador " + i)).toList(),
                roles, FabricaMazos.crearIdeas()));
        return motor;
    }

    @ParameterizedTest @CsvSource({"3,2", "4,1", "5,1"})
    void descartaLaCantidadCorrectaUnaSolaVezPorSeleccion(int jugadores, int descartes) {
        var motor = iniciar(jugadores);
        assertEquals(7 - descartes, motor.partida().mazoRoles().cartas().size());
        var antes = motor.partida().guardar();
        new EstadoSeleccionRoles().entrar(motor.contexto());
        assertEquals(antes, motor.partida().guardar());
        assertEquals(antes, Partida.restaurar(antes).guardar());
    }

    @Test void losDosDescartadosNoPuedenSeleccionarseYSeRepiteElDescarteEnLaSiguienteRonda() {
        var motor = iniciar(3);
        var mazo = motor.partida().mazoRoles();
        List<Personaje> descartados = mazo.cartasIniciales().subList(5, 7);
        assertTrue(descartados.stream().noneMatch(mazo.cartas()::contains));
        for (int indice : List.of(5, 6)) {
            var antes = motor.partida().guardar();
            assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new SeleccionarPersonajeAccion(indice)));
            assertEquals(antes, motor.partida().guardar());
        }
        for (int i = 0; i < 3; i++) motor.ejecutarAccion(new SeleccionarPersonajeAccion(1));
        assertTrue(motor.partida().jugadores().stream().noneMatch(j -> descartados.contains(j.personaje())));
        while (motor.partida().faseActual() == FaseDeTurno.TURNO_JUGADOR) motor.avanzarFase();
        motor.avanzarFase();
        assertEquals(2, motor.partida().ronda());
        assertEquals(5, mazo.cartas().size());
        assertTrue(descartados.stream().noneMatch(mazo.cartas()::contains));
    }
}
