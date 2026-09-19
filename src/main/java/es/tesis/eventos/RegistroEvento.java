package es.tesis.eventos;

import java.time.Instant;
import java.util.Map;

/** Los datos se conservan como texto de diagnóstico, sin referencias al estado vivo del juego. */
public record RegistroEvento(long numero, String fecha, String tipo, Map<String, String> datos) {
    public RegistroEvento {
        if (numero < 1 || tipo == null || tipo.isBlank()) throw new IllegalArgumentException("Evento no válido");
        Instant.parse(fecha);
        datos = Map.copyOf(datos);
    }
}
