package es.tesis.reglas;

import es.tesis.dominio.Jugador;
import es.tesis.dominio.Partida;
import es.tesis.dominio.FaseDeTurno;
import java.util.HashSet;
import es.tesis.motor.ContextoJuego;

public class ReglasAcademicas implements ReglasJuego {
    public static final int MIN_JUGADORES = 3;
    public static final int MAX_JUGADORES = 5;

    public static void validarNumeroJugadores(int cantidad) {
        if (cantidad < MIN_JUGADORES || cantidad > MAX_JUGADORES) {
            throw new IllegalArgumentException("La partida debe tener entre 3 y 5 jugadores");
        }
    }

    @Override
    public void prepararPartida(ContextoJuego contexto) {
        for (Jugador jugador : contexto.partida().jugadores()) {
            jugador.sumarMonedas(monedasIniciales());
            for (int i = 0; i < cartasIdeaIniciales(); i++) {
                if (!contexto.partida().mazoIdeas().estaVacio()) {
                    jugador.añadirCartaIdea(contexto.partida().mazoIdeas().robar());
                }
            }
        }
    }

    @Override
    public boolean debeFinalizarPartida(ContextoJuego contexto) {
        return contexto.partida().jugadores().stream().anyMatch(jugador -> jugador.cantidadPublicados() >= 3);
    }

    @Override
    public int monedasIniciales() {
        return 2;
    }

    @Override
    public int cartasIdeaIniciales() {
        return 2;
    }

    @Override
    public int puntosTrabajoBase() {
        return 1;
    }
    public void validarPartida(Partida candidata) {
        if (candidata == null || candidata.jugadores().isEmpty()) {
            throw new IllegalArgumentException("La partida debe tener jugadores");
        }
        validarNumeroJugadores(candidata.jugadores().size());
        var nombres = new HashSet<String>();
        for (Jugador jugador : candidata.jugadores()) {
            if (jugador == null || jugador.nombre() == null || jugador.nombre().isBlank()
                    || !nombres.add(jugador.nombre().toLowerCase(java.util.Locale.ROOT))) {
                throw new IllegalArgumentException("Los jugadores deben tener nombres únicos y no vacíos");
            }
            if (jugador.personaje() != null || jugador.monedas() != 0 || jugador.prestigio() != 0
                    || !jugador.cartasIdea().isEmpty() || !jugador.estudios().isEmpty()) {
                throw new IllegalArgumentException("Los jugadores deben empezar sin recursos ni personaje");
            }
        }
        if (candidata.mazoRoles() == null || candidata.mazoRoles().cartas().size()
                < candidata.jugadores().size() + Partida.numeroDescartes(candidata.jugadores().size())) {
            throw new IllegalArgumentException("Debe haber un rol por jugador y suficientes roles para descartar");
        }
        var ordenes = new HashSet<Integer>();
        var roles = new HashSet<String>();
        for (var rol : candidata.mazoRoles().cartas()) {
            if (rol == null || rol.nombre() == null || rol.nombre().isBlank() || rol.habilidad() == null
                    || rol.ordenTurno() < 1 || !ordenes.add(rol.ordenTurno())
                    || !roles.add(rol.nombre().toLowerCase(java.util.Locale.ROOT))) {
                throw new IllegalArgumentException("Los roles deben tener nombre y orden únicos y una habilidad");
            }
        }
        if (candidata.mazoIdeas() == null
                || (!candidata.mazoIdeas().esInagotable()
                    && candidata.mazoIdeas().cartas().size() < candidata.jugadores().size() * cartasIdeaIniciales())) {
            throw new IllegalArgumentException("No hay ideas suficientes para el reparto inicial");
        }
    }
    @Override
    public void validarActiva(ContextoJuego contexto) {
        if (contexto == null) throw new IllegalStateException("La partida aún no ha iniciado");
        if (contexto.partida().faseActual() == FaseDeTurno.FIN_PARTIDA) {
            throw new IllegalStateException("La partida ha terminado");
        }
    }

    @Override
    public void validarSeleccion(ContextoJuego contexto) {
        validarActiva(contexto);
        if (contexto.partida().faseActual() != FaseDeTurno.SELECCION_ROLES) {
            throw new IllegalStateException("Solo se pueden elegir personajes durante la selección");
        }
        if (contexto.jugadorActual().personaje() != null) throw new IllegalStateException("El jugador ya tiene personaje");
    }

    @Override
    public void validarInicioTurnos(ContextoJuego contexto) {
        validarActiva(contexto);
        if (contexto.partida().faseActual() != FaseDeTurno.SELECCION_ROLES
                || contexto.partida().jugadores().stream().anyMatch(j -> j.personaje() == null)) {
            throw new IllegalStateException("Todos los jugadores deben elegir personaje antes de empezar los turnos");
        }
    }

    private void validarTurno(ContextoJuego contexto) {
        validarActiva(contexto);
        if (contexto.partida().faseActual() != FaseDeTurno.TURNO_JUGADOR) {
            throw new IllegalStateException("Esta acción solo se permite durante un turno");
        }
        if (contexto.jugadorActual().personaje() == null) throw new IllegalStateException("El jugador no tiene personaje");
        if (contexto.estaVetado(contexto.jugadorActual().nombre())) throw new IllegalStateException("El jugador tiene el turno vetado");
    }

    @Override
    public void validarAccionBase(ContextoJuego contexto) {
        validarTurno(contexto);
        validarHabilidadInicialResuelta(contexto);
        if (contexto.partida().accionesBaseRealizadas() >= 2) {
            throw new IllegalStateException("Ya se han realizado las dos acciones del turno");
        }
    }

    @Override
    public void validarFinTurno(ContextoJuego contexto) {
        validarTurno(contexto);
        validarHabilidadInicialResuelta(contexto);
    }

    private void validarHabilidadInicialResuelta(ContextoJuego contexto) {
        if (contexto.jugadorActual().personaje().habilidad().requiereResolucionAlInicio()
                && !contexto.partida().habilidadUsada()) {
            throw new IllegalStateException("Debes resolver la habilidad inicial antes de actuar o terminar el turno");
        }
    }

    @Override
    public void validarHabilidad(ContextoJuego contexto) {
        validarTurno(contexto);
        var habilidad = contexto.jugadorActual().personaje().habilidad();
        if (!habilidad.repetible() && contexto.partida().habilidadUsada()) {
            throw new IllegalStateException("La habilidad ya se ha usado en este turno");
        }
    }
}
