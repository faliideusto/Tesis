package es.ciudadela.consola;

import es.ciudadela.dominio.*;
import es.ciudadela.motor.MotorJuego;
import java.io.PrintStream;
import java.util.Comparator;

final class VistaPartida {
    private final MotorJuego motor;
    private final PrintStream salida;

    VistaPartida(MotorJuego motor, PrintStream salida) { this.motor = motor; this.salida = salida; }

    void estado() {
        Partida partida = motor.partida();
        salida.println("\n=== ESTADO DE LA PARTIDA ===");
        salida.println("Ronda " + partida.ronda() + " | " + fase(partida.faseActual()));
        if (partida.faseActual() != FaseDeTurno.FIN_PARTIDA) {
            salida.println("Jugador actual: " + motor.contexto().jugadorActual().nombre());
        }
        salida.println("Ideas en el mazo: " + partida.mazoIdeas().cartas().size()
                + " | Artículos publicados en mesa: " + partida.tablero().cantidadEstudiosPublicados());
        partida.jugadores().forEach(j -> { resumen(j); estudios(j); });
        if (partida.faseActual() == FaseDeTurno.TURNO_JUGADOR) {
            salida.println("Acciones base restantes: " + (2 - partida.accionesBaseRealizadas()));
        }
    }

    void resumen(Jugador jugador) {
        salida.println(jugador.nombre() + ": " + jugador.monedas() + " monedas | "
                + jugador.cartasIdea().size() + " cartas | " + jugador.cantidadPublicados()
                + " publicaciones | " + jugador.prestigio() + " prestigio");
    }

    void mano(Jugador jugador) {
        salida.println("Cartas de " + jugador.nombre() + ":");
        if (jugador.cartasIdea().isEmpty()) salida.println("Sin cartas.");
        for (int i = 0; i < jugador.cartasIdea().size(); i++) {
            var carta = jugador.cartasIdea().get(i);
            salida.println((i + 1) + ". " + carta.nombre() + " | coste: " + carta.costeMonedas()
                    + " | trabajo: " + carta.trabajoRequerido() + " | prestigio: " + carta.prestigio()
                    + (carta.costeMonedas() > jugador.monedas() ? " | faltan monedas" : ""));
        }
    }

    void estudios(Jugador jugador) {
        salida.println("Estudios de " + jugador.nombre() + ":");
        if (jugador.estudios().isEmpty()) salida.println("Sin estudios.");
        for (int i = 0; i < jugador.estudios().size(); i++) salida.println(describirEstudio(jugador, i));
    }

    String describirEstudio(Jugador jugador, int indice) {
        Estudio estudio = jugador.estudios().get(indice);
        return (indice + 1) + ". " + estudio.carta().nombre() + " | trabajo: " + estudio.trabajoAcumulado()
                + "/" + estudio.carta().trabajoRequerido() + " | prestigio: "
                + (estudio.carta().prestigio() + estudio.prestigioExtra()) + " | "
                + (estudio.estado() == EstadoEstudio.PUBLICADO ? "Publicado" : "En desarrollo");
    }

    void resultado() {
        salida.println("\n=== RESULTADO FINAL ===");
        motor.partida().jugadores().stream().sorted(Comparator.comparingInt(Jugador::prestigio).reversed()).forEach(this::resumen);
        salida.println("Ganador(es): " + motor.partida().ganadores().stream().map(Jugador::nombre).toList());
        salida.println("Puedes consultar el estado o el historial, guardar, exportar, cargar otra partida o salir.");
    }

    private String fase(FaseDeTurno fase) {
        return switch (fase) {
            case SELECCION_ROLES -> "Selección de personajes";
            case TURNO_JUGADOR -> "Turnos de acción";
            case FIN_RONDA -> "Fin de ronda";
            case FIN_PARTIDA -> "Partida finalizada";
        };
    }
}
