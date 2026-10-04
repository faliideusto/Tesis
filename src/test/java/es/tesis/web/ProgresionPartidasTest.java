package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import es.tesis.cuentas.ExcepcionCuenta;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;

class ProgresionPartidasTest {
    static final class Reloj extends Clock {
        Instant ahora = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zona) { return this; }
        public Instant instant() { return ahora; }
    }

    @Test void cuentaUnicaVinculadaSinExponerIdentidadYGuestIndependiente() {
        UUID cuenta = UUID.randomUUID();
        var sala = new SalaJuego("ABCDE", Clock.systemUTC(), new java.security.SecureRandom());
        var acceso = sala.unirse("Ana", cuenta);
        assertEquals("VINCULADA", acceso.sala().progreso().estado());
        assertEquals(409, assertThrows(ErrorSala.class,
                () -> sala.unirse("Otra", UUID.fromString(cuenta.toString()))).estado);
        var invitado = sala.unirse("Guest");
        assertEquals("INVITADO", invitado.sala().progreso().estado());
        String json = new com.google.gson.Gson().toJson(invitado.sala());
        assertFalse(json.contains(cuenta.toString()));
        assertFalse(json.contains(acceso.playerToken()));
        assertThrows(ErrorSala.class, () -> sala.estado(cuenta.toString()));
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void cierreDelMotorManualOAutomaticoEncolaUnaVezYProgresoNoCambiaRevision(boolean automatico) throws Exception {
        var escrituras = new AtomicInteger();
        var capturado = new AtomicReference<List<CuentasSupabase.Participante>>();
        var iniciado = new CountDownLatch(1); var permitir = new CountDownLatch(1);
        var reloj = new Reloj();
        try (var progresion = new ProgresionPartidas((id, hash, fecha, participantes) -> {
            escrituras.incrementAndGet(); capturado.set(participantes); iniciado.countDown();
            try { assertTrue(permitir.await(10, TimeUnit.SECONDS)); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
        })) {
            var sala = new SalaJuego("ABCDE", reloj, new java.security.SecureRandom(), progresion);
            var tokens = new LinkedHashMap<String, String>();
            UUID ana = UUID.randomUUID(), bruno = UUID.randomUUID();
            tokens.put("Ana", sala.unirse("Ana", ana).playerToken());
            tokens.put("Bruno", sala.unirse("Bruno", bruno).playerToken());
            tokens.put("Guest", sala.unirse("Guest").playerToken());
            String host = tokens.get("Ana");
            sala.iniciar(host, sala.estado(host).revision());
            for (int paso = 0; paso < 3000 && !sala.estado(host).fase().equals("FINALIZADA"); paso++) {
                var vista = sala.estado(host);
                var actual = sala.estado(tokens.get(vista.partida().actual()));
                var estado = actual.partida(); String tipo; Integer indice = null; String objetivo = null;
                if (estado.fase().equals("FIN_RONDA")) {
                    if (automatico) { reloj.ahora = reloj.ahora.plusSeconds(5); continue; }
                    tipo = "SIGUIENTE_RONDA";
                } else if (estado.fase().equals("SELECCION_ROLES")) {
                    tipo = "SELECCIONAR";
                    indice = estado.seleccion().stream().filter(r -> r.orden() != 1).findFirst()
                            .orElse(estado.seleccion().get(0)).indice();
                } else {
                    var prioridades = estado.habilidadPendiente() ? List.of("HABILIDAD")
                            : estado.mano().isEmpty() ? List.of("TRABAJAR", "PENSAR", "COBRAR", "FIN_TURNO")
                            : List.of("TRABAJAR", "INICIAR", "COBRAR", "FIN_TURNO");
                    Vistas.Accion elegida = null;
                    for (String id : prioridades) {
                        elegida = estado.acciones().stream().filter(a -> a.id().equals(id) && a.disponible()).findFirst().orElse(null);
                        if (elegida != null) break;
                    }
                    assertNotNull(elegida); tipo = elegida.id();
                    if (!elegida.opciones().isEmpty()) {
                        var opcion = elegida.opciones().get(0); indice = opcion.indice(); objetivo = opcion.objetivo();
                    }
                }
                sala.actuar(tokens.get(actual.yo()), new Vistas.Peticion(actual.revision(), tipo, indice, objetivo, null));
            }
            var finalizada = sala.estado(host);
            assertEquals("FINALIZADA", finalizada.fase());
            assertTrue(iniciado.await(5, TimeUnit.SECONDS));
            assertEquals("PENDIENTE", finalizada.progreso().estado());
            var pool = Executors.newFixedThreadPool(8);
            try {
                var solicitudes = new ArrayList<Future<Vistas.Sala>>();
                for (int i = 0; i < 64; i++) solicitudes.add(pool.submit(() -> sala.estado(host)));
                for (var solicitud : solicitudes) assertEquals(finalizada.revision(), solicitud.get().revision());
            } finally { pool.shutdownNow(); }
            assertEquals(1, escrituras.get());
            var filas = capturado.get(); assertEquals(3, filas.size());
            assertEquals(ana, filas.get(0).user_id()); assertEquals(bruno, filas.get(1).user_id());
            assertNull(filas.get(2).user_id());
            for (var fila : filas) assertEquals(finalizada.partida().ganadores().contains(fila.display_name()), fila.winner());
            permitir.countDown();
            long limite = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (!sala.estado(host).progreso().estado().equals("CONFIRMADA") && System.nanoTime() < limite) Thread.sleep(10);
            var confirmada = sala.estado(host);
            assertEquals("CONFIRMADA", confirmada.progreso().estado());
            assertEquals(finalizada.revision(), confirmada.revision());
            assertEquals(finalizada.partida().ganadores().contains("Ana") ? 150 : 100, confirmada.progreso().xp());
            assertEquals("INVITADO", sala.estado(tokens.get("Guest")).progreso().estado());
            assertEquals(1, escrituras.get());
            assertThrows(ErrorSala.class, () -> sala.actuar(host,
                    new Vistas.Peticion(confirmada.revision(), "COBRAR", null, null, null)));
        } finally { permitir.countDown(); }
    }

    @Test void reintentoAmbiguoConservaIdentificadorHashYFecha() throws Exception {
        var intentos = new AtomicInteger(); var ids = new ArrayList<UUID>(); var hashes = new ArrayList<String>();
        var completado = new CountDownLatch(1);
        UUID id = UUID.randomUUID();
        try (var progreso = new ProgresionPartidas((match, hash, fecha, filas) -> {
            synchronized (ids) { ids.add(match); hashes.add(hash); }
            if (intentos.incrementAndGet() == 1) throw new ExcepcionCuenta(503, "Temporal");
            completado.countDown();
        })) {
            var registro = progreso.registrar(id, Instant.EPOCH, List.of(
                    new CuentasSupabase.Participante(0, UUID.randomUUID(), "Ana", 4, true)));
            assertTrue(completado.await(5, TimeUnit.SECONDS));
            assertEquals(List.of(id, id), ids); assertEquals(hashes.get(0), hashes.get(1));
            assertTrue(registro.hash.matches("[a-f0-9]{64}"));
        }
    }
}
