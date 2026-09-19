package es.ciudadela.web;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Registro en memoria; los bloqueos largos pertenecen a cada sala. */
public final class GestorSalas {
    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final Map<String, SalaJuego> salas = new ConcurrentHashMap<>();
    private final SecureRandom azar = new SecureRandom();
    private final Clock reloj;
    private final Duration caducidad;

    public GestorSalas() { this(Clock.systemUTC(), Duration.ofHours(24)); }
    GestorSalas(Clock reloj, Duration caducidad) { this.reloj = reloj; this.caducidad = caducidad; }

    public synchronized Vistas.AccesoSala crear(String nombre) {
        SalaJuego.validarNombre(nombre);
        limpiar();
        if (salas.size() >= 256) throw new ErrorSala(409, "Hay demasiadas salas abiertas. Inténtalo más tarde.");
        String codigo;
        do {
            var texto = new StringBuilder();
            for (int i = 0; i < 5; i++) texto.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
            codigo = texto.toString();
        } while (salas.containsKey(codigo));
        var sala = new SalaJuego(codigo, reloj, azar);
        var acceso = sala.unirse(nombre);
        salas.put(codigo, sala);
        return acceso;
    }

    public SalaJuego buscar(String codigo) {
        if (codigo == null || !codigo.strip().toUpperCase(Locale.ROOT).matches("[A-HJ-NP-Z2-9]{5}"))
            throw new IllegalArgumentException("Introduce un código de sala válido de cinco caracteres.");
        var sala = salas.get(codigo.strip().toUpperCase(Locale.ROOT));
        if (sala == null || sala.caducar(reloj.millis() - caducidad.toMillis()))
            throw new ErrorSala(404, "La sala no existe o ha caducado.");
        return sala;
    }

    public void limpiar() {
        long limite = reloj.millis() - caducidad.toMillis();
        salas.entrySet().removeIf(e -> e.getValue().caducar(limite));
    }
}
