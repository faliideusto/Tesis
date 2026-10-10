package es.tesis;

import es.tesis.acciones.*;
import es.tesis.dominio.*;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.habilidades.*;
import es.tesis.motor.MotorJuegoImpl;
import es.tesis.persistencia.SerializadorPartidaJson;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class ReglasBalanceTest {
    private MotorJuegoImpl motor() {
        return new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
    }

    @ParameterizedTest @ValueSource(ints = {0, 1, 2, 6, 7})
    void rechazaNumeroDeJugadoresFueraDeLimitesAntesDeRepartir(int cantidad) {
        var motor = motor();
        var partida = new Partida(IntStream.range(0, cantidad).mapToObj(i -> new Jugador("Jugador " + i)).toList(),
                FabricaMazos.crearRoles(), FabricaMazos.crearIdeas());
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(partida));
        assertNull(motor.partida());
        assertEquals(7, partida.mazoRoles().cartas().size());
        assertTrue(partida.jugadores().stream().allMatch(j -> j.monedas() == 0 && j.cartasIdea().isEmpty()));
    }

    @ParameterizedTest @ValueSource(ints = {3, 4, 5})
    void admiteSoloLosTamanyosValidos(int cantidad) {
        var motor = motor();
        motor.iniciarPartida(new Partida(IntStream.range(0, cantidad).mapToObj(i -> new Jugador("Jugador " + i)).toList(),
                FabricaMazos.crearRoles(), FabricaMazos.crearIdeas()));
        assertEquals(cantidad, motor.partida().jugadores().size());
        assertTrue(motor.partida().jugadores().stream().allMatch(j -> j.monedas() == 2 && j.cartasIdea().size() == 2));
        while (motor.partida().faseActual() == FaseDeTurno.SELECCION_ROLES) motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        assertEquals(FaseDeTurno.TURNO_JUGADOR, motor.partida().faseActual());
    }

    private MotorJuegoImpl comenzar(HabilidadPersonaje habilidad) {
        var roles = new Mazo<Personaje>(List.of(
                new Personaje("Actor", 1, habilidad),
                new Personaje("Rival", 2, new PreDoctoralHabilidad()),
                new Personaje("Tercero", 3, new PreDoctoralHabilidad()),
                new Personaje("Descarte A", 4, new PreDoctoralHabilidad()),
                new Personaje("Descarte B", 5, new PreDoctoralHabilidad()))) {
            @Override public Personaje robarAleatoria() { return retirar(cartas().size() - 1); }
        };
        var motor = motor();
        motor.iniciarPartida(new Partida(List.of(new Jugador("Ana"), new Jugador("Bruno"), new Jugador("Clara")),
                roles, FabricaMazos.crearIdeas()));
        for (int i = 0; i < 3; i++) motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        return motor;
    }

    @Test void preDoctoralAnadeExactamenteUnoUnaVezYNoConsumeAccionesNiMonedas() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var actor = motor.partida().jugadorActual();
        actor.iniciarEstudio(new IdeaCarta("En desarrollo", 1, 5, 3));
        actor.iniciarEstudio(new IdeaCarta("Otro artículo", 1, 5, 3));
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        assertEquals(1, actor.estudios().get(0).trabajoAcumulado());
        assertEquals(0, actor.estudios().get(1).trabajoAcumulado());
        assertEquals(2, actor.monedas());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
        assertTrue(motor.partida().habilidadUsada());
        var antes = motor.partida().guardar();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(0)));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre(), 1)));
        assertEquals(antes, motor.partida().guardar());
        motor.ejecutarAccion(new TrabajarAccion(0));
        assertEquals(2, actor.estudios().get(0).trabajoAcumulado());
    }

    @Test void preDoctoralRechazaPublicadosRivalesEIndicesInvalidosSinConsumirUso() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var actor = motor.partida().jugadorActual();
        var rival = motor.partida().jugadores().stream().filter(j -> j != actor).findFirst().orElseThrow();
        actor.iniciarEstudio(new IdeaCarta("Publicado", 1, 1, 3));
        actor.trabajarEstudio(0, 1);
        actor.iniciarEstudio(new IdeaCarta("Propio", 1, 3, 3));
        rival.iniciarEstudio(new IdeaCarta("Rival", 1, 3, 3));
        var antes = motor.partida().guardar();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(0)));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre(), 0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(rival.nombre(), 0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Desconocido", 0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(-1)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(2)));
        assertEquals(antes, motor.partida().guardar());
        motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre(), 1));
        assertEquals(1, actor.estudios().get(1).trabajoAcumulado());
    }

    @Test void preDoctoralPublicaConElPuntoFinalInclusoTrasAgotarAccionesBase() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var actor = motor.partida().jugadorActual();
        actor.iniciarEstudio(new IdeaCarta("Artículo", 1, 1, 3));
        motor.ejecutarAccion(new CobrarAccion());
        motor.ejecutarAccion(new CobrarAccion());
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        assertEquals(1, actor.estudios().get(0).trabajoAcumulado());
        assertEquals(EstadoEstudio.PUBLICADO, actor.estudios().get(0).estado());
        assertEquals(3, actor.prestigio());
        assertEquals(2, motor.partida().accionesBaseRealizadas());
    }

    @Test void preDoctoralConservaUsoAlGuardarYLoReiniciaEnSuSiguienteTurno() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var actor = motor.partida().jugadorActual();
        actor.iniciarEstudio(new IdeaCarta("Artículo", 1, 5, 3));
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        var json = new SerializadorPartidaJson();
        var recuperado = motor();
        recuperado.recuperarPartida(json.deserializar(json.serializar(motor.guardarPartida())));
        assertTrue(recuperado.partida().habilidadUsada());
        assertThrows(IllegalStateException.class, () -> recuperado.ejecutarAccion(new UsarHabilidadAccion(0)));
        while (recuperado.partida().faseActual() == FaseDeTurno.TURNO_JUGADOR) recuperado.avanzarFase();
        recuperado.avanzarFase();
        // Todos los roles de esta mesa tienen la habilidad Pre-Doctoral.
        while (recuperado.partida().faseActual() == FaseDeTurno.SELECCION_ROLES) recuperado.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        while (!recuperado.partida().jugadorActual().nombre().equals(actor.nombre())) recuperado.avanzarFase();
        assertFalse(recuperado.partida().habilidadUsada());
        recuperado.ejecutarAccion(new UsarHabilidadAccion(0));
        assertEquals(2, recuperado.partida().jugadorActual().estudios().get(0).trabajoAcumulado());
    }

    @ParameterizedTest @ValueSource(ints = {1, 2, 3})
    void revisorRetiraUnPuntoPorMoneda(int trabajo) {
        var motor = comenzar(new Revisor2Habilidad());
        var actor = motor.partida().jugadorActual();
        var rival = motor.partida().jugadores().stream().filter(j -> j != actor).findFirst().orElseThrow();
        rival.iniciarEstudio(new IdeaCarta("Artículo", 1, 5, 3));
        rival.trabajarEstudio(0, trabajo);
        motor.ejecutarAccion(new UsarHabilidadAccion(rival.nombre(), 0));
        assertEquals(trabajo - 1, rival.estudios().get(0).trabajoAcumulado());
        assertEquals(EstadoEstudio.EN_DESARROLLO, rival.estudios().get(0).estado());
        assertEquals(1, actor.monedas());
        assertTrue(motor.partida().habilidadUsada());
    }

    @Test void revisorSinMonedasNoModificaUnObjetivoValido() {
        var motor = comenzar(new Revisor2Habilidad());
        var actor = motor.partida().jugadorActual();
        var rival = motor.partida().jugadores().stream().filter(j -> j != actor).findFirst().orElseThrow();
        rival.iniciarEstudio(new IdeaCarta("Artículo", 1, 5, 3));
        rival.trabajarEstudio(0, 1);
        actor.gastarMonedas(2);
        var antes = motor.partida().guardar();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(rival.nombre(), 0)));
        assertEquals(antes, motor.partida().guardar());
    }
}
