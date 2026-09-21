package es.tesis.web;

import java.util.List;

/** Contrato de presentación. Nunca se serializan entidades ni instantáneas del motor. */
public final class Vistas {
    private Vistas() {}
    public record Sala(String codigo, long revision, String fase, String yo, String anfitrion,
                       boolean soyAnfitrion, List<String> jugadores, Estado partida) {}
    public record AccesoSala(String codigo, String playerToken, Sala sala) {}
    public record Configuracion(int minimo, int maximo, int capacidadTablero, String limitacion) {}
    public record Carta(int indice, String nombre, int coste, int trabajo, int prestigio, String arte, String marco, int ingresoPorTurno, boolean legendaria) {}
    public record Rol(int indice, String nombre, int orden, String habilidad, String arte, boolean automatica) {}
    public record Estudio(int indice, Carta carta, int trabajo, int prestigioExtra, boolean publicado) {}
    public record Jugador(String nombre, int monedas, int prestigio, int cartas, int publicados,
                          Rol rol, List<Estudio> estudios, boolean activo) {}
    public record Opcion(String etiqueta, Integer indice, String objetivo, Rol rol) {
        public Opcion(String etiqueta, Integer indice, String objetivo) { this(etiqueta, indice, objetivo, null); }
    }
    public record Accion(String id, String nombre, String descripcion, boolean disponible,
                         String motivo, List<Opcion> opciones) {}
    public record Evento(long numero, String texto, boolean publicacion, String tipo, String actor, String objetivo,
                         Integer estudio, Integer cantidad, boolean robo) {}
    public record Estado(long revision, String fase, int ronda, String actual, boolean bloqueada,
                         int ideas, int roles, int accionesRestantes, boolean habilidadPendiente,
                         List<Jugador> jugadores, List<Carta> mano, List<Rol> seleccion,
                         List<Accion> acciones, List<Evento> eventos, List<String> ganadores,
                         boolean ultimaRonda, String aviso) {}
    public record Peticion(Long revision, String tipo, Integer indice, String objetivo, List<String> nombres) {}
}
