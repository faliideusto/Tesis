package es.tesis.eventos;

import java.time.Instant;
import java.util.*;

public final class RegistroPartida implements ObservadorJuego {
    private final List<RegistroEvento> eventos = new ArrayList<>();

    @Override public void alRecibir(EventoJuego evento) {
        Map<String, String> datos = new TreeMap<>();
        evento.datos().forEach((clave, valor) -> datos.put(clave, String.valueOf(valor)));
        eventos.add(new RegistroEvento(eventos.size() + 1L, Instant.now().toString(), evento.tipo(), datos));
    }

    public List<RegistroEvento> eventos() { return List.copyOf(eventos); }

    public void importar(List<RegistroEvento> historial) {
        if (!eventos.isEmpty()) throw new IllegalStateException("El registro ya contiene eventos");
        var copia = List.copyOf(historial);
        for (int i = 0; i < copia.size(); i++) {
            if (copia.get(i).numero() != i + 1L) throw new IllegalArgumentException("Numeración de eventos no válida");
        }
        eventos.addAll(copia);
    }
}
