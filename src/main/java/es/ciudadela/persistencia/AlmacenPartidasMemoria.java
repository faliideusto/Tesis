package es.ciudadela.persistencia;

import java.util.*;

/** Guarda instantáneas inmutables; desaparece cuando se cierra el proceso. */
public final class AlmacenPartidasMemoria {
    private final Map<String, PartidaGuardada> partidas = new LinkedHashMap<>();

    public void guardar(String nombre, PartidaGuardada partida) {
        if (nombre == null || nombre.isBlank()) throw new IllegalArgumentException("Indica un nombre para el guardado");
        partidas.put(nombre, Objects.requireNonNull(partida));
    }

    public PartidaGuardada cargar(String nombre) {
        var partida = partidas.get(nombre);
        if (partida == null) throw new IllegalArgumentException("No existe ese guardado en memoria");
        return partida;
    }

    public Set<String> nombres() { return Collections.unmodifiableSet(new LinkedHashSet<>(partidas.keySet())); }
}
