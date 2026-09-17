package es.ciudadela.consola;

import es.ciudadela.acciones.*;
import es.ciudadela.dominio.FaseDeTurno;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.habilidades.*;
import es.ciudadela.motor.MotorJuego;
import java.util.Scanner;

/** Interfaz local para las reglas actualmente implementadas. */
public final class ConsolaJuego {
    private final MotorJuego motor;
    private final Scanner entrada;

    public ConsolaJuego(MotorJuego motor, Scanner entrada) {
        this.motor = motor;
        this.entrada = entrada;
    }

    public void ejecutar() {
        System.out.println("CIUDADELA ACADÉMICA - Partida local de Ana y Bruno");
        System.out.println("Habilidades activas: una vez por turno, salvo Editorial. Comité: antes de actuar.");
        System.out.println("Escribe salir para cerrar sin guardar.");
        try {
            while (motor.partida().faseActual() != FaseDeTurno.FIN_PARTIDA) {
                try {
                    switch (motor.partida().faseActual()) {
                        case SELECCION_ROLES -> seleccionarRol();
                        case TURNO_JUGADOR -> jugarTurno();
                        case FIN_RONDA -> motor.avanzarFase();
                        default -> throw new IllegalStateException("Fase no reconocida");
                    }
                } catch (IllegalArgumentException | IllegalStateException error) {
                    System.out.println("No se puede realizar la acción: " + error.getMessage());
                }
            }
            System.out.println("\nPARTIDA FINALIZADA - Prestigio acumulado");
            motor.partida().jugadores().forEach(this::mostrarResumen);
            System.out.println("Ganador(es): " + motor.partida().ganadores().stream().map(Jugador::nombre).toList());
        } catch (FinEntrada salida) {
            System.out.println("Partida cerrada sin guardar.");
        }
    }

