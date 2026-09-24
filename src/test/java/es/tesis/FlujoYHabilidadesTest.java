package es.tesis;

import es.tesis.acciones.*;
import es.tesis.dominio.*;
import es.tesis.eventos.*;
import es.tesis.habilidades.*;
import es.tesis.motor.*;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FlujoYHabilidadesTest {
    private final List<EventoJuego> eventos = new ArrayList<>();

    private MotorJuegoImpl preparar(HabilidadPersonaje... habilidades) {
        var roles = new ArrayList<Personaje>();
        var jugadores = new ArrayList<Jugador>();
        var ideas = new ArrayList<IdeaCarta>();
        for (int i = 0; i < Math.max(3, habilidades.length); i++) {
            roles.add(new Personaje("Rol " + i, i + 1, i < habilidades.length ? habilidades[i] : new PreDoctoralHabilidad()));
            jugadores.add(new Jugador("Jugador " + i));
            ideas.add(new IdeaCarta("Idea A " + i, 1, 3, 4));
            ideas.add(new IdeaCarta("Idea B " + i, 1, 3, 4));
        }
        roles.add(new Personaje("Otro descarte", 98, new PreDoctoralHabilidad()));
        roles.add(new Personaje("Descartado", 99, new PreDoctoralHabilidad()));
        // El descarte determinista permite probar roles específicos sin depender del azar.
        var mazo = new Mazo<Personaje>(roles) {
            @Override public Personaje robarAleatoria() { return retirar(cartas().size() - 1); }
        };
        var bus = new BusEventosSimple();
        bus.registrar(eventos::add);
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), bus);
        motor.iniciarPartida(new Partida(jugadores, mazo, new Mazo<>(ideas)));
        return motor;
    }

    private MotorJuegoImpl comenzar(HabilidadPersonaje... habilidades) {
        var motor = preparar(habilidades);
        while (motor.partida().faseActual() == FaseDeTurno.SELECCION_ROLES) {
            motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        }
        return motor;
    }

    private Jugador conRol(MotorJuego motor, int orden) {
        return motor.partida().jugadores().stream().filter(j -> j.personaje().ordenTurno() == orden).findFirst().orElseThrow();
    }

    private Estudio estudio(Jugador jugador, int trabajo, boolean publicado) {
        jugador.iniciarEstudio(new IdeaCarta("Estudio", 1, publicado ? 1 : 3, 4));
        int indice = jugador.estudios().size() - 1;
        if (trabajo > 0) jugador.trabajarEstudio(indice, trabajo);
        return jugador.estudios().get(indice);
    }

    @Test void seleccionIncompletaRepetidaYFueraDeFaseSeRechazaSinMutar() {
        var motor = preparar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        int cartas = motor.partida().mazoRoles().cartas().size();
        new EstadoSeleccionRoles().entrar(motor.contexto());
        assertEquals(cartas, motor.partida().mazoRoles().cartas().size());
        assertEquals(1, eventos.stream().filter(e -> e.tipo().equals("fase.seleccion_roles")).count());
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new SeleccionarPersonajeAccion(-1)));
        motor.contexto().jugadorActual().asignarPersonaje(motor.partida().mazoRoles().cartas().get(0));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new SeleccionarPersonajeAccion(0)));
        motor.contexto().jugadorActual().asignarPersonaje(null);
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new SeleccionarPersonajeAccion(0)));
    }

    @Test void seleccionSigueLaMesaPeroTurnosSiguenLosRoles() {
        var motor = preparar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        Jugador primero = motor.contexto().jugadorActual();
        int indice = motor.partida().jugadores().indexOf(primero);
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(2));
        assertSame(motor.partida().jugadores().get((indice + 1) % 3), motor.contexto().jugadorActual());
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(1));
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        for (int orden = 1; orden <= 3; orden++) {
            assertEquals(orden, motor.contexto().jugadorActual().personaje().ordenTurno());
            motor.avanzarFase();
        }
        assertEquals(FaseDeTurno.FIN_RONDA, motor.partida().faseActual());
    }

    @ParameterizedTest @ValueSource(ints = {1, 2, 3})
    void tercerArticuloCierraSoloAlFinalDeRondaYBloqueaTodo(int orden) {
        var motor = comenzar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        Jugador autor = conRol(motor, orden);
        estudio(autor, 1, true);
        estudio(autor, 1, true);
        estudio(autor, 0, true);
        for (int turno = 1; turno <= 3; turno++) {
            if (turno == orden) motor.ejecutarAccion(new TrabajarAccion(2));
            assertEquals(FaseDeTurno.TURNO_JUGADOR, motor.partida().faseActual());
            motor.avanzarFase();
        }
        assertEquals(FaseDeTurno.FIN_RONDA, motor.partida().faseActual());
        motor.avanzarFase();
        assertEquals(FaseDeTurno.FIN_PARTIDA, motor.partida().faseActual());
        assertEquals(List.of(autor), motor.partida().ganadores());
        int cantidadEventos = eventos.size();
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        for (AccionTurno accion : List.of(new CobrarAccion(), new PensarAccion(), new TrabajarAccion(0),
                new IniciarEstudioAccion(0), new SeleccionarPersonajeAccion(0), new UsarHabilidadAccion(0))) {
            assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(accion));
        }
        assertEquals(cantidadEventos, eventos.size());
        assertEquals(1, eventos.stream().filter(e -> e.tipo().equals("partida.fin")).count());
    }

    @Test void empateEnPrestigioComparteVictoria() {
        var motor = comenzar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        for (Jugador jugador : motor.partida().jugadores()) for (int i = 0; i < 3; i++) estudio(jugador, 1, true);
        motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase();
        assertEquals(3, motor.partida().ganadores().size());
    }

    @Test void comiteVetaPorRolYSaltaTurnoIncluidaHabilidadAutomatica() {
        var motor = comenzar(new ComiteEticaHabilidad(), new InvestigadorPrincipalHabilidad(), new PreDoctoralHabilidad());
        Jugador vetado = conRol(motor, 2);
        motor.partida().mazoIdeas().añadir(new IdeaCarta("Extra", 1, 1, 1));
        motor.ejecutarAccion(new UsarHabilidadAccion("rol 1"));
        assertTrue(motor.contexto().estaVetado(vetado.nombre()));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Rol 2")));
        motor.avanzarFase();
        assertEquals(3, motor.contexto().jugadorActual().personaje().ordenTurno());
        assertEquals(2, vetado.cartasIdea().size());
        assertEquals(1, eventos.stream().filter(e -> e.tipo().equals("turno.vetado")).count());
        motor.avanzarFase(); motor.avanzarFase();
        assertFalse(motor.contexto().estaVetado(vetado.nombre()));
        assertEquals(0, motor.partida().accionesBaseRealizadas());
        assertFalse(motor.partida().habilidadUsada());
        assertTrue(motor.partida().jugadores().stream().allMatch(j -> j.personaje() == null));
        assertEquals(3, motor.partida().mazoRoles().cartas().size());
        assertEquals(2, eventos.stream().filter(e -> e.tipo().equals("fase.seleccion_roles")).count());
    }

    @Test void comiteDebeResolverVetoAntesDeCualquierAccionOFinDeTurno() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        var actor = motor.contexto().jugadorActual();
        var antes = motor.partida().guardar();
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Inexistente")));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Rol 0")));
        assertFalse(motor.partida().habilidadUsada());
        for (var accion : java.util.List.of(new CobrarAccion(), new PensarAccion(),
                new IniciarEstudioAccion(0), new TrabajarAccion(0))) {
            var error = assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(accion));
            assertTrue(error.getMessage().contains("habilidad inicial"));
        }
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        assertEquals(antes, motor.partida().guardar());
        motor.ejecutarAccion(new UsarHabilidadAccion("Rol 1"));
        motor.ejecutarAccion(new CobrarAccion());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Rol 1")));
        assertEquals(1, motor.partida().accionesBaseRealizadas());
        assertEquals(4, actor.monedas());
        motor.avanzarFase(); motor.avanzarFase();
        assertEquals(FaseDeTurno.FIN_RONDA, motor.partida().faseActual());
    }

    @Test void cargarPartidaConVetoPendienteConservaLaObligacion() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        var guardada = motor.guardarPartida();
        motor.ejecutarAccion(new UsarHabilidadAccion("Descartado"));
        motor.recuperarPartida(guardada);
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        assertThrows(IllegalStateException.class, motor::avanzarFase);
        motor.ejecutarAccion(new UsarHabilidadAccion("Descartado"));
        motor.recuperarPartida(motor.guardarPartida());
        motor.ejecutarAccion(new CobrarAccion());
        motor.avanzarFase();
        assertEquals(2, motor.contexto().jugadorActual().personaje().ordenTurno());
    }

    @Test void nombrarRolDescartadoConsumeHabilidadSinVetar() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        motor.ejecutarAccion(new UsarHabilidadAccion("Descartado"));
        assertTrue(motor.partida().habilidadUsada());
        assertTrue(motor.partida().jugadores().stream().noneMatch(j -> motor.contexto().estaVetado(j.nombre())));
    }

    @Test void guardadoAntiguoConAccionesPreviasAlVetoSeRechazaSinCambiarPartida() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        // Simular el estado que permitía la versión anterior.
        motor.partida().registrarAccionBase();
        var incompatible = motor.guardarPartida();
        var destino = comenzar(new PreDoctoralHabilidad());
        var antes = destino.partida().guardar();
        assertThrows(IllegalArgumentException.class, () -> destino.recuperarPartida(incompatible));
        assertEquals(antes, destino.partida().guardar());
    }

    @Test void otrosPersonajesPuedenActuarYTerminarSinHabilidadActiva() {
        for (var habilidad : java.util.List.of(new EstadisticoHabilidad(), new PlagiadorHabilidad(),
                new InvestigadorPrincipalHabilidad(), new DecanaHabilidad(), new EditorialHabilidad(),
                new PreDoctoralHabilidad(), new Revisor2Habilidad())) {
            var motor = comenzar(habilidad);
            motor.ejecutarAccion(new CobrarAccion());
            motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase();
            assertEquals(FaseDeTurno.FIN_RONDA, motor.partida().faseActual());
        }
    }

    @Test void decanaInmuneAlComiteAntesDeSuTurnoYLimpiaAlCambiarRonda() {
        var motor = comenzar(new ComiteEticaHabilidad(), new DecanaHabilidad());
        Jugador decana = conRol(motor, 2);
        assertTrue(motor.contexto().estaProtegido(decana.nombre()));
        motor.ejecutarAccion(new UsarHabilidadAccion("Rol 1"));
        assertFalse(motor.contexto().estaVetado(decana.nombre()));
        motor.avanzarFase();
        assertSame(decana, motor.contexto().jugadorActual());
        motor.ejecutarAccion(new CobrarAccion());
        motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase();
        assertFalse(motor.contexto().estaProtegido(decana.nombre()));
    }

    @Test void estadisticoEligePublicacionPropiaYBonificaSoloUnaVez() {
        var motor = comenzar(new EstadisticoHabilidad(), new PreDoctoralHabilidad());
        Jugador actor = motor.contexto().jugadorActual();
        estudio(actor, 0, false);
        Estudio publicado = estudio(actor, 1, true);
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(-1)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(2)));
        assertFalse(motor.partida().habilidadUsada());
        motor.ejecutarAccion(new UsarHabilidadAccion(1));
        assertEquals(1, publicado.prestigioExtra());
        assertEquals(5, actor.prestigio());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(1)));
        assertEquals(5, actor.prestigio());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
    }

    @Test void plagiadorIntercambiaManosIncluidaManoVaciaUnaSolaVez() {
        var motor = comenzar(new PlagiadorHabilidad(), new PreDoctoralHabilidad());
        Jugador actor = motor.contexto().jugadorActual();
        Jugador otro = conRol(motor, 2);
        var mano = List.copyOf(actor.cartasIdea());
        while (!otro.cartasIdea().isEmpty()) otro.retirarCartaIdea(0);
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre())));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Nadie")));
        motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre()));
        assertTrue(actor.cartasIdea().isEmpty());
        assertEquals(mano, otro.cartasIdea());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre())));
    }

    @Test void decanaBloqueaPlagioAntesDeSuTurno() {
        var motor = comenzar(new PlagiadorHabilidad(), new DecanaHabilidad());
        var mano = List.copyOf(motor.contexto().jugadorActual().cartasIdea());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(conRol(motor, 2).nombre())));
        assertEquals(mano, motor.contexto().jugadorActual().cartasIdea());
        assertFalse(motor.partida().habilidadUsada());
    }

    @Test void investigadorRobaCartaYPasaASerSelectorInclusoConMazoVacio() {
        var motor = comenzar(new PreDoctoralHabilidad(), new InvestigadorPrincipalHabilidad());
        Jugador investigador = conRol(motor, 2);
        motor.partida().mazoIdeas().añadir(new IdeaCarta("Extra", 1, 1, 1));
        motor.avanzarFase();
        assertEquals(3, investigador.cartasIdea().size());
        motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase();
        assertSame(investigador, motor.contexto().jugadorActual());
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(1));
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        motor.avanzarFase();
        assertSame(investigador, motor.contexto().jugadorActual());
        assertEquals(3, investigador.cartasIdea().size());
        assertEquals(investigador.nombre(), motor.contexto().jugadorInicialSiguienteRonda());
    }

    @Test void revisorEligeEstudioPagaUnaMonedaYNoRepite() {
        var motor = comenzar(new Revisor2Habilidad(), new PreDoctoralHabilidad());
        Jugador actor = motor.contexto().jugadorActual();
        Jugador otro = conRol(motor, 2);
        Estudio primero = estudio(otro, 1, false);
        Estudio segundo = estudio(otro, 1, false);
        motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), 1));
        assertEquals(1, actor.monedas());
        assertEquals(1, primero.trabajoAcumulado());
        assertEquals(0, segundo.trabajoAcumulado());
        assertEquals(EstadoEstudio.EN_DESARROLLO, segundo.estado());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), 0)));
    }

    @Test void revisorRechazaPublicadosSinModificarPrestigioTrabajoNiMonedas() {
        var motor = comenzar(new Revisor2Habilidad(), new PreDoctoralHabilidad());
        var otro = conRol(motor, 2);
        otro.iniciarEstudio(new IdeaCarta("Publicado", 1, 3, 4));
        otro.trabajarEstudio(0, 4);
        otro.estudios().get(0).añadirPrestigioExtra(); otro.sumarPrestigio(1);
        motor.partida().tablero().agregarEstudio(otro.estudios().get(0));
        var antes = motor.partida().guardar();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), 0)));
        assertEquals(antes, motor.partida().guardar());
        var recuperado = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        recuperado.recuperarPartida(motor.guardarPartida());
        assertEquals(antes, recuperado.partida().guardar());
    }

    @Test void patenteCobraSoloPublicadaAlInicioYNoDuplicaIngresosAlRecuperar() {
        var motor = comenzar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        var titular = conRol(motor, 2);
        var patente = FabricaMazos.crearIdeas().cartas().stream().filter(c -> c.nombre().equals("Patente")).findFirst().orElseThrow();
        titular.iniciarEstudio(patente); titular.iniciarEstudio(patente);
        titular.trabajarEstudio(0,5);
        motor.avanzarFase();
        assertEquals(4,titular.monedas());
        var json = new es.tesis.persistencia.SerializadorPartidaJson();
        var recuperado = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        recuperado.recuperarPartida(json.deserializar(json.serializar(motor.guardarPartida())));
        var restaurado = conRol(recuperado,2);
        assertEquals(4,restaurado.monedas());
        assertEquals(2,restaurado.estudios().get(0).carta().ingresoPorTurno());
        restaurado.revisarEstudio(0);
        new EstadoTurno().entrar(recuperado.contexto());
        assertEquals(4,restaurado.monedas());
        restaurado.trabajarEstudio(0,2); restaurado.trabajarEstudio(1,5);
        assertEquals(4,restaurado.monedas());
        new EstadoTurno().entrar(recuperado.contexto());
        assertEquals(8,restaurado.monedas());
        assertEquals(10,restaurado.prestigio());
    }

    @Test void revisorRetiraDosPuntosDeUnEstudioEnDesarrollo() {
        var motor = comenzar(new Revisor2Habilidad(), new PreDoctoralHabilidad());
        Jugador otro = conRol(motor, 2);
        estudio(otro, 2, false);
        motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), 0));
        assertEquals(0, otro.estudios().get(0).trabajoAcumulado());
        assertEquals(1, motor.contexto().jugadorActual().monedas());
        assertEquals(0, motor.partida().accionesBaseRealizadas());
    }

    @Test void revisorRechazaObjetivosInvalidosSinCobrarNiConsumirUso() {
        var motor = comenzar(new Revisor2Habilidad(), new PreDoctoralHabilidad());
        Jugador actor = motor.contexto().jugadorActual();
        Jugador otro = conRol(motor, 2);
        estudio(otro, 0, false);
        estudio(otro, 1, true);
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion("Nadie", 0)));
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), -1)));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(otro.nombre(), 0)));
        assertEquals(2, actor.monedas());
        assertFalse(motor.partida().habilidadUsada());
        estudio(actor, 1, false);
        actor.gastarMonedas(2);
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre(), 0)));
        assertEquals(1, actor.estudios().get(0).trabajoAcumulado());
    }

    @Test void decanaBloqueaRevisionDespuesDeSuTurno() {
        var motor = comenzar(new DecanaHabilidad(), new Revisor2Habilidad());
        Jugador decana = motor.contexto().jugadorActual();
        Estudio estudio = estudio(decana, 1, false);
        motor.avanzarFase();
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(decana.nombre(), 0)));
        assertEquals(1, estudio.trabajoAcumulado());
        assertEquals(2, motor.contexto().jugadorActual().monedas());
    }

    @Test void validaPreparacionSinJugadoresRolesOIdeasSuficientes() {
        var rol = new Personaje("Rol", 1, new PreDoctoralHabilidad());
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(new Partida(List.of(), new Mazo<>(List.of(rol)), new Mazo<>(List.of()))));
        var jugadores = List.of(new Jugador("A"), new Jugador("B"), new Jugador("C"));
        // Cuatro roles ya no bastan para tres jugadores y dos descartes.
        var pocosRoles = new Mazo<>(FabricaMazos.crearRoles().cartas().subList(0, 4));
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(new Partida(jugadores, pocosRoles, FabricaMazos.crearIdeas())));
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(new Partida(jugadores, FabricaMazos.crearRoles(), new Mazo<>(List.of()))));
        assertTrue(jugadores.stream().allMatch(j -> j.monedas() == 0 && j.cartasIdea().isEmpty()));
        assertEquals(4, pocosRoles.cartas().size());
        assertNull(motor.partida());
    }

    @Test void repartoInicialYReinicioDelMotorNoDuplicanRecursos() {
        var motor = preparar(new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        for (Jugador jugador : motor.partida().jugadores()) {
            assertEquals(2, jugador.monedas());
            assertEquals(2, jugador.cartasIdea().size());
        }
        assertThrows(IllegalStateException.class, () -> motor.iniciarPartida(motor.partida()));
        assertEquals(2, motor.contexto().jugadorActual().monedas());
    }

    @Test void ultimoTurnoVetadoLlevaAFinRondaSinActivarHabilidad() {
        var motor = comenzar(new ComiteEticaHabilidad(), new PreDoctoralHabilidad(), new InvestigadorPrincipalHabilidad());
        Jugador ultimo = conRol(motor, 3);
        motor.ejecutarAccion(new UsarHabilidadAccion("Rol 2"));
        motor.avanzarFase(); motor.avanzarFase();
        assertEquals(FaseDeTurno.FIN_RONDA, motor.partida().faseActual());
        assertEquals(2, ultimo.cartasIdea().size());
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new CobrarAccion()));
        assertThrows(IllegalStateException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(0)));
    }

    @Test void habilidadSePuedeVolverAUsarEnOtraRonda() {
        var motor = comenzar(new EstadisticoHabilidad());
        Jugador actor = motor.contexto().jugadorActual();
        estudio(actor, 1, true);
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase(); motor.avanzarFase();
        while (motor.partida().faseActual() == FaseDeTurno.SELECCION_ROLES) motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        assertSame(actor, motor.contexto().jugadorActual());
        assertFalse(motor.partida().habilidadUsada());
        motor.ejecutarAccion(new UsarHabilidadAccion(0));
        assertEquals(6, actor.prestigio());
        assertEquals(2, actor.estudios().get(0).prestigioExtra());
    }

    @Test void revisorRechazaEstudioPropioSinConsumirMonedasNiHabilidad() {
        var motor = comenzar(new Revisor2Habilidad());
        Jugador actor = motor.contexto().jugadorActual();
        estudio(actor, 1, false);
        var antes = motor.partida().guardar();
        assertThrows(IllegalArgumentException.class, () -> motor.ejecutarAccion(new UsarHabilidadAccion(actor.nombre(), 0)));
        assertEquals(antes, motor.partida().guardar());
    }

    @Test void dominioImpideTrabajoNegativo() {
        var jugador = new Jugador("Ana");
        var articulo = estudio(jugador, 1, false);
        articulo.retirarTrabajo();
        assertEquals(0, articulo.trabajoAcumulado());
        assertThrows(IllegalStateException.class, articulo::retirarTrabajo);
        assertThrows(IllegalArgumentException.class, () -> articulo.agregarTrabajo(-1));
        assertEquals(0, articulo.trabajoAcumulado());
        assertThrows(IllegalArgumentException.class, () -> new IdeaCarta("Inválida", -1, 1, 1));
        assertThrows(IllegalArgumentException.class, () -> new IdeaCarta("Inválida", 1, 0, 1));
        assertThrows(IllegalArgumentException.class, () -> jugador.gastarMonedas(-1));
    }

    @Test void rechazaNombresYOrdenesDuplicadosAntesDeRepartir() {
        var habilidad = new PreDoctoralHabilidad();
        var roles = FabricaMazos.crearRoles().cartas();
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(new Partida(
                List.of(new Jugador("Ana"), new Jugador("ANA"), new Jugador("Clara")), new Mazo<>(roles), FabricaMazos.crearIdeas())));
        var duplicados = new ArrayList<>(roles);
        duplicados.set(1, new Personaje("Otro", 1, habilidad));
        assertThrows(IllegalArgumentException.class, () -> motor.iniciarPartida(new Partida(
                List.of(new Jugador("Ana"), new Jugador("Bruno"), new Jugador("Clara")), new Mazo<>(duplicados), FabricaMazos.crearIdeas())));
        assertNull(motor.partida());
    }
}
