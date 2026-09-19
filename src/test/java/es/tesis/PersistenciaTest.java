package es.tesis;

import es.tesis.acciones.*;
import es.tesis.consola.ConsolaJuego;
import es.tesis.dominio.*;
import es.tesis.eventos.*;
import es.tesis.habilidades.*;
import es.tesis.motor.*;
import es.tesis.persistencia.*;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.nio.file.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class PersistenciaTest {
    @TempDir Path temporal;

    private MotorJuegoImpl vacio() { return new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple()); }

    private MotorJuegoImpl preparar(HabilidadPersonaje... habilidades) {
        var roles = new ArrayList<Personaje>();
        var jugadores = new ArrayList<Jugador>();
        var ideas = new ArrayList<IdeaCarta>();
        for (int i = 0; i < habilidades.length; i++) {
            roles.add(new Personaje("Rol " + i, i + 1, habilidades[i]));
            jugadores.add(new Jugador("Investigación " + i));
        }
        roles.add(new Personaje("Descartado", 99, new PreDoctoralHabilidad()));
        for (int i = 0; i < 12; i++) ideas.add(new IdeaCarta("Artículo \"ecológico\" " + i, 1, 2, 4));
        var mazo = new Mazo<Personaje>(roles) {
            @Override public Personaje robarAleatoria() { return retirar(cartas().size() - 1); }
        };
        var motor = vacio();
        motor.iniciarPartida(new Partida(jugadores, mazo, new Mazo<>(ideas)));
        return motor;
    }

    private MotorJuegoImpl comenzar(HabilidadPersonaje... habilidades) {
        var motor = preparar(habilidades);
        seleccionar(motor);
        return motor;
    }

    private void seleccionar(MotorJuego motor) {
        while (motor.partida().faseActual() == FaseDeTurno.SELECCION_ROLES) {
            motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        }
    }

    private Jugador actor(MotorJuego motor) { return motor.contexto().jugadorActual(); }

    @Test void guardarUnaAccionYRecuperarNoComparteEstadoNiReiniciaContador() {
        var motor = comenzar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        motor.ejecutarAccion(new CobrarAccion());
        var almacen = new AlmacenPartidasMemoria();
        var guardada = motor.guardarPartida();
        almacen.guardar("turno", guardada);
        Jugador original = actor(motor);
        motor.ejecutarAccion(new CobrarAccion());
        assertEquals(6, original.monedas());
        motor.recuperarPartida(almacen.cargar("turno"));
        assertNotSame(original, actor(motor));
        assertEquals(4, actor(motor).monedas());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
        motor.ejecutarAccion(new PensarAccion());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        motor.recuperarPartida(almacen.cargar("turno"));
        assertEquals(2, actor(motor).cartasIdea().size());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
        assertThrows(UnsupportedOperationException.class, () -> guardada.partida().jugadores().clear());
        assertThrows(UnsupportedOperationException.class, () -> guardada.partida().jugadores().get(0).mano().clear());
        assertThrows(UnsupportedOperationException.class, () -> almacen.nombres().clear());
        assertThrows(IllegalArgumentException.class, () -> almacen.cargar("inexistente"));
    }

    @Test void seleccionParcialMantieneRolesJugadorYUnSoloDescarte() {
        var motor = preparar(new PreDoctoralHabilidad(), new EditorialHabilidad(), new DecanaHabilidad());
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(1));
        var guardada = motor.guardarPartida();
        var recuperado = vacio();
        recuperado.recuperarPartida(guardada);
        assertEquals(guardada.partida(), recuperado.partida().guardar());
        assertEquals(1, recuperado.historial().stream().filter(e -> e.tipo().equals("fase.seleccion_roles")).count());
        seleccionar(recuperado);
        assertEquals(FaseDeTurno.TURNO_JUGADOR, recuperado.partida().faseActual());
        assertTrue(recuperado.partida().jugadores().stream().allMatch(j -> j.personaje() != null));
    }

    @Test void restaurarInvestigadorNoRobaOtraVezYPreservaElJugadorInicial() {
        var motor = comenzar(new InvestigadorPrincipalHabilidad(), new PreDoctoralHabilidad());
        String investigador = actor(motor).nombre();
        assertEquals(3, actor(motor).cartasIdea().size());
        var guardada = motor.guardarPartida();
        var recuperado = vacio();
        recuperado.recuperarPartida(guardada);
        assertEquals(3, actor(recuperado).cartasIdea().size());
        assertEquals(guardada.partida().ideasDisponibles().size(), recuperado.partida().mazoIdeas().cartas().size());
        assertEquals(1, recuperado.historial().stream().filter(e -> e.tipo().equals("habilidad.investigador_principal")).count());
        recuperado.avanzarFase(); recuperado.avanzarFase(); recuperado.avanzarFase();
        assertEquals(investigador, actor(recuperado).nombre());
        assertEquals(2, recuperado.partida().ronda());
        assertEquals(2, recuperado.partida().mazoRoles().cartas().size());
    }

    @Test void estadisticoConservaBonificacionYNoPuedeRepetirHabilidad() {
        var motor = comenzar(new EstadisticoHabilidad(), new PreDoctoralHabilidad());
        actor(motor).iniciarEstudio(new IdeaCarta("Publicado", 1, 1, 5));
        actor(motor).trabajarEstudio(0, 1);
        motor.partida().tablero().agregarEstudio(actor(motor).estudios().get(0));
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        var json = new SerializadorPartidaJson();
        var recuperado = vacio();
        recuperado.recuperarPartida(json.deserializar(json.serializar(motor.guardarPartida())));
        assertEquals(6, actor(recuperado).prestigio());
        assertEquals(1, actor(recuperado).estudios().get(0).prestigioExtra());
        assertTrue(recuperado.partida().habilidadUsada());
        assertThrows(IllegalStateException.class, () -> recuperado.ejecutarAccion(new UsarHabilidadAccion(0)));
    }

    @Test void tableroRecuperadoComparteLosEstudiosCorrectosYEditorialNoCobraDosVeces() {
        var motor = comenzar(new PreDoctoralHabilidad(), new EditorialHabilidad());
        actor(motor).iniciarEstudio(new IdeaCarta("Publicado", 1, 1, 5));
        actor(motor).trabajarEstudio(0, 1);
        motor.partida().tablero().agregarEstudio(actor(motor).estudios().get(0));
        motor.avanzarFase();
        assertEquals(3, actor(motor).monedas());
        motor.ejecutarAccion(new IniciarEstudioAccion(0));
        var recuperado = vacio();
        recuperado.recuperarPartida(motor.guardarPartida());
        assertEquals(2, actor(recuperado).monedas());
        assertSame(actor(recuperado).estudios().get(0), recuperado.partida().tablero().estudiosEnMesa().get(1));
        recuperado.ejecutarAccion(new TrabajarAccion(0));
        actor(recuperado).trabajarEstudio(0, 1);
        assertEquals(2, recuperado.partida().tablero().cantidadEstudiosPublicados());
        assertEquals(4, actor(recuperado).prestigio());
        assertEquals(1, recuperado.historial().stream().filter(e -> e.tipo().equals("habilidad.editorial.inicio")).count());
    }

    @Test void conservaVetosProteccionesYReferenciasDeRolTrasJson() {
        var motor = comenzar(new ComiteEticaHabilidad(), new InvestigadorPrincipalHabilidad(), new DecanaHabilidad());
        String vetado = motor.partida().jugadores().stream().filter(j -> j.personaje().ordenTurno() == 2).findFirst().orElseThrow().nombre();
        motor.ejecutarAccion(new UsarHabilidadAccion("Rol 1"));
        motor.contexto().protegerJugador(actor(motor).nombre());
        var json = new SerializadorPartidaJson();
        var guardada = motor.guardarPartida();
        var recuperado = vacio();
        recuperado.recuperarPartida(json.deserializar(json.serializar(guardada)));
        assertTrue(recuperado.contexto().estaVetado(vetado));
        assertTrue(recuperado.contexto().estaProtegido(actor(recuperado).nombre()));
        assertSame(recuperado.partida().mazoRoles().cartasIniciales().get(0), actor(recuperado).personaje());
        recuperado.avanzarFase();
        assertEquals(3, actor(recuperado).personaje().ordenTurno());
        assertTrue(recuperado.contexto().estaProtegido(actor(recuperado).nombre()));
        recuperado.avanzarFase(); recuperado.avanzarFase();
        assertFalse(recuperado.contexto().estaVetado(vetado));
        assertTrue(recuperado.partida().jugadores().stream().noneMatch(j -> recuperado.contexto().estaProtegido(j.nombre())));
    }

    @Test void comitePuedeVetarConRolesReconstruidos() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        var recuperado = vacio();
        recuperado.recuperarPartida(motor.guardarPartida());
        recuperado.ejecutarAccion(new UsarHabilidadAccion("Rol 1"));
        recuperado.avanzarFase();
        assertEquals(FaseDeTurno.FIN_RONDA, recuperado.partida().faseActual());
    }

    @Test void guardaFinDeRondaYFinDePartidaSinDuplicarEventos() {
        var motor = comenzar(new PreDoctoralHabilidad());
        for (int i = 0; i < 3; i++) {
            actor(motor).iniciarEstudio(new IdeaCarta("Publicado " + i, 1, 1, 5));
            actor(motor).trabajarEstudio(i, 1);
        }
        motor.avanzarFase();
        var recuperado = vacio();
        recuperado.recuperarPartida(motor.guardarPartida());
        assertEquals(FaseDeTurno.FIN_RONDA, recuperado.partida().faseActual());
        recuperado.avanzarFase();
        assertEquals(FaseDeTurno.FIN_PARTIDA, recuperado.partida().faseActual());
        var finalizado = vacio();
        finalizado.recuperarPartida(recuperado.guardarPartida());
        assertEquals(1, finalizado.partida().ganadores().size());
        assertThrows(IllegalStateException.class, finalizado::avanzarFase);
        assertEquals(1, finalizado.historial().stream().filter(e -> e.tipo().equals("partida.fin")).count());
    }

    @ParameterizedTest @EnumSource(InstantaneaPartida.TipoHabilidad.class)
    void jsonReconstruyeLasOchoEstrategias(InstantaneaPartida.TipoHabilidad tipo) {
        var motor = comenzar(tipo.crear());
        var json = new SerializadorPartidaJson();
        var guardada = motor.guardarPartida();
        var recuperado = vacio();
        recuperado.recuperarPartida(json.deserializar(json.serializar(guardada)));
        assertEquals(tipo.crear().getClass(), actor(recuperado).personaje().habilidad().getClass());
        assertEquals(guardada.partida(), recuperado.partida().guardar());
    }

    @Test void jsonEnArchivoEsLegibleYRecuperaElEstadoCompleto() throws Exception {
        var motor = comenzar(new PreDoctoralHabilidad());
        motor.ejecutarAccion(new IniciarEstudioAccion(0));
        var guardada = motor.guardarPartida();
        Path archivo = temporal.resolve("partida.json");
        var json = new SerializadorPartidaJson();
        json.escribir(archivo, guardada);
        assertTrue(Files.readString(archivo).contains("Artículo"));
        assertEquals(guardada, json.leer(archivo));
        json.escribir(archivo, guardada);
        try (var archivos = Files.list(temporal)) { assertEquals(1, archivos.count()); }
    }

    @Test void rechazaJsonInvalidoSinModificarPartidaEnCurso() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var json = new SerializadorPartidaJson();
        var guardada = motor.guardarPartida();
        String original = json.serializar(guardada);
        var estado = motor.partida();
        int eventos = motor.historial().size();
        for (String invalido : List.of("null", "{}", "{", original.replace("\"version\": 1", "\"version\": 99"),
                original.replace("\"accionesRealizadas\": 0", "\"accionesRealizadas\": 3"),
                original.replace("\"accionesRealizadas\": 0,", ""),
                original.replace("\"habilidadUsada\": false", "\"habilidadUsada\": null"),
                original.replace("\"jugadorActual\": 0", "\"jugadorActual\": 99"),
                original.replace("\"PREDOCTORAL\"", "\"DESCONOCIDA\""))) {
            assertThrows(IllegalArgumentException.class, () -> motor.recuperarPartida(json.deserializar(invalido)));
            assertSame(estado, motor.partida());
            assertEquals(eventos, motor.historial().size());
        }
    }

    @Test void historialConservaOrdenErroresYRecuperacionesSinRebobinarElRegistro() {
        var motor = comenzar(new PreDoctoralHabilidad());
        var guardada = motor.guardarPartida();
        motor.ejecutarAccion(new CobrarAccion());
        motor.ejecutarAccion(new CobrarAccion());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        var antes = motor.historial();
        motor.recuperarPartida(guardada);
        var despues = motor.historial();
        assertEquals(antes.size() + 1, despues.size());
        assertEquals("partida.recuperada", despues.get(despues.size() - 1).tipo());
        assertTrue(despues.stream().anyMatch(e -> e.tipo().equals("accion.rechazada")));
        for (int i = 0; i < despues.size(); i++) assertEquals(i + 1, despues.get(i).numero());
        assertThrows(UnsupportedOperationException.class, despues::clear);
        assertThrows(UnsupportedOperationException.class, () -> despues.get(0).datos().clear());
        assertTrue(guardada.eventos().size() < despues.size());
    }

    @Test void consolaPermiteGuardarYCargarEnMedioDeUnTurnoYDeUnaPregunta() {
        var motor = comenzar(new PreDoctoralHabilidad());
        new ConsolaJuego(motor, new Scanner("1\nguardar\n2\n3\ncargar\nsalir\n")).ejecutar();
        assertEquals(4, actor(motor).monedas());
        assertEquals(2, actor(motor).cartasIdea().size());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
        assertTrue(actor(motor).estudios().isEmpty());
    }

    @Test void guardarSinIniciarSeRechaza() {
        assertThrows(IllegalStateException.class, () -> vacio().guardarPartida());
    }
}