    private void seleccionarRol() {
        System.out.println("\nRonda " + motor.partida().ronda() + " - Elige personaje: "
                + motor.contexto().jugadorActual().nombre());
        var roles = motor.partida().mazoRoles().cartas();
        for (int i = 0; i < roles.size(); i++) {
            System.out.println((i + 1) + ". " + roles.get(i).nombre() + " (orden " + roles.get(i).ordenTurno() + ")");
        }
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(leerIndice("Personaje: ")));
    }

    private void jugarTurno() {
        Jugador jugador = motor.contexto().jugadorActual();
        System.out.println("\nRonda " + motor.partida().ronda() + " - Turno de " + jugador.nombre()
                + " / " + jugador.personaje().nombre());
        mostrarResumen(jugador);
        System.out.println("Acciones base restantes: " + (2 - motor.partida().accionesBaseRealizadas()));
        System.out.println("1. Cobrar  2. Pensar  3. Iniciar estudio  4. Trabajar");
        System.out.println("5. Usar habilidad  6. Ver cartas y estudios  7. Terminar turno");
        switch (leer("Opción: ")) {
            case "1" -> motor.ejecutarAccion(new CobrarAccion());
            case "2" -> motor.ejecutarAccion(new PensarAccion());
            case "3" -> {
                mostrarCartas(jugador);
                motor.ejecutarAccion(new IniciarEstudioAccion(leerIndice("Carta: ")));
            }
            case "4" -> {
                mostrarEstudios(jugador);
                motor.ejecutarAccion(new TrabajarAccion(leerIndice("Estudio: ")));
            }
            case "5" -> usarHabilidad(jugador);
            case "6" -> {
                mostrarCartas(jugador);
                motor.partida().jugadores().forEach(this::mostrarEstudios);
            }
            case "7" -> motor.avanzarFase();
            default -> System.out.println("Elige una opción entre 1 y 7.");
        }
    }

    private void usarHabilidad(Jugador jugador) {
        var habilidad = jugador.personaje().habilidad();
        if (habilidad instanceof EditorialHabilidad) {
            mostrarEstudios(jugador);
            motor.ejecutarAccion(new UsarHabilidadAccion(leerIndice("Estudio propio (3 monedas): ")));
        } else if (habilidad instanceof PreDoctoralHabilidad
                || habilidad instanceof InvestigadorPrincipalHabilidad || habilidad instanceof DecanaHabilidad) {
            System.out.println("Esta habilidad se aplica automáticamente por el motor.");
        } else if (habilidad instanceof EstadisticoHabilidad) {
            mostrarEstudios(jugador);
            motor.ejecutarAccion(new UsarHabilidadAccion(leerIndice("Artículo propio publicado: ")));
        } else if (habilidad instanceof ComiteEticaHabilidad) {
            var roles = motor.partida().mazoRoles().cartasIniciales();
            for (int i = 0; i < roles.size(); i++) System.out.println((i + 1) + ". " + roles.get(i).nombre());
            int indice = leerIndice("Rol que pierde el turno: ");
            if (indice < 0 || indice >= roles.size()) throw new IllegalArgumentException("Rol no válido");
            motor.ejecutarAccion(new UsarHabilidadAccion(roles.get(indice).nombre()));
        } else {
            System.out.println("Jugadores: " + motor.partida().jugadores().stream().map(Jugador::nombre).toList());
            Jugador objetivo = motor.contexto().buscarJugador(leer("Jugador objetivo: "));
            if (objetivo == null) throw new IllegalArgumentException("No existe ese jugador");
            if (habilidad instanceof Revisor2Habilidad) {
                mostrarEstudios(objetivo);
                motor.ejecutarAccion(new UsarHabilidadAccion(objetivo.nombre(), leerIndice("Estudio (1 moneda): ")));
            } else {
                motor.ejecutarAccion(new UsarHabilidadAccion(objetivo.nombre()));
            }
        }
    }

    private void mostrarResumen(Jugador jugador) {
        System.out.println(jugador.nombre() + ": " + jugador.monedas() + " monedas, "
                + jugador.cartasIdea().size() + " cartas, " + jugador.cantidadPublicados()
                + " publicaciones, " + jugador.prestigio() + " prestigio");
    }

    private void mostrarCartas(Jugador jugador) {
        System.out.println("Cartas de " + jugador.nombre() + ":");
        if (jugador.cartasIdea().isEmpty()) System.out.println("Sin cartas.");
        for (int i = 0; i < jugador.cartasIdea().size(); i++) {
            var carta = jugador.cartasIdea().get(i);
            System.out.println((i + 1) + ". " + carta.nombre() + " | coste: " + carta.costeMonedas()
                    + " | trabajo: " + carta.trabajoRequerido() + " | prestigio: " + carta.prestigio());
        }
    }

    private void mostrarEstudios(Jugador jugador) {
        System.out.println("Estudios de " + jugador.nombre() + ":");
        if (jugador.estudios().isEmpty()) System.out.println("Sin estudios.");
        for (int i = 0; i < jugador.estudios().size(); i++) {
            var estudio = jugador.estudios().get(i);
            System.out.println((i + 1) + ". " + estudio.carta().nombre() + " | trabajo: "
                    + estudio.trabajoAcumulado() + "/" + estudio.carta().trabajoRequerido() + " | " + estudio.estado());
        }
    }

    private int leerIndice(String mensaje) {
        try {
            return Math.subtractExact(Integer.parseInt(leer(mensaje)), 1);
        } catch (NumberFormatException | ArithmeticException error) {
            throw new IllegalArgumentException("Introduce un número válido");
        }
    }

    private String leer(String mensaje) {
        System.out.print(mensaje);
        if (!entrada.hasNextLine()) throw new FinEntrada();
        String texto = entrada.nextLine().trim();
        if (texto.equalsIgnoreCase("salir")) throw new FinEntrada();
        return texto;
    }

    private static final class FinEntrada extends RuntimeException {}
}
