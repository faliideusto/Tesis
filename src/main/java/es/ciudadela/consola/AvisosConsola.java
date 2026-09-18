package es.ciudadela.consola;

import es.ciudadela.eventos.*;
import java.io.PrintStream;
import java.util.Map;

/** Presentación de eventos; no toma decisiones ni modifica la partida. */
public final class AvisosConsola implements ObservadorJuego {
    private final PrintStream salida;

    public AvisosConsola(PrintStream salida) { this.salida = salida; }

    @Override public void alRecibir(EventoJuego evento) {
        Map<String, Object> d = evento.datos();
        String mensaje = switch (evento.tipo()) {
            case "fase.seleccion_roles" -> "Ronda " + d.get("ronda") + ": comienza la selección de personajes.";
            case "accion.seleccionar_personaje" -> d.get("jugador") + " ha elegido personaje.";
            case "fase.turno" -> "Empieza el turno de " + d.get("jugador") + ".";
            case "fase.fin_ronda" -> "Termina la ronda " + d.get("ronda") + ".";
            case "turno.vetado" -> d.get("jugador") + " pierde su turno por el veto del Comité.";
            case "accion.cobrar" -> d.get("jugador") + " cobra 2 monedas. Total: " + d.get("monedas") + ".";
            case "accion.pensar" -> d.get("jugador") + " roba una carta de idea. Cartas en mano: " + d.get("mano") + ".";
            case "accion.iniciar_estudio" -> d.get("jugador") + " inicia «" + d.get("articulo") + "» pagando su coste.";
            case "accion.trabajar" -> trabajo(d.get("jugador"), d, d.get("trabajo") + " punto(s) de trabajo");
            case "habilidad.editorial.trabajo" -> trabajo(d.get("actor"), d, "1 punto de trabajo por 3 monedas");
            case "habilidad.editorial.inicio" -> d.get("actor") + " recibe " + d.get("monedasRecibidas") + " moneda(s) de Editorial.";
            case "habilidad.investigador_principal" -> d.get("actor")
                    + (Boolean.TRUE.equals(d.get("cartaRobada")) ? " roba una idea extra" : " no roba idea extra porque el mazo está vacío")
                    + " y elegirá primero la próxima ronda.";
            case "habilidad.comite_etica" -> d.get("actor") + " nombra el rol «" + d.get("rol") + "» para el veto; se aplicará si corresponde.";
            case "habilidad.estadistico" -> d.get("actor") + " añade 1 de prestigio a «" + d.get("articulo") + "».";
            case "habilidad.plagiador" -> d.get("actor") + " intercambia su mano con " + d.get("objetivo") + ".";
            case "habilidad.revisor_2" -> d.get("actor") + " paga 1 moneda y retira 1 de trabajo de «" + d.get("articulo") + "» de " + d.get("objetivo") + ".";
            case "habilidad.decana" -> d.get("actor") + " tiene la inmunidad de Decana durante toda la ronda.";
            case "partida.fin" -> "La partida ha terminado. Ganador(es): " + d.get("ganadores") + ".";
            // La consola ya informa de errores y guardados; no duplicar estos mensajes.
            default -> null;
        };
        if (mensaje != null) salida.println("\n[Aviso] " + mensaje);
    }

    private String trabajo(Object jugador, Map<String, Object> datos, String descripcion) {
        String mensaje = jugador + " añade " + descripcion + " a «" + datos.get("articulo") + "».";
        if ("PUBLICADO".equals(datos.get("estado"))) {
            mensaje += " ¡Artículo publicado! Gana " + datos.get("prestigio") + " de prestigio.";
        }
        return mensaje;
    }
}
