package es.tesis.consola;

import es.tesis.acciones.*;
import es.tesis.dominio.FaseDeTurno;
import es.tesis.dominio.Jugador;
import es.tesis.habilidades.*;
import es.tesis.motor.MotorJuego;
import java.util.Scanner;
import java.io.IOException;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.function.Predicate;
import es.tesis.dominio.Estudio;
import es.tesis.dominio.EstadoEstudio;
import java.nio.file.Path;
import java.util.Locale;
import es.tesis.persistencia.AlmacenPartidasMemoria;
import es.tesis.persistencia.SerializadorPartidaJson;

/** Interfaz local para las reglas actualmente implementadas. */
public final class ConsolaJuego {
    private final MotorJuego motor;
    private final Scanner entrada;
    private final PrintStream salida;
    private final VistaPartida vista;
    private final AvisosConsola avisos;
    private final AlmacenPartidasMemoria guardados = new AlmacenPartidasMemoria();
    private final SerializadorPartidaJson json = new SerializadorPartidaJson();

    public ConsolaJuego(MotorJuego motor, Scanner entrada) {
        this(motor, entrada, System.out);
    }

    public ConsolaJuego(MotorJuego motor, Scanner entrada, PrintStream salida) {
        this.motor = motor;
        this.entrada = entrada;
        this.salida = salida;
        this.vista = new VistaPartida(motor, salida);
        this.avisos = new AvisosConsola(salida);
    }

    public void ejecutar() {
        salida.println("TESIS - Partida local");
        salida.println("Jugadores: " + motor.partida().jugadores().stream().map(Jugador::nombre).toList());
        salida.println("Elige opciones por número. Escribe ayuda para ver los comandos o cancelar para volver al menú.");
        motor.registrarObservador(avisos);
        try {
            while (true) {
                try {
                    switch (motor.partida().faseActual()) {
                        case SELECCION_ROLES -> seleccionarRol();
                        case TURNO_JUGADOR -> jugarTurno();
                        case FIN_RONDA -> motor.avanzarFase();
                        case FIN_PARTIDA -> {
                            vista.resultado();
                            leer("Comando: ");
                            salida.println("La partida ha terminado. Escribe ayuda para consultar los comandos.");
                        }
                    }
                } catch (ComandoAtendido comando) {
                    // Volver al menú actual, sin continuar con objetivos de una partida anterior.
                } catch (IllegalArgumentException | IllegalStateException error) {
                    salida.println("No se puede realizar la acción: " + error.getMessage());
                }
            }
        } catch (FinEntrada fin) {
            salida.println("Partida cerrada. Los archivos exportados se conservan; los guardados en memoria no.");
        } finally {
            motor.retirarObservador(avisos);
        }
    }

    private void seleccionarRol() {
        salida.println("\nRonda " + motor.partida().ronda() + " - Elige personaje: "
                + motor.contexto().jugadorActual().nombre());
        var roles = motor.partida().mazoRoles().cartas();
        for (int i = 0; i < roles.size(); i++) {
            salida.println((i + 1) + ". " + roles.get(i).nombre() + " (orden " + roles.get(i).ordenTurno() + ") - " + describirHabilidad(roles.get(i).habilidad()));
        }
        motor.ejecutarAccion(new SeleccionarPersonajeAccion(leerIndice("Personaje (0 para cancelar): ", roles.size())));
    }

    private void jugarTurno() {
        Jugador jugador = motor.contexto().jugadorActual();
        salida.println("\nRonda " + motor.partida().ronda() + " - Turno de " + jugador.nombre()
                + " / " + jugador.personaje().nombre());
        vista.resumen(jugador);
        salida.println("Acciones base restantes: " + (2 - motor.partida().accionesBaseRealizadas()));
        salida.println("Habilidad: " + describirHabilidad(jugador.personaje().habilidad()));
        if (jugador.personaje().habilidad().requiereResolucionAlInicio() && !motor.partida().habilidadUsada()) {
            salida.println("Primero debes nombrar un rol. Después podrás realizar tus acciones o terminar el turno.");
            usarHabilidad(jugador);
            return;
        }
        if (motor.partida().habilidadUsada() && !jugador.personaje().habilidad().repetible()) {
            salida.println("Habilidad activa ya utilizada este turno.");
        }
        if (motor.partida().accionesBaseRealizadas() == 2) {
            salida.println("Acciones base agotadas: puedes consultar el estado, usar una habilidad disponible o terminar el turno.");
        }
        salida.println("1. Cobrar  2. Pensar  3. Iniciar estudio  4. Trabajar");
        salida.println("5. Usar habilidad  6. Ver estado y mano  7. Terminar turno");
        switch (leer("Opción: ")) {
            case "1" -> motor.ejecutarAccion(new CobrarAccion());
            case "2" -> motor.ejecutarAccion(new PensarAccion());
            case "3" -> {
                motor.contexto().reglas().validarAccionBase(motor.contexto());
                vista.mano(jugador);
                if (!jugador.cartasIdea().isEmpty()) {
                    motor.ejecutarAccion(new IniciarEstudioAccion(leerIndice("Carta (0 para cancelar): ", jugador.cartasIdea().size())));
                }
            }
            case "4" -> {
                motor.contexto().reglas().validarAccionBase(motor.contexto());
                int indice = elegirEstudio(jugador, e -> e.estado() == EstadoEstudio.EN_DESARROLLO, "Estudio para trabajar");
                if (indice >= 0) motor.ejecutarAccion(new TrabajarAccion(indice));
            }
            case "5" -> usarHabilidad(jugador);
            case "6" -> {
                vista.estado();
                vista.mano(jugador);
            }
            case "7" -> motor.avanzarFase();
            default -> salida.println("Elige una opción entre 1 y 7.");
        }
    }

