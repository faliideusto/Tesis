package es.tesis.web;

import java.util.List;

/** Contrato de presentación. Nunca se serializan entidades ni instantáneas del motor. */
public final class Vistas {
    private Vistas() {}
    public record Sala(String codigo, long revision, String fase, String yo, String anfitrion,
                       boolean soyAnfitrion, List<String> jugadores, Estado partida, Progreso progreso) {}
    public record Progreso(String estado, boolean cuenta, Integer xp, java.util.UUID partidaId) {}
    public record InteraccionPropia(String interactionId,long disponibleEn) {}
    public record EventoInteraccion(long numero,String emisor,String objetivo,String interactionId,long fecha) {}
    public record Interacciones(long ultimo,long ahora,InteraccionPropia propia,List<EventoInteraccion> eventos) {}
    public record AccesoSala(String codigo, String playerToken, Sala sala) {}
    public record Configuracion(int minimo, int maximo, int capacidadTablero, String limitacion) {}
    public record Carta(int indice, String nombre, int coste, int trabajo, int prestigio, String arte, String marco, int ingresoPorTurno, boolean legendaria) {}
    public record Rol(int indice, String nombre, int orden, String habilidad, String arte, boolean automatica) {}
    public record Estudio(int indice, Carta carta, int trabajo, int prestigioExtra, boolean publicado) {}
    public record Jugador(String nombre, int monedas, int prestigio, int cartas, int publicados,
                          Rol rol, List<Estudio> estudios, boolean activo, CosmeticosPartida cosmeticos) {
        public Jugador(String nombre,int monedas,int prestigio,int cartas,int publicados,Rol rol,List<Estudio> estudios,boolean activo) {
            this(nombre,monedas,prestigio,cartas,publicados,rol,estudios,activo,CosmeticosPartida.originales());
        }
    }
    public record Opcion(String etiqueta, Integer indice, String objetivo, Rol rol, String previsualizacion) {
        public Opcion(String etiqueta, Integer indice, String objetivo) { this(etiqueta, indice, objetivo, null, ""); }
        public Opcion(String etiqueta, Integer indice, String objetivo, Rol rol) { this(etiqueta, indice, objetivo, rol, ""); }
    }
    public record Accion(String id, String nombre, String descripcion, boolean disponible,
                         String motivo, List<Opcion> opciones) {}
    public record Evento(long numero, String texto, boolean publicacion, String tipo, String actor, String objetivo,
                         Integer estudio, Integer cantidad, boolean robo, Rol rolPublico) {}
    public record Estado(long revision, String fase, int ronda, String actual, boolean bloqueada,
                         int ideas, int roles, int accionesRestantes, boolean habilidadPendiente,
                         List<Jugador> jugadores, List<Carta> mano, List<Rol> seleccion, List<Rol> catalogoSeleccion,
                         List<Accion> acciones, List<Evento> eventos, List<String> ganadores,
                         boolean ultimaRonda, String aviso) {}
    public record Peticion(Long revision, String tipo, Integer indice, String objetivo, List<String> nombres) {}
}
