package es.tesis.web;

import java.util.Comparator;
import java.util.List;
import java.util.Random;

/**
 * Jugador automático. Decide con la misma vista que recibiría una persona en su asiento,
 * así que no conoce manos ni personajes ocultos, y solo elige entre las opciones ofrecidas.
 */
final class CerebroBot {
    private CerebroBot() {}

    /** Una única jugada para el jugador actual de {@code estado}. */
    static Vistas.Peticion decidir(Vistas.Estado estado, Random azar) {
        if (estado.fase().equals("SELECCION_ROLES")) return personaje(estado, azar);
        var yo = yo(estado);
        var habilidad = accion(estado, "HABILIDAD");
        boolean puedeHabilidad = habilidad != null && habilidad.disponible() && !habilidad.opciones().isEmpty();
        if (estado.habilidadPendiente() && puedeHabilidad) {
            var rol = habilidad.opciones().get(azar.nextInt(habilidad.opciones().size()));
            return peticion(estado, "HABILIDAD", null, rol.objetivo());
        }
        if (puedeHabilidad) {
            var objetivo = objetivoHabilidad(estado, yo, habilidad);
            if (objetivo != null) return peticion(estado, "HABILIDAD", objetivo.indice(), objetivo.objetivo());
        }
        var base = accionBase(estado, yo);
        return base != null ? base : peticion(estado, "FIN_TURNO", null, null);
    }

    /** Jugada mínima siempre legal, por si la decisión principal fuera rechazada. */
    static Vistas.Peticion respaldo(Vistas.Estado estado) {
        if (estado.fase().equals("SELECCION_ROLES"))
            return peticion(estado, "SELECCIONAR", estado.seleccion().get(0).indice(), null);
        var habilidad = accion(estado, "HABILIDAD");
        if (estado.habilidadPendiente() && habilidad != null && !habilidad.opciones().isEmpty())
            return peticion(estado, "HABILIDAD", habilidad.opciones().get(0).indice(), habilidad.opciones().get(0).objetivo());
        return peticion(estado, "FIN_TURNO", null, null);
    }

    private static Vistas.Peticion personaje(Vistas.Estado estado, Random azar) {
        var yo = yo(estado);
        long enDesarrollo = yo.estudios().stream().filter(e -> !e.publicado()).count();
        int publicadosMesa = estado.jugadores().stream().mapToInt(Vistas.Jugador::publicados).sum();
        boolean rivalConTrabajo = estado.jugadores().stream().filter(j -> j != yo)
                .anyMatch(j -> j.estudios().stream().anyMatch(e -> !e.publicado() && e.trabajo() > 0));
        Vistas.Rol mejor = null;
        double mejorValor = Double.NEGATIVE_INFINITY;
        for (var rol : estado.seleccion()) {
            double valor = switch (rol.nombre()) {
                case "Pre-Doctoral" -> enDesarrollo > 0 ? 4 : 1.5;
                case "Estadístico" -> yo.publicados() > 0 ? 4 : 0;
                case "Editorial" -> publicadosMesa;
                case "Investigador Principal" -> yo.cartas() < 2 ? 3.5 : 2;
                case "Decana" -> enDesarrollo > 0 ? 2.5 : 1;
                case "Revisor 2" -> rivalConTrabajo && yo.monedas() > 0 ? 2.5 : 0.5;
                default -> 1.5;
            } + azar.nextDouble() * 1.5;
            if (valor > mejorValor) { mejorValor = valor; mejor = rol; }
        }
        return peticion(estado, "SELECCIONAR", mejor.indice(), null);
    }

