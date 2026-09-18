package es.ciudadela.persistencia;

import es.ciudadela.dominio.InstantaneaPartida;
import es.ciudadela.eventos.RegistroEvento;
import java.time.Instant;
import java.util.*;

/** Formato versionado de la variante académica; apto para memoria y JSON. */
public record PartidaGuardada(int version, String reglas, String fecha, InstantaneaPartida partida,
        Set<String> vetados, Set<String> protegidos, String siguienteJugadorInicial,
        List<RegistroEvento> eventos) {
    public static final int VERSION = 1;
    public static final String REGLAS = "academicas-v1";

    public PartidaGuardada {
        if (version != VERSION || !REGLAS.equals(reglas)) {
            throw new IllegalArgumentException("Versión o reglas de guardado no compatibles");
        }
        Instant.parse(fecha);
        Objects.requireNonNull(partida);
        vetados = Set.copyOf(vetados);
        protegidos = Set.copyOf(protegidos);
        eventos = List.copyOf(eventos);
        var nombres = partida.jugadores().stream().map(InstantaneaPartida.JugadorDatos::nombre).toList();
        if (!nombres.contains(siguienteJugadorInicial) || !nombres.containsAll(vetados) || !nombres.containsAll(protegidos)) {
            throw new IllegalArgumentException("Los efectos guardados hacen referencia a un jugador desconocido");
        }
        for (int i = 0; i < eventos.size(); i++) {
            if (eventos.get(i).numero() != i + 1L) throw new IllegalArgumentException("Historial de eventos no válido");
        }
    }
}
