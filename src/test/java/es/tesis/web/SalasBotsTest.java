package es.tesis.web;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class SalasBotsTest {
    private static final class Reloj extends Clock {
        Instant ahora = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zona) { return this; }
        public Instant instant() { return ahora; }
        void avanzar(long ms) { ahora = ahora.plusMillis(ms); }
    }
    private final Reloj reloj = new Reloj();
    private static final Set<String> DECISION = Set.of("SELECCION_ROLES", "TURNO_JUGADOR");

    private static boolean turnoDe(Vistas.Sala vista, String nombre) {
        return DECISION.contains(vista.partida().fase()) && vista.partida().actual().equals(nombre);
    }
    private static Vistas.Sala jugar(SalaJuego sala, String token, Vistas.Sala vista, Random azar) {
        var decision = CerebroBot.decidir(vista.partida(), azar);
        return sala.actuar(token, new Vistas.Peticion(vista.revision(), decision.tipo(), decision.indice(), decision.objetivo(), null));
    }
    /** Avanza la mesa hasta su final; la persona juega con el mismo criterio que los bots. */
    private void terminar(SalaJuego sala, String token, String nombre) {
        var azar = new Random(7);
        for (int paso = 0; paso < 20_000 && !sala.estado(token).fase().equals("FINALIZADA"); paso++) {
            var vista = sala.estado(token);
            if (turnoDe(vista, nombre)) { jugar(sala, token, vista, azar); continue; }
            if (DECISION.contains(vista.partida().fase())) {
                assertTrue(vista.partida().acciones().isEmpty());
                assertTrue(vista.partida().seleccion().isEmpty());
            }
            if (vista.partida().fase().equals("SELECCION_ROLES"))
                assertTrue(vista.partida().jugadores().stream().filter(j -> !j.nombre().equals(nombre)).allMatch(j -> j.rol() == null));
            reloj.avanzar(1_400);
        }
    }

    @ParameterizedTest @ValueSource(ints = {3, 4, 5})
    void botsCompletanLaMesaYJueganHastaElFinal(int cantidad) {
        var salas = new GestorSalas(reloj, Duration.ofHours(24));
        var acceso = salas.crearPartidaConBots("Ana", null, CosmeticosPartida.originales(), cantidad);
        var sala = salas.buscar(acceso.codigo());
        var inicial = acceso.sala();
        assertEquals("EN_PARTIDA", inicial.fase());
        assertEquals("Ana", inicial.jugadores().get(0));
        assertTrue(inicial.soyAnfitrion());
        assertEquals(cantidad, new TreeSet<>(inicial.jugadores()).size());
        assertEquals("INVITADO", inicial.progreso().estado());
        assertEquals(cantidad, inicial.partida().jugadores().size());
        assertTrue(CerebroBot.nombres().containsAll(inicial.jugadores().subList(1, cantidad)));
        assertFalse(new com.google.gson.Gson().toJson(inicial).toLowerCase(Locale.ROOT).contains("bot"));
        assertEquals(2, inicial.partida().mano().size());

        terminar(sala, acceso.playerToken(), "Ana");
        var fin = sala.estado(acceso.playerToken());
        assertEquals("FINALIZADA", fin.fase());
        assertFalse(fin.partida().ganadores().isEmpty());
        assertTrue(fin.partida().jugadores().stream().anyMatch(j -> j.publicados() >= 3));
        assertTrue(fin.partida().jugadores().stream().filter(j -> !j.nombre().equals("Ana")).allMatch(j -> !j.estudios().isEmpty()));
    }

    @Test void botRespetaSuPausaYCadaJugadaAumentaLaRevision() {
        var salas = new GestorSalas(reloj, Duration.ofHours(24));
        var acceso = salas.crearPartidaConBots("Ana", null, CosmeticosPartida.originales(), 3);
        var sala = salas.buscar(acceso.codigo()); String token = acceso.playerToken();
        var azar = new Random(3);
        var vista = sala.estado(token);
        while (turnoDe(vista, "Ana")) vista = jugar(sala, token, vista, azar);
        assertNotEquals("Ana", vista.partida().actual());
        long revision = sala.estado(token).revision();
        reloj.avanzar(1_399);
        assertEquals(revision, sala.estado(token).revision());
        reloj.avanzar(1);
        assertEquals(revision + 1, sala.estado(token).revision());
        assertEquals(revision + 1, sala.estado(token).revision());
        // La jugada de un bot invalida, como cualquier otra, una petición con revisión antigua.
        assertEquals(409, assertThrows(ErrorSala.class,
                () -> sala.actuar(token, new Vistas.Peticion(revision, "COBRAR", null, null, null))).estado);
    }

    @Test void nombreDeBotOcupadoPorLaPersonaNoSeRepite() {
        var salas = new GestorSalas(reloj, Duration.ofHours(24));
        var acceso = salas.crearPartidaConBots("LUCÍA", null, CosmeticosPartida.originales(), 5);
        var nombres = new TreeSet<String>(String.CASE_INSENSITIVE_ORDER);
        nombres.addAll(acceso.sala().jugadores());
        assertEquals(5, nombres.size());
        assertThrows(IllegalArgumentException.class, () -> salas.crearPartidaConBots("Ana", null, CosmeticosPartida.originales(), 2));
        assertThrows(IllegalArgumentException.class, () -> salas.crearPartidaConBots("Ana", null, CosmeticosPartida.originales(), 6));
    }

    @Test void partidaConBotsRegistraLaProgresionDeLaCuentaYLosBotsComoInvitados() throws Exception {
        var escrituras = new AtomicInteger();
        var guardados = new java.util.concurrent.atomic.AtomicReference<List<es.tesis.cuentas.CuentasSupabase.Participante>>();
        var guardado = new java.util.concurrent.CountDownLatch(1);
        UUID cuenta = UUID.randomUUID();
        try (var progresion = new ProgresionPartidas((id, hash, fecha, participantes) -> {
            escrituras.incrementAndGet(); guardados.set(participantes); guardado.countDown();
        })) {
            var salas = new GestorSalas(reloj, Duration.ofHours(24), progresion);
            var acceso = salas.crearPartidaConBots("Ana", cuenta, CosmeticosPartida.originales(), 3);
            var sala = salas.buscar(acceso.codigo());
            assertEquals("VINCULADA", acceso.sala().progreso().estado());
            terminar(sala, acceso.playerToken(), "Ana");
            assertEquals("FINALIZADA", sala.estado(acceso.playerToken()).fase());
            assertTrue(guardado.await(10, java.util.concurrent.TimeUnit.SECONDS));
            String estado = "";
            for (int i = 0; i < 200 && !estado.equals("CONFIRMADA"); i++) {
                estado = sala.estado(acceso.playerToken()).progreso().estado();
                if (!estado.equals("CONFIRMADA")) Thread.sleep(25);
            }
            var fin = sala.estado(acceso.playerToken()).progreso();
            assertEquals("CONFIRMADA", fin.estado());
            assertTrue(Set.of(200, 300).contains(fin.xp()));
            assertNotNull(fin.partidaId());
        }
        assertEquals(1, escrituras.get());
        assertEquals(3, guardados.get().size());
        assertEquals(1, guardados.get().stream().filter(p -> cuenta.equals(p.user_id())).count());
        assertEquals(2, guardados.get().stream().filter(p -> p.user_id() == null).count());
    }
}