    private static Vistas.Opcion objetivoHabilidad(Vistas.Estado estado, Vistas.Jugador yo, Vistas.Accion habilidad) {
        var opciones = habilidad.opciones();
        if (opciones.get(0).objetivo() == null) {
            // Estadístico o Pre-Doctoral: la opción señala un estudio propio.
            return opciones.stream().min(Comparator.comparingInt((Vistas.Opcion o) -> {
                var estudio = estudio(yo, o.indice());
                return estudio.publicado() ? -estudio.carta().prestigio() : restante(estudio);
            })).orElseThrow();
        }
        // Revisor 2: solo gasta la moneda contra quien va por delante o está a punto de publicar.
        Vistas.Opcion mejor = null;
        int mejorAmenaza = 0;
        for (var opcion : opciones) {
            var rival = estado.jugadores().stream().filter(j -> j.nombre().equals(opcion.objetivo())).findFirst().orElse(null);
            if (rival == null || opcion.indice() == null) continue;
            var estudio = estudio(rival, opcion.indice());
            int amenaza = rival.publicados() * 3 + (restante(estudio) <= 2 ? 3 : 0) + (rival.prestigio() > yo.prestigio() ? 1 : 0);
            if (amenaza > mejorAmenaza) { mejorAmenaza = amenaza; mejor = opcion; }
        }
        return mejorAmenaza >= 3 ? mejor : null;
    }

    private static Vistas.Peticion accionBase(Vistas.Estado estado, Vistas.Jugador yo) {
        if (estado.accionesRestantes() <= 0) return null;
        var trabajar = accion(estado, "TRABAJAR");
        var iniciar = accion(estado, "INICIAR");
        Vistas.Opcion casiListo = disponible(trabajar) ? trabajar.opciones().stream()
                .min(Comparator.comparingInt((Vistas.Opcion o) -> restante(estudio(yo, o.indice())))
                        .thenComparingInt(o -> -estudio(yo, o.indice()).carta().prestigio())).orElse(null) : null;
        if (casiListo != null && restante(estudio(yo, casiListo.indice())) <= estado.accionesRestantes())
            return peticion(estado, "TRABAJAR", casiListo.indice(), null);
        long enDesarrollo = yo.estudios().stream().filter(e -> !e.publicado()).count();
        if (disponible(iniciar) && enDesarrollo < 2) {
            var idea = iniciar.opciones().stream().max(Comparator.comparingInt((Vistas.Opcion o) -> {
                var carta = estado.mano().get(o.indice());
                return carta.prestigio() * 2 - carta.trabajo() + carta.ingresoPorTurno() * 2;
            })).orElseThrow();
            return peticion(estado, "INICIAR", idea.indice(), null);
        }
        if (casiListo != null) return peticion(estado, "TRABAJAR", casiListo.indice(), null);
        var pensar = accion(estado, "PENSAR");
        if (estado.mano().isEmpty() && pensar != null && pensar.disponible()) return peticion(estado, "PENSAR", null, null);
        var cobrar = accion(estado, "COBRAR");
        return cobrar != null && cobrar.disponible() ? peticion(estado, "COBRAR", null, null) : null;
    }

    private static boolean disponible(Vistas.Accion accion) {
        return accion != null && accion.disponible() && !accion.opciones().isEmpty();
    }
    private static int restante(Vistas.Estudio estudio) { return estudio.carta().trabajo() - estudio.trabajo(); }
    private static Vistas.Estudio estudio(Vistas.Jugador jugador, int indice) {
        return jugador.estudios().stream().filter(e -> e.indice() == indice).findFirst().orElseThrow();
    }
    private static Vistas.Jugador yo(Vistas.Estado estado) {
        return estado.jugadores().stream().filter(j -> j.nombre().equals(estado.actual())).findFirst().orElseThrow();
    }
    private static Vistas.Accion accion(Vistas.Estado estado, String id) {
        return estado.acciones().stream().filter(a -> a.id().equals(id)).findFirst().orElse(null);
    }
    private static Vistas.Peticion peticion(Vistas.Estado estado, String tipo, Integer indice, String objetivo) {
        return new Vistas.Peticion(estado.revision(), tipo, indice, objetivo, null);
    }
    /** Nombres corrientes: en la mesa un bot se presenta como cualquier otra persona. */
    static List<String> nombres() {
        return List.of("Lucía", "Mateo", "Carmen", "Hugo", "Sofía", "Daniel", "Elena", "Pablo", "Marta", "Álvaro");
    }
}
