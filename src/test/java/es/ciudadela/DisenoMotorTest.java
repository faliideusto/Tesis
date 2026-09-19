package es.ciudadela;

import es.ciudadela.acciones.*;
import es.ciudadela.dominio.*;
import es.ciudadela.eventos.*;
import es.ciudadela.motor.*;
import es.ciudadela.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class DisenoMotorTest {
    private MotorJuego iniciar() {
        MotorJuego motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(PartidaInicial.crear());
        return motor;
    }

    private void seleccionar(MotorJuego motor) {
        for (int i = 0; i < 2; i++) {
            var roles = motor.partida().mazoRoles().cartas();
            int indice = 0;
            while (roles.get(indice).habilidad().requiereResolucionAlInicio()) indice++;
            motor.ejecutarAccion(new SeleccionarPersonajeAccion(indice));
        }
    }

    @Test void contextoIndependienteYAccionSinDependenciaDelMotorConcreto() {
        MotorJuego motor = iniciar();
        assertNotSame(motor, motor.contexto());
        seleccionar(motor);
        int monedas = motor.contexto().jugadorActual().monedas();
        new CobrarAccion().ejecutar(motor.contexto());
        assertEquals(monedas + 2, motor.contexto().jugadorActual().monedas());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
    }

    @Test void reglasIntercambiablesPuedenRechazarUnaAccionSinMutaciones() {
        var reglas = new ReglasAcademicas() {
            @Override public void validarAccionBase(ContextoJuego contexto) {
                super.validarAccionBase(contexto);
                throw new IllegalStateException("Acciones desactivadas por esta variante");
            }
        };
        MotorJuego motor = new MotorJuegoImpl(reglas, new BusEventosSimple());
        motor.iniciarPartida(PartidaInicial.crear());
        seleccionar(motor);
        int monedas = motor.contexto().jugadorActual().monedas();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        assertEquals(monedas, motor.contexto().jugadorActual().monedas());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
    }

    @Test void operacionesDePartidaRespetanLasFasesSinSettersLibres() {
        MotorJuego motor = iniciar();
        Partida partida = motor.partida();
        assertThrows(IllegalStateException.class, partida::iniciarTurnos);
        assertThrows(IllegalStateException.class, partida::avanzarTurno);
        assertThrows(IllegalStateException.class, partida::finalizar);
        assertThrows(IllegalStateException.class, partida::registrarAccionBase);
        assertThrows(IllegalStateException.class, partida::registrarHabilidad);
        assertThrows(IllegalStateException.class, partida::establecerJugadorInicialAleatorio);
        seleccionar(motor);
        assertThrows(IllegalStateException.class, partida::prepararSeleccion);
        assertThrows(IllegalStateException.class, () -> partida.iniciarSiguienteRonda("Ana"));
        motor.ejecutarAccion(new CobrarAccion());
        motor.ejecutarAccion(new CobrarAccion());
        assertThrows(IllegalStateException.class, partida::registrarAccionBase);
        assertEquals(2, partida.accionesBaseRealizadas());
        motor.avanzarFase();
        assertEquals(0, partida.accionesBaseRealizadas());
        motor.avanzarFase();
        assertThrows(IllegalArgumentException.class, () -> partida.iniciarSiguienteRonda("Nadie"));
        assertEquals(FaseDeTurno.FIN_RONDA, partida.faseActual());
        assertEquals(1, partida.ronda());
        motor.avanzarFase();
        assertEquals(2, partida.ronda());
        assertEquals(FaseDeTurno.SELECCION_ROLES, partida.faseActual());
    }

    @Test void fabricaCreaMazosIndependientesConElCatalogoCompleto() {
        var roles = FabricaMazos.crearRoles();
        var otrosRoles = FabricaMazos.crearRoles();
        assertEquals(8, roles.cartas().size());
        assertNotSame(roles.cartas().get(0), otrosRoles.cartas().get(0));
        roles.robar();
        assertEquals(8, otrosRoles.cartas().size());
        roles.reiniciar();
        assertEquals(8, roles.cartas().size());
        var ideas = FabricaMazos.crearIdeas();
        var otrasIdeas = FabricaMazos.crearIdeas();
        assertEquals(7, ideas.cartas().size());
        assertNotSame(ideas.cartas().get(0), otrasIdeas.cartas().get(0));
        ideas.robar();
        assertEquals(7, otrasIdeas.cartas().size());
    }

    @Test void coleccionesDevueltasNoPermitenEscrituraNiCambianConElOriginal() {
        var partida = PartidaInicial.crear();
        assertThrows(UnsupportedOperationException.class, () -> partida.jugadores().clear());
        var cartas = partida.mazoIdeas().cartas();
        assertThrows(UnsupportedOperationException.class, cartas::clear);
        partida.mazoIdeas().robar();
        assertEquals(7, cartas.size());
        var jugador = partida.jugadores().get(0);
        var mano = jugador.cartasIdea();
        jugador.añadirCartaIdea(cartas.get(0));
        assertTrue(mano.isEmpty());
        assertThrows(UnsupportedOperationException.class, () -> jugador.cartasIdea().clear());
        var estudios = jugador.estudios();
        jugador.iniciarEstudio(cartas.get(0));
        assertTrue(estudios.isEmpty());
        assertThrows(UnsupportedOperationException.class, () -> jugador.estudios().clear());
        var mesa = partida.tablero().estudiosEnMesa();
        partida.tablero().agregarEstudio(jugador.estudios().get(0));
        assertTrue(mesa.isEmpty());
        assertThrows(UnsupportedOperationException.class, () -> partida.tablero().estudiosEnMesa().clear());
    }

    @Test void datosDeEventosEstanProtegidosYObservadoresPuedenRegistrarseDuranteUnaNotificacion() {
        Map<String, Object> datos = new HashMap<>();
        datos.put("ronda", 1);
        var evento = new EventoJuego("prueba", datos);
        datos.put("ronda", 2);
        assertEquals(1, evento.datos().get("ronda"));
        assertThrows(UnsupportedOperationException.class, () -> evento.datos().clear());
        var bus = new BusEventosSimple();
        var recibidos = new ArrayList<EventoJuego>();
        bus.registrar(e -> bus.registrar(recibidos::add));
        bus.publicar(evento);
        assertTrue(recibidos.isEmpty());
        bus.publicar(evento);
        assertEquals(1, recibidos.size());
    }

    @Test void motorRechazaOperacionesAntesDelInicio() {
        MotorJuego motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
    }
}
