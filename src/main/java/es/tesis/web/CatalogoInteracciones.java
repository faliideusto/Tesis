package es.tesis.web;

import java.util.Map;

/** Registro de interacciones visuales permitidas. No ejecuta comandos del motor. */
final class CatalogoInteracciones {
    private static final Map<String,Long> COOLDOWNS=Map.of("archivo_lanzamiento_libro",15_000L);
    static boolean admite(String id) { return id!=null&&COOLDOWNS.containsKey(id); }
    static long cooldown(String id) {
        if(!admite(id))throw new ErrorSala(400,"Interacción cosmética no válida.");
        return COOLDOWNS.get(id);
    }
    private CatalogoInteracciones() {}
}
