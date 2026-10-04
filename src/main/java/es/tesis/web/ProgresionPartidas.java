package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import es.tesis.cuentas.ExcepcionCuenta;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Salida asíncrona: nunca espera a la base de datos bajo el bloqueo del motor. */
final class ProgresionPartidas implements AutoCloseable {
    @FunctionalInterface interface Almacen {
        void guardar(UUID id, String hash, Instant fecha, List<CuentasSupabase.Participante> participantes);
    }
    private final Almacen almacen;
    private final ScheduledExecutorService ejecutor;
    private final Semaphore capacidad = new Semaphore(4096);

    static final class Registro {
        final UUID id;
        final List<CuentasSupabase.Participante> participantes;
        final Instant fecha;
        final String hash;
        volatile String estado = "PENDIENTE";
        int intentos;
        Registro(UUID id, Instant fecha, List<CuentasSupabase.Participante> participantes) {
            this.id = id; this.fecha = fecha; this.participantes = List.copyOf(participantes);
            // Orden y codificación estables; no incluye manos, personajes ni eventos.
            var canonico = new com.google.gson.GsonBuilder().serializeNulls().create()
                    .toJson(this.participantes);
            try {
                this.hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                        .digest(("1\n" + canonico).getBytes(StandardCharsets.UTF_8)));
            } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        }
    }

    ProgresionPartidas(Almacen almacen) {
        this(almacen, Executors.newScheduledThreadPool(2, r -> {
            var hilo = new Thread(r, "tesis-recompensas"); hilo.setDaemon(true); return hilo;
        }));
    }
    ProgresionPartidas(Almacen almacen, ScheduledExecutorService ejecutor) {
        this.almacen = almacen; this.ejecutor = ejecutor;
    }
    Registro registrar(UUID id, Instant fecha, List<CuentasSupabase.Participante> participantes) {
        var registro = new Registro(id, fecha, participantes);
        if (!capacidad.tryAcquire()) {
            registro.estado = "ERROR";
            System.getLogger(ProgresionPartidas.class.getName()).log(System.Logger.Level.WARNING,
                    "Cola de progreso llena; resultado {0} sin guardar.", id);
            return registro;
        }
        try { ejecutor.execute(() -> intentar(registro)); }
        catch (RejectedExecutionException e) { capacidad.release(); registro.estado = "ERROR"; }
        return registro;
    }
    private void intentar(Registro registro) {
        try {
            almacen.guardar(registro.id, registro.hash, registro.fecha, registro.participantes);
            registro.estado = "CONFIRMADA";
            capacidad.release();
        } catch (RuntimeException error) {
            // Contratos/credenciales rechazados requieren intervención; fallos temporales se reintentan.
            if (error instanceof ExcepcionCuenta cuenta
                    && cuenta.estado() >= 400 && cuenta.estado() < 500 && cuenta.estado() != 429) {
                registro.estado = "ERROR"; capacidad.release();
                System.getLogger(ProgresionPartidas.class.getName()).log(System.Logger.Level.WARNING,
                        "Resultado {0} rechazado por persistencia (HTTP {1}).", registro.id, cuenta.estado());
                return;
            }
            long espera = Math.min(60, 1L << Math.min(6, registro.intentos++));
            try { ejecutor.schedule(() -> intentar(registro), espera * 1000
                    + ThreadLocalRandom.current().nextLong(250), TimeUnit.MILLISECONDS); }
            catch (RejectedExecutionException e) { registro.estado = "ERROR"; capacidad.release(); }
        }
    }
    @Override public void close() { ejecutor.shutdownNow(); }
}