    private void usarHabilidad(Jugador jugador) {
        var habilidad = jugador.personaje().habilidad();
        if (habilidad instanceof InvestigadorPrincipalHabilidad
                || habilidad instanceof DecanaHabilidad || habilidad instanceof EditorialHabilidad) {
            salida.println("Esta habilidad se aplica automáticamente: " + describirHabilidad(habilidad));
            return;
        }
        motor.contexto().reglas().validarHabilidad(motor.contexto());
        if (habilidad instanceof PreDoctoralHabilidad) {
            int indice = elegirEstudio(jugador, e -> e.estado() == EstadoEstudio.EN_DESARROLLO, "Artículo propio en desarrollo");
            if (indice >= 0) motor.ejecutarAccion(new UsarHabilidadAccion(indice));
        } else if (habilidad instanceof EstadisticoHabilidad) {
            int indice = elegirEstudio(jugador, e -> e.estado() == EstadoEstudio.PUBLICADO, "Artículo propio publicado");
            if (indice >= 0) motor.ejecutarAccion(new UsarHabilidadAccion(indice));
        } else if (habilidad instanceof ComiteEticaHabilidad) {
            var roles = motor.partida().mazoRoles().cartasIniciales();
            for (int i = 0; i < roles.size(); i++) salida.println((i + 1) + ". " + roles.get(i).nombre());
            int indice = leerIndice("Rol que pierde el turno (0 para cancelar): ", roles.size());
            motor.ejecutarAccion(new UsarHabilidadAccion(roles.get(indice).nombre()));
        } else {
            var candidatos = motor.partida().jugadores().stream()
                    .filter(j -> j != jugador).toList();
            if (candidatos.isEmpty()) { salida.println("No hay jugadores objetivo disponibles."); return; }
            for (int i = 0; i < candidatos.size(); i++) {
                salida.println((i + 1) + ". " + candidatos.get(i).nombre());
            }
            String elegido = leer("Jugador objetivo (número o nombre; 0 para cancelar): ");
            Jugador objetivo = candidatos.stream().filter(j -> j.nombre().equalsIgnoreCase(elegido)).findFirst().orElse(null);
            if (objetivo == null) {
                try {
                    int indice = Integer.parseInt(elegido) - 1;
                    if (indice >= 0 && indice < candidatos.size()) objetivo = candidatos.get(indice);
                } catch (NumberFormatException ignorado) { }
            }
            if (objetivo == null) throw new IllegalArgumentException("Elige un jugador de la lista");
            if (habilidad instanceof Revisor2Habilidad) {
                int indice = elegirEstudio(objetivo, e -> e.estado() == EstadoEstudio.EN_DESARROLLO && e.trabajoAcumulado() > 0, "Artículo para revisar (1 moneda, retira 1 punto)");
                if (indice >= 0) motor.ejecutarAccion(new UsarHabilidadAccion(objetivo.nombre(), indice));
            } else {
                motor.ejecutarAccion(new UsarHabilidadAccion(objetivo.nombre()));
            }
        }
    }

    private int elegirEstudio(Jugador jugador, Predicate<Estudio> valido, String mensaje) {
        salida.println(mensaje + " - " + jugador.nombre() + ":");
        var indices = new ArrayList<Integer>();
        for (int i = 0; i < jugador.estudios().size(); i++) {
            if (valido.test(jugador.estudios().get(i))) {
                indices.add(i);
                salida.println(vista.describirEstudio(jugador, i));
            }
        }
        if (indices.isEmpty()) {
            salida.println("No hay estudios válidos para esta acción.");
            return -1;
        }
        while (true) {
            int indice = leerIndice("Estudio (0 para cancelar): ", jugador.estudios().size());
            if (indices.contains(indice)) return indice;
            salida.println("Elige uno de los estudios que aparecen en la lista.");
        }
    }

    private int leerIndice(String mensaje, int cantidad) {
        while (true) {
            try {
                int numero = Integer.parseInt(leer(mensaje));
                if (numero >= 1 && numero <= cantidad) return numero - 1;
            } catch (NumberFormatException ignorado) { }
            salida.println("Introduce un número entre 1 y " + cantidad + ", o 0 para cancelar.");
        }
    }

