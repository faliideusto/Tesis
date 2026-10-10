package es.tesis.web;

import com.google.gson.Gson;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class GestorMatchmakingTest {
    private static final class Reloj extends Clock {
        Instant ahora = Instant.parse("2026-01-01T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zona) { return this; }
        public Instant instant() { return ahora; }
        void avanzar(long ms) { ahora = ahora.plusMillis(ms); }
    }
    private final Reloj reloj = new Reloj();
    private final GestorSalas salas = new GestorSalas(reloj, Duration.ofHours(24));
    private final GestorMatchmaking gestor = new GestorMatchmaking(salas, reloj);
    private String buscar(String nombre, int cantidad) {
        String token = UUID.randomUUID().toString();
        gestor.buscar(token, nombre, cantidad, null);
        return token;
    }
    private List<String> grupo(int cantidad) {
        var tokens = new ArrayList<String>();
        for (int i = 0; i < cantidad; i++) tokens.add(buscar("Jugador " + i, cantidad));
        return tokens;
    }
    private void confirmarTodos(List<String> tokens) {
        for (String token : tokens) gestor.confirmar(token, gestor.estado(token).grupo());
    }

    @ParameterizedTest @ValueSource(ints = {3, 4, 5})
    void mesaExactaComienzaSoloCuandoTodosConfirmanConVistasPrivadas(int cantidad) {
        var tokens = grupo(cantidad);
        assertEquals("CONFIRMACION", gestor.estado(tokens.get(0)).fase());
        assertNull(gestor.estado(tokens.get(0)).acceso());
        for (int i = 0; i < cantidad - 1; i++) gestor.confirmar(tokens.get(i), gestor.estado(tokens.get(i)).grupo());
        assertEquals("CONFIRMACION", gestor.estado(tokens.get(0)).fase());
        gestor.confirmar(tokens.get(cantidad - 1), gestor.estado(tokens.get(cantidad - 1)).grupo());
        var codigos = new HashSet<String>();
        var salaTokens = new HashSet<String>();
        for (int i = 0; i < cantidad; i++) {
            var vista = gestor.estado(tokens.get(i));
            assertEquals("ASIGNADA", vista.fase());
            assertEquals("Jugador " + i, vista.acceso().sala().yo());
            assertEquals("EN_PARTIDA", vista.acceso().sala().fase());
            assertEquals(cantidad, vista.acceso().sala().jugadores().size());
            assertEquals(2, vista.acceso().sala().partida().mano().size());
            codigos.add(vista.acceso().codigo()); salaTokens.add(vista.acceso().playerToken());
        }
        assertEquals(1, codigos.size()); assertEquals(cantidad, salaTokens.size());
        String json = new Gson().toJson(gestor.estado(tokens.get(0)));
        for (int i = 1; i < cantidad; i++) {
            assertFalse(json.contains(tokens.get(i)));
            assertFalse(json.contains(gestor.estado(tokens.get(i)).acceso().playerToken()));
        }
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.cancelar(tokens.get(0))).estado);
        assertEquals("ASIGNADA", gestor.estado(tokens.get(0)).fase());
        assertEquals(gestor.estado(tokens.get(0)), gestor.confirmar(tokens.get(0), gestor.estado(tokens.get(0)).grupo()));
        assertEquals(401, assertThrows(ErrorSala.class, () -> salas.buscar(codigos.iterator().next()).estado(tokens.get(0))).estado);
    }

    @Test void colasSeparadasIdempotenciaYValidacion() {
        var a = buscar("A", 3); var b = buscar("B", 4); var c = buscar("C", 5);
        assertEquals(1, gestor.estado(a).reunidos());
        assertEquals(1, gestor.estado(b).reunidos());
        assertEquals(1, gestor.estado(c).reunidos());
        assertEquals(gestor.estado(a), gestor.buscar(a, " A ", 3, null));
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.buscar(a, "A", 4, null)).estado);
        assertEquals(401, assertThrows(ErrorSala.class, () -> gestor.estado("falso")).estado);
        assertEquals(404, assertThrows(ErrorSala.class, () -> gestor.estado(UUID.randomUUID().toString())).estado);
        assertThrows(IllegalArgumentException.class, () -> buscar("X", 2));
        assertThrows(IllegalArgumentException.class, () -> buscar("\nX", 3));
    }

    @Test void cancelacionDevuelveSupervivientesEnSuOrdenYRechazaGrupoObsoleto() {
        var primero = grupo(3); String grupoViejo = gestor.estado(primero.get(0)).grupo();
        var cuarto = buscar("Cuarto", 3); var quinto = buscar("Quinto", 3);
        gestor.confirmar(primero.get(0), grupoViejo);
        gestor.cancelar(primero.get(2));
        String nuevo = gestor.estado(primero.get(0)).grupo();
        assertNotEquals(grupoViejo, nuevo);
        assertEquals(nuevo, gestor.estado(primero.get(1)).grupo());
        assertEquals(nuevo, gestor.estado(cuarto).grupo());
        assertEquals("BUSCANDO", gestor.estado(quinto).fase());
        assertFalse(gestor.estado(primero.get(0)).listo());
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.confirmar(primero.get(0), grupoViejo)).estado);
        assertEquals("CANCELADA", gestor.estado(primero.get(2)).fase());
    }

    @Test void plazoRetieneConfirmadosConPrioridadYExpulsaNoConfirmados() {
        var primeros = grupo(3); String grupo = gestor.estado(primeros.get(0)).grupo();
        gestor.confirmar(primeros.get(0), grupo);
        reloj.avanzar(10_000);
        var cuarto = buscar("Cuarto", 3); var quinto = buscar("Quinto", 3);
        reloj.avanzar(10_000); gestor.limpiar();
        assertEquals("CANCELADA", gestor.estado(primeros.get(1)).fase());
        assertEquals("CANCELADA", gestor.estado(primeros.get(2)).fase());
        String nuevo = gestor.estado(primeros.get(0)).grupo();
        assertNotEquals(grupo, nuevo);
        assertEquals(nuevo, gestor.estado(cuarto).grupo());
        assertEquals(nuevo, gestor.estado(quinto).grupo());
        assertFalse(gestor.estado(primeros.get(0)).listo());
    }

    @Test void presenciaNoSeRenuevaConTokensInvalidosYAsignacionEsRecuperable() {
        var perdido = buscar("Ausente", 4);
        reloj.avanzar(29_000); assertThrows(ErrorSala.class, () -> gestor.estado(UUID.randomUUID().toString()));
        reloj.avanzar(1_000); assertEquals("CANCELADA", gestor.estado(perdido).fase());
        var tokens = grupo(3); confirmarTodos(tokens);
        var acceso = gestor.estado(tokens.get(0)).acceso();
        reloj.avanzar(Duration.ofHours(23).toMillis());
        assertEquals(acceso, gestor.estado(tokens.get(0)).acceso());
        reloj.avanzar(Duration.ofHours(1).toMillis());
        assertEquals(404, assertThrows(ErrorSala.class, () -> gestor.estado(tokens.get(0))).estado);
    }

    @Test void nombresDuplicadosSeResuelvenYCuentasSeConservanSinBusquedaDuplicada() {
        UUID cuenta = UUID.randomUUID(); String a = UUID.randomUUID().toString();
        gestor.buscar(a, "a".repeat(24), 3, cuenta);
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.buscar(UUID.randomUUID().toString(), "Otra", 4, cuenta)).estado);
        var b = buscar("A".repeat(24), 3); var c = buscar("a".repeat(24), 3);
        confirmarTodos(List.of(a, b, c));
        var nombres = gestor.estado(a).acceso().sala().jugadores();
        assertEquals(3, nombres.stream().map(n -> n.toLowerCase(Locale.ROOT)).distinct().count());
        assertTrue(nombres.stream().allMatch(n -> n.length() <= 24));
        assertTrue(gestor.estado(a).acceso().sala().progreso().cuenta());
        assertFalse(gestor.estado(b).acceso().sala().progreso().cuenta());
    }

    @Test void nombresUnicodeEquivalentesNoBloqueanLaAsignacion() {
        var tokens = List.of(buscar("I", 3), buscar("ı", 3), buscar("İ", 3));
        confirmarTodos(tokens);
        var nombres = gestor.estado(tokens.get(0)).acceso().sala().jugadores();
        var distintos = new TreeSet<String>(String.CASE_INSENSITIVE_ORDER);
        distintos.addAll(nombres);
        assertEquals(3, distintos.size());
        assertTrue(tokens.stream().allMatch(t -> gestor.estado(t).fase().equals("ASIGNADA")));
    }

    @Test void botsSoloTrasLaEsperaYSinArrastrarAlRestoDeLaCola() {
        var ana = buscar("Ana", 4); var bea = buscar("Bea", 4);
        assertFalse(gestor.estado(ana).bots());
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.rellenar(ana)).estado);
        reloj.avanzar(14_999);
        assertFalse(gestor.estado(ana).bots());
        assertEquals("BUSCANDO", gestor.estado(bea).fase());
        reloj.avanzar(1);
        assertTrue(gestor.estado(ana).bots());
        var vista = gestor.rellenar(ana);
        assertEquals("ASIGNADA", vista.fase());
        assertFalse(vista.bots());
        var sala = vista.acceso().sala();
        assertEquals("Ana", sala.yo());
        assertTrue(sala.soyAnfitrion());
        assertEquals(4, sala.jugadores().size());
        assertEquals("EN_PARTIDA", sala.fase());
        assertEquals("PRACTICA", sala.progreso().estado());
        // Repetir tras una respuesta perdida recupera la misma mesa.
        assertEquals(vista.acceso().playerToken(), gestor.rellenar(ana).acceso().playerToken());
        assertEquals(vista.acceso().codigo(), gestor.estado(ana).acceso().codigo());
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.cancelar(ana)).estado);
        // Quien no lo pidió sigue en su cola.
        assertEquals("BUSCANDO", gestor.estado(bea).fase());
        assertEquals(1, gestor.estado(bea).reunidos());
        assertNull(gestor.estado(bea).acceso());
        assertTrue(gestor.estado(bea).bots());
    }

    @Test void botsNoSeOfrecenConMesaEncontradaNiTrasCancelar() {
        var solo = buscar("Solo", 5);
        reloj.avanzar(15_000);
        assertTrue(gestor.estado(solo).bots());
        var trio = grupo(3);
        reloj.avanzar(15_000);
        gestor.estado(solo);
        assertEquals("CONFIRMACION", gestor.estado(trio.get(0)).fase());
        assertFalse(gestor.estado(trio.get(0)).bots());
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.rellenar(trio.get(0))).estado);
        assertEquals("CONFIRMACION", gestor.estado(trio.get(0)).fase());
        gestor.cancelar(solo);
        assertFalse(gestor.estado(solo).bots());
        assertEquals(409, assertThrows(ErrorSala.class, () -> gestor.rellenar(solo)).estado);
        assertEquals(401, assertThrows(ErrorSala.class, () -> gestor.rellenar("falso")).estado);
    }

    @Test void confirmacionesConcurrentesYRepetidasAsignanUnaSolaSala() throws Exception {
        var tokens = grupo(3); String grupo = gestor.estado(tokens.get(0)).grupo();
        var pool = Executors.newFixedThreadPool(6); var salida = new CountDownLatch(1);
        try {
            var futuros = new ArrayList<Future<GestorMatchmaking.Vista>>();
            for (int i = 0; i < 6; i++) {
                String token = tokens.get(i % 3);
                futuros.add(pool.submit(() -> { salida.await(); return gestor.confirmar(token, grupo); }));
            }
            salida.countDown();
            for (var futuro : futuros) futuro.get(5, TimeUnit.SECONDS);
            assertEquals(1, tokens.stream().map(t -> gestor.estado(t).acceso().codigo()).distinct().count());
            for (var token : tokens) assertEquals("ASIGNADA", gestor.estado(token).fase());
        } finally { pool.shutdownNow(); }
    }

    @Test void cancelarYUltimaConfirmacionConcurrentesTienenUnSoloResultadoCoherente() throws Exception {
        var tokens = grupo(3); String grupo = gestor.estado(tokens.get(0)).grupo();
        gestor.confirmar(tokens.get(0), grupo); gestor.confirmar(tokens.get(1), grupo);
        var pool = Executors.newFixedThreadPool(2); var salida = new CountDownLatch(1);
        try {
            var confirmar = pool.submit(() -> {
                salida.await();
                try { gestor.confirmar(tokens.get(2), grupo); return 200; }
                catch (ErrorSala e) { return e.estado; }
            });
            var cancelar = pool.submit(() -> {
                salida.await();
                try { gestor.cancelar(tokens.get(0)); return 200; }
                catch (ErrorSala e) { return e.estado; }
            });
            salida.countDown();
            var resultados = new ArrayList<>(List.of(confirmar.get(5, TimeUnit.SECONDS), cancelar.get(5, TimeUnit.SECONDS)));
            Collections.sort(resultados); assertEquals(List.of(200, 409), resultados);
            if (gestor.estado(tokens.get(0)).fase().equals("ASIGNADA")) {
                for (var token : tokens) assertEquals("ASIGNADA", gestor.estado(token).fase());
                assertEquals(1, tokens.stream().map(t -> gestor.estado(t).acceso().codigo()).distinct().count());
            } else {
                assertEquals("CANCELADA", gestor.estado(tokens.get(0)).fase());
                for (int i = 1; i < 3; i++) {
                    assertEquals("BUSCANDO", gestor.estado(tokens.get(i)).fase());
                    assertNull(gestor.estado(tokens.get(i)).acceso());
                }
            }
        } finally { pool.shutdownNow(); }
    }
}
