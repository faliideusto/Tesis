package es.tesis.web;

import org.junit.jupiter.api.Test;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class TemporizadorTurnoTest {
    private static final class Reloj extends Clock {
        Instant ahora = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zona) { return this; }
        public Instant instant() { return ahora; }
        void avanzar(long ms) { ahora = ahora.plusMillis(ms); }
    }
    private final Reloj reloj = new Reloj();
    private final SalaJuego sala = new SalaJuego("ABCDE", reloj, new SecureRandom());
    private final Map<String, String> tokens = new LinkedHashMap<>();

    private Vistas.Sala iniciada(int cantidad) {
        for (int i = 0; i < cantidad; i++) { var a = sala.unirse("P" + i); tokens.put("P" + i, a.playerToken()); }
        return sala.iniciar(tokens.get("P0"), sala.estado(tokens.get("P0")).revision());
    }
    private Vistas.Sala ver() { return sala.estado(tokens.get("P0")); }
    private Vistas.Sala actuar(String tipo, Integer indice) {
        var v = ver();
        return sala.actuar(tokens.get(v.partida().actual()), new Vistas.Peticion(v.revision(), tipo, indice, null, null));
    }

    @Test void cadaTurnoTieneSesentaSegundosVisiblesParaTodos() {
        var inicio = iniciada(3);
        long limite = reloj.millis() + SalaJuego.LIMITE_TURNO_MS;
        assertEquals(limite, inicio.turnoHasta());
        for (var token : tokens.values()) assertEquals(limite, sala.estado(token).turnoHasta());
        reloj.avanzar(59_999);
        assertEquals(inicio.partida().actual(), ver().partida().actual());
        assertEquals(inicio.revision(), ver().revision());
    }

    @Test void alAgotarseEligePersonajeYCedeLaSeleccion() {
        var inicio = iniciada(3);
        String primero = inicio.partida().actual();
        reloj.avanzar(SalaJuego.LIMITE_TURNO_MS);
        var despues = ver();
        assertNotEquals(primero, despues.partida().actual());
        assertTrue(despues.partida().eventos().stream().anyMatch(e -> e.tipo().equals("turno.tiempo_agotado") && e.actor().equals(primero)));
        assertTrue(despues.partida().eventos().stream().anyMatch(e -> e.tipo().equals("accion.seleccionar_personaje") && e.actor().equals(primero)));
        // El siguiente jugador empieza con su propio minuto completo.
        assertEquals(reloj.millis() + SalaJuego.LIMITE_TURNO_MS, despues.turnoHasta());
    }

    @Test void unaJugadaTardiaRecibeConflictoPorqueElTurnoYaPaso() {
        var inicio = iniciada(3);
        String primero = inicio.partida().actual();
        var propia = sala.estado(tokens.get(primero));
        reloj.avanzar(SalaJuego.LIMITE_TURNO_MS + 1);
        var tarde = new Vistas.Peticion(propia.revision(), "SELECCIONAR", propia.partida().seleccion().get(0).indice(), null, null);
        assertEquals(409, assertThrows(ErrorSala.class, () -> sala.actuar(tokens.get(primero), tarde)).estado);
    }

    @Test void actuarNoReiniciaElTiempoDelTurnoPeroCambiarDeTurnoSi() {
        iniciada(3);
        while (ver().partida().fase().equals("SELECCION_ROLES")) {
            var propia = sala.estado(tokens.get(ver().partida().actual())).partida();
            actuar("SELECCIONAR", propia.seleccion().stream().filter(r -> r.orden() != 1).findFirst().orElseThrow().indice());
        }
        var turno = ver();
        assertEquals("TURNO_JUGADOR", turno.partida().fase());
        long limite = turno.turnoHasta();
        reloj.avanzar(30_000);
        var cobrado = actuar("COBRAR", null);
        assertEquals(limite, cobrado.turnoHasta());
        reloj.avanzar(30_000);
        var siguiente = ver();
        assertNotEquals(turno.partida().actual(), siguiente.partida().actual());
        assertEquals(reloj.millis() + SalaJuego.LIMITE_TURNO_MS, siguiente.turnoHasta());
    }

    @Test void nadieInactivoTerminaLaPartidaSoloConElTemporizador() {
        iniciada(3);
        for (int paso = 0; paso < 2_000 && !ver().fase().equals("FINALIZADA"); paso++) reloj.avanzar(SalaJuego.LIMITE_TURNO_MS);
        // Sin jugadas nadie publica, así que la partida no termina, pero tampoco queda bloqueada.
        var v = ver();
        assertTrue(v.partida().ronda() > 3, "La mesa debe seguir avanzando de ronda en ronda");
        assertTrue(v.partida().eventos().stream().anyMatch(e -> e.tipo().equals("turno.tiempo_agotado")));
    }

    @Test void sinTurnoPendienteNoHayCuentaAtras() {
        for (int i = 0; i < 3; i++) { var a = sala.unirse("P" + i); tokens.put("P" + i, a.playerToken()); }
        assertNull(ver().turnoHasta());
    }

    @Test void losBotsNoUsanElTemporizador() {
        var salas = new GestorSalas(reloj, Duration.ofHours(24));
        var acceso = salas.crearPartidaConBots("Ana", null, CosmeticosPartida.originales(), 3);
        var mesa = salas.buscar(acceso.codigo());
        var vista = mesa.estado(acceso.playerToken());
        for (int i = 0; i < 50 && vista.partida().actual().equals("Ana"); i++) {
            var d = CerebroBot.decidir(vista.partida(), new Random(1));
            vista = mesa.actuar(acceso.playerToken(), new Vistas.Peticion(vista.revision(), d.tipo(), d.indice(), d.objetivo(), null));
        }
        if (!vista.partida().actual().equals("Ana") && Set.of("SELECCION_ROLES", "TURNO_JUGADOR").contains(vista.partida().fase()))
            assertNull(vista.turnoHasta());
    }
}