    private String describirHabilidad(HabilidadPersonaje habilidad) {
        if (habilidad instanceof ComiteEticaHabilidad) return "Nombra un rol al inicio de tu turno. Ese jugador no podrá realizar ninguna acción.";
        if (habilidad instanceof EstadisticoHabilidad) return "Añade 1 de prestigio a uno de tus artículos ya publicado.";
        if (habilidad instanceof PlagiadorHabilidad) return "Intercambia tu mano con otro jugador; una vez por turno.";
        if (habilidad instanceof InvestigadorPrincipalHabilidad) return "Al iniciar tu turno, recibe 1 idea extra. Comenzarás la elección de rol la próxima ronda.";
        if (habilidad instanceof DecanaHabilidad) return "Obtienes inmunidad frente a cualquier habilidad rival durante toda la ronda.";
        if (habilidad instanceof EditorialHabilidad) return "Al iniciar tu turno, recibe 1 Moneda por cada artículo publicado en la mesa.";
        if (habilidad instanceof PreDoctoralHabilidad) return "Una vez por turno, añade 1 punto de trabajo a uno de tus artículos en desarrollo.";
        if (habilidad instanceof Revisor2Habilidad) return "Una vez por turno, podrás pagar 1 Moneda para retirar 1 Punto de Trabajo de un artículo rival en desarrollo.";
        return "Consulta las reglas de este personaje.";
    }

    private void mostrarAyuda() {
        salida.println("\n=== AYUDA ===");
        salida.println("En cada ronda, elige personaje por número. Sus números de orden determinan los turnos.");
        salida.println("Cada turno admite hasta dos acciones base: cobrar, pensar, iniciar estudio o trabajar.");
        salida.println("La habilidad no consume esas acciones. Usa 7 para terminar tu turno cuando lo decidas.");
        salida.println("El Comité debe nombrar un rol antes de acceder al menú; cancelar deja esa decisión pendiente.");
        salida.println("Se publica automáticamente al completar el trabajo. El tercer artículo cierra la partida al final de la ronda.");
        salida.println("Gana quien tenga más prestigio; los empates comparten victoria.");
        salida.println("Comandos disponibles en cualquier pregunta:");
        salida.println("  ayuda | estado | mano | estudios | historial");
        salida.println("  cancelar / volver / 0: volver al menú sin ejecutar la acción pendiente");
        salida.println("  guardar [nombre] | cargar [nombre] | guardados: copias en memoria de esta sesión");
        salida.println("  exportar [archivo] | importar [archivo]: archivos JSON para continuar otro día");
        salida.println("  salir: cerrar; se pierden los guardados en memoria, pero se conservan los archivos");
        salida.println("Sin nombre se usa principal. Sin archivo se usa partida.json en la carpeta del proyecto.");
        salida.println("Esta consola comparte pantalla: pasa el teclado al jugador indicado y evita mostrar su mano a los demás.");
    }

    private String leer(String mensaje) {
        salida.print(mensaje);
        if (!entrada.hasNextLine()) throw new FinEntrada();
        String texto = entrada.nextLine().trim();
        if (texto.equalsIgnoreCase("salir")) throw new FinEntrada();
        procesarComando(texto);
        return texto;
    }

    private void procesarComando(String texto) {
        String[] partes = texto.split("\\s+", 2);
        String comando = partes[0].toLowerCase(Locale.ROOT);
        String argumento = partes.length == 2 ? partes[1].trim() : "";
        try {
            switch (comando) {
                case "ayuda" -> mostrarAyuda();
                case "estado" -> vista.estado();
                case "mano" -> vista.mano(motor.contexto().jugadorActual());
                case "estudios" -> motor.partida().jugadores().forEach(vista::estudios);
                case "cancelar", "volver", "0" -> salida.println("Selección cancelada. No se ha realizado ninguna acción.");
                case "guardar" -> {
                    String nombre = argumento.isEmpty() ? "principal" : argumento;
                    guardados.guardar(nombre, motor.guardarPartida());
                    salida.println("Guardado en memoria: " + nombre);
                }
                case "cargar" -> {
                    motor.recuperarPartida(guardados.cargar(argumento.isEmpty() ? "principal" : argumento));
                    salida.println("Partida recuperada.");
                }
                case "guardados" -> salida.println("Guardados en memoria: " + guardados.nombres());
                case "historial" -> motor.historial().forEach(e -> salida.println(
                        e.numero() + " | " + e.fecha() + " | " + e.tipo() + " | " + e.datos()));
                case "exportar" -> {
                    Path archivo = Path.of(argumento.isEmpty() ? "partida.json" : argumento);
                    json.escribir(archivo, motor.guardarPartida());
                    salida.println("Partida exportada a " + archivo.toAbsolutePath());
                }
                case "importar" -> {
                    Path archivo = Path.of(argumento.isEmpty() ? "partida.json" : argumento);
                    motor.recuperarPartida(json.leer(archivo));
                    salida.println("Partida importada.");
                }
                default -> { return; }
            }
        } catch (IOException error) {
            salida.println("No se pudo acceder al archivo: " + error.getMessage());
        }
        throw new ComandoAtendido();
    }

    private static final class FinEntrada extends RuntimeException {}
    private static final class ComandoAtendido extends RuntimeException {}
}
