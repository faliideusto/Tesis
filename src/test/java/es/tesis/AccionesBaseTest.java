package es.tesis;

import es.tesis.acciones.*;
import es.tesis.dominio.*;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.habilidades.*;
import es.tesis.motor.MotorJuegoImpl;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AccionesBaseTest {
    private MotorJuegoImpl crearMotor() { return crearMotor(true); }

    private MotorJuegoImpl crearMotor(boolean seleccionar) {
        var habilidad = new HabilidadPersonaje() {};
        var roles = new Mazo<>(List.of(
                new Personaje("Uno", 1, habilidad),
                new Personaje("Dos", 2, habilidad),
                new Personaje("Tres", 3, habilidad)));
        var ideas = new ArrayList<IdeaCarta>();
        for (int i = 0; i < 6; i++) {
            ideas.add(new IdeaCarta("Idea " + i, 1, 2, 3));
        }
        var partida = new Partida(List.of(new Jugador("Ana"), new Jugador("Bruno")),
                roles, new Mazo<>(ideas));
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(partida);
        if (seleccionar) {
            motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
            motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        }
        return motor;
    }

    @Test
    void cobrarYPensarConsumenDosAccionesYRechazanLaTercera() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        int cartasRestantes = motor.partida().mazoIdeas().cartas().size();
        motor.ejecutarAccion(new CobrarAccion());
        motor.ejecutarAccion(new PensarAccion());
        assertEquals(4, jugador.monedas());
        assertEquals(3, jugador.cartasIdea().size());
        assertEquals(cartasRestantes - 1, motor.partida().mazoIdeas().cartas().size());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        assertEquals(4, jugador.monedas());
        assertEquals(2, motor.partida().accionesBaseRealizadas());
        motor.avanzarFase();
        assertNotSame(jugador, motor.contexto().jugadorActual());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
        assertDoesNotThrow(() -> motor.ejecutarAccion(new CobrarAccion()));
    }

    @Test
    void accionesRechazadasNoConsumenRecursosNiAcciones() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        jugador.añadirCartaIdea(new IdeaCarta("Cara", 10, 1, 2));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new IniciarEstudioAccion(-1)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new IniciarEstudioAccion(3)));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new IniciarEstudioAccion(2)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new TrabajarAccion(0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new TrabajarAccion(-1)));
        assertEquals(2, jugador.monedas());
        assertEquals(3, jugador.cartasIdea().size());
        assertTrue(jugador.estudios().isEmpty());
        assertTrue(motor.partida().tablero().estudiosEnMesa().isEmpty());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
    }

    @Test
    void pensarConMazoVacioYUsarManoVaciaSeRechazan() {
        var motor = crearMotor();
        while (!motor.partida().mazoIdeas().estaVacio()) motor.partida().mazoIdeas().robar();
        while (!motor.contexto().jugadorActual().cartasIdea().isEmpty()) motor.contexto().jugadorActual().retirarCartaIdea(0);
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new PensarAccion()));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new IniciarEstudioAccion(0)));
        assertEquals(0, motor.partida().accionesBaseRealizadas());
        assertTrue(motor.contexto().jugadorActual().cartasIdea().isEmpty());
    }

    @Test
    void ningunaAccionBaseNiHabilidadSePermiteFueraDelTurno() {
        for (var fase : List.of(FaseDeTurno.SELECCION_ROLES, FaseDeTurno.FIN_RONDA, FaseDeTurno.FIN_PARTIDA)) {
            var motor = crearMotor(fase != FaseDeTurno.SELECCION_ROLES);
            if (fase == FaseDeTurno.FIN_PARTIDA) {
                var jugador = motor.contexto().jugadorActual();
                for (int i = 0; i < 3; i++) {
                    jugador.iniciarEstudio(new IdeaCarta("Publicado", 0, 1, 1));
                    jugador.trabajarEstudio(i, 1);
                }
            }
            if (fase != FaseDeTurno.SELECCION_ROLES) { motor.avanzarFase(); motor.avanzarFase(); }
            if (fase == FaseDeTurno.FIN_PARTIDA) motor.avanzarFase();
            assertEquals(fase, motor.partida().faseActual());
            for (var accion : List.of(new CobrarAccion(), new PensarAccion(),
                    new IniciarEstudioAccion(0), new TrabajarAccion(0), new UsarHabilidadAccion(0))) {
                assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(accion));
            }
            assertEquals(0, motor.partida().accionesBaseRealizadas());
            assertEquals(2, motor.contexto().jugadorActual().monedas());
        }
    }

    @Test
    void iniciarEstudioPagaYTrasladaLaCartaRealAlTablero() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        var carta = jugador.cartasIdea().get(0);
        motor.ejecutarAccion(new IniciarEstudioAccion(0));
        assertEquals(1, jugador.monedas());
        assertEquals(1, jugador.cartasIdea().size());
        assertFalse(jugador.cartasIdea().contains(carta));
        var estudio = jugador.estudios().get(0);
        assertSame(carta, estudio.carta());
        assertSame(estudio, motor.partida().tablero().estudiosEnMesa().get(0));
        assertEquals(EstadoEstudio.EN_DESARROLLO, estudio.estado());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
    }

    @Test
    void trabajarPublicaAlAlcanzarElRequisitoYNoDuplicaPrestigio() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        jugador.iniciarEstudio(new IdeaCarta("Artículo", 1, 1, 5));
        motor.ejecutarAccion(new TrabajarAccion(0));
        assertEquals(EstadoEstudio.PUBLICADO, jugador.estudios().get(0).estado());
        assertEquals(5, jugador.prestigio());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new TrabajarAccion(0)));
        assertEquals(5, jugador.prestigio());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
    }

    @Test
    void preDoctoralAportaDosPuntosYPublicaAunqueSupereElRequisito() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        jugador.asignarPersonaje(new Personaje("Pre-Doctoral", 7, new PreDoctoralHabilidad()));
        jugador.iniciarEstudio(new IdeaCarta("Artículo", 1, 1, 5));
        motor.ejecutarAccion(new TrabajarAccion(0));
        assertEquals(2, jugador.estudios().get(0).trabajoAcumulado());
        assertEquals(1, jugador.cantidadPublicados());
        assertEquals(5, jugador.prestigio());
    }

    @Test
    void editorialNoPermiteComprarTrabajoNiConsumeRecursos() {
        var motor = crearMotor();
        var jugador = motor.contexto().jugadorActual();
        jugador.asignarPersonaje(new Personaje("Editorial", 6, new EditorialHabilidad()));
        jugador.iniciarEstudio(new IdeaCarta("Articulo", 1, 3, 5));
        jugador.sumarMonedas(10);
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(0)));
        assertEquals(12, jugador.monedas());
        assertEquals(0, jugador.estudios().get(0).trabajoAcumulado());
        assertFalse(motor.partida().habilidadUsada());
    }

    @Test
    void editorialCobraPorPublicacionesDeTodosLosJugadores() {
        var motor = crearMotor();
        for (var jugador : motor.partida().jugadores()) {
            jugador.iniciarEstudio(new IdeaCarta("Publicado", 0, 1, 1));
            jugador.trabajarEstudio(0, 1);
            motor.partida().tablero().agregarEstudio(jugador.estudios().get(0));
        }
        var actor = motor.contexto().jugadorActual();
        new EditorialHabilidad().alInicioDeTurno(motor.contexto(), actor);
        assertEquals(4, actor.monedas());
    }
}
