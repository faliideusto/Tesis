package es.tesis.dominio;

import es.tesis.habilidades.*;
import java.util.*;

/** Datos inmutables: no contiene jugadores, mazos ni estrategias de ejecución compartidos. */
public record InstantaneaPartida(List<JugadorDatos> jugadores, List<RolDatos> rolesIniciales,
        List<Integer> rolesDisponibles, List<IdeaDatos> ideasIniciales, List<IdeaDatos> ideasDisponibles,
        List<EstudioEnMesa> mesa, FaseDeTurno fase, int ronda, int jugadorActual,
        int accionesRealizadas, boolean habilidadUsada, boolean ideasInagotables) {
    public InstantaneaPartida {
        jugadores = List.copyOf(jugadores);
        rolesIniciales = List.copyOf(rolesIniciales);
        rolesDisponibles = List.copyOf(rolesDisponibles);
        ideasIniciales = List.copyOf(ideasIniciales);
        ideasDisponibles = List.copyOf(ideasDisponibles);
        mesa = List.copyOf(mesa);
        Objects.requireNonNull(fase);
        if (jugadores.isEmpty() || jugadorActual < 0 || jugadorActual >= jugadores.size()
                || ronda < 1 || accionesRealizadas < 0 || accionesRealizadas > 2) {
            throw new IllegalArgumentException("Estado de partida guardada no válido");
        }
    }

    public record IdeaDatos(String nombre, int coste, int trabajo, int prestigio) {
        public IdeaDatos { new IdeaCarta(nombre, coste, trabajo, prestigio); }
        static IdeaDatos de(IdeaCarta carta) {
            return new IdeaDatos(carta.nombre(), carta.costeMonedas(), carta.trabajoRequerido(), carta.prestigio());
        }
        IdeaCarta crear() { return new IdeaCarta(nombre, coste, trabajo, prestigio); }
    }

    public record EstudioDatos(IdeaDatos idea, int trabajo, int prestigioExtra) {
        public EstudioDatos {
            Objects.requireNonNull(idea);
            if (trabajo < 0 || prestigioExtra < 0 || (trabajo < idea.trabajo() && prestigioExtra != 0)) {
                throw new IllegalArgumentException("Estudio guardado no válido");
            }
        }
        static EstudioDatos de(Estudio estudio) {
            return new EstudioDatos(IdeaDatos.de(estudio.carta()), estudio.trabajoAcumulado(), estudio.prestigioExtra());
        }
    }

    public record JugadorDatos(String nombre, int monedas, int prestigio, Integer rol,
            List<IdeaDatos> mano, List<EstudioDatos> estudios) {
        public JugadorDatos {
            if (nombre == null || nombre.isBlank() || monedas < 0 || prestigio < 0) {
                throw new IllegalArgumentException("Jugador guardado no válido");
            }
            mano = List.copyOf(mano);
            estudios = List.copyOf(estudios);
        }
    }

    public record EstudioEnMesa(int jugador, int estudio) {
        public EstudioEnMesa {
            if (jugador < 0 || estudio < 0) throw new IllegalArgumentException("Referencia de estudio no válida");
        }
    }

    public record RolDatos(String nombre, int orden, TipoHabilidad habilidad) {
        public RolDatos {
            if (nombre == null || nombre.isBlank() || orden < 1 || habilidad == null) {
                throw new IllegalArgumentException("Rol guardado no válido");
            }
        }
        static RolDatos de(Personaje rol) {
            return new RolDatos(rol.nombre(), rol.ordenTurno(), TipoHabilidad.de(rol.habilidad()));
        }
        Personaje crear() { return new Personaje(nombre, orden, habilidad.crear()); }
    }

    /** Identificadores estables: el JSON nunca contiene nombres de clases que se instancien por reflexión. */
    public enum TipoHabilidad {
        COMITE, ESTADISTICO, PLAGIADOR, INVESTIGADOR, DECANA, EDITORIAL, PREDOCTORAL, REVISOR;

        public HabilidadPersonaje crear() {
            return switch (this) {
                case COMITE -> new ComiteEticaHabilidad();
                case ESTADISTICO -> new EstadisticoHabilidad();
                case PLAGIADOR -> new PlagiadorHabilidad();
                case INVESTIGADOR -> new InvestigadorPrincipalHabilidad();
                case DECANA -> new DecanaHabilidad();
                case EDITORIAL -> new EditorialHabilidad();
                case PREDOCTORAL -> new PreDoctoralHabilidad();
                case REVISOR -> new Revisor2Habilidad();
            };
        }
        static TipoHabilidad de(HabilidadPersonaje habilidad) {
            return Arrays.stream(values()).filter(t -> t.crear().getClass() == habilidad.getClass()).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Esta habilidad no admite guardado todavía"));
        }
    }
}
