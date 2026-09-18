package es.ciudadela.motor;

import es.ciudadela.acciones.AccionTurno;
import es.ciudadela.dominio.*;
import es.ciudadela.eventos.BusEventosSimple;
import es.ciudadela.reglas.ReglasJuego;
import es.ciudadela.reglas.ReglasAcademicas;
import es.ciudadela.eventos.RegistroPartida;
import es.ciudadela.eventos.RegistroEvento;
import es.ciudadela.persistencia.PartidaGuardada;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class MotorJuegoImpl implements MotorJuego {
    private final ReglasJuego reglas;
    private final BusEventosSimple busEventos;
    private ContextoJuegoImpl contexto;
    private EstadoJuego estado;
    private final RegistroPartida registro = new RegistroPartida();

    public MotorJuegoImpl(ReglasJuego reglas, BusEventosSimple busEventos) {
        this.reglas = Objects.requireNonNull(reglas);
        this.busEventos = Objects.requireNonNull(busEventos);
    }

    @Override
    public void iniciarPartida(Partida partida) {
        if (contexto != null) throw new IllegalStateException("El motor ya tiene una partida iniciada");
        reglas.validarPartida(partida);
        partida.establecerJugadorInicialAleatorio();
        contexto = new ContextoJuegoImpl(partida, reglas, busEventos, registro);
        reglas.prepararPartida(contexto);
        entrarEn(new EstadoSeleccionRoles());
        contexto.publicarEvento("partida.iniciada", Map.of("ronda", partida.ronda()));
    }

    @Override
    public void avanzarFase() {
        reglas.validarActiva(contexto);
        entrarEn(estado.avanzar(contexto));
    }

    @Override
    public void ejecutarAccion(AccionTurno accion) {
        reglas.validarActiva(contexto);
        if (accion == null) throw new IllegalArgumentException("La acción no puede ser nula");
        try {
            accion.ejecutar(contexto);
        } catch (IllegalArgumentException | IllegalStateException error) {
            contexto.publicarEvento("accion.rechazada", Map.of("accion", accion.nombre(),
                    "jugador", contexto.jugadorActual().nombre(), "motivo", String.valueOf(error.getMessage())));
            throw error;
        }
        if (estado instanceof EstadoSeleccionRoles && partida().seleccionCompleta()) {
            avanzarFase();
        }
    }

    private void entrarEn(EstadoJuego nuevoEstado) {
        estado = nuevoEstado;
        if (estado instanceof EstadoSeleccionRoles) contexto.limpiarEfectosRonda();
        estado.entrar(contexto);
        // El motor coordina los saltos; los estados no conocen su implementación.
        while (estado instanceof EstadoTurno && contexto.estaVetado(contexto.jugadorActual().nombre())) {
            contexto.publicarEvento("turno.vetado", Map.of("jugador", contexto.jugadorActual().nombre()));
            estado = estado.avanzar(contexto);
            estado.entrar(contexto);
        }
    }

    @Override public Partida partida() { return contexto == null ? null : contexto.partida(); }
    @Override public ContextoJuego contexto() { return contexto; }

    @Override public void registrarObservador(es.ciudadela.eventos.ObservadorJuego observador) {
        busEventos.registrar(observador);
    }

    @Override public void retirarObservador(es.ciudadela.eventos.ObservadorJuego observador) {
        busEventos.retirar(observador);
    }

    @Override public PartidaGuardada guardarPartida() {
        if (contexto == null) throw new IllegalStateException("La partida aún no ha iniciado");
        validarReglasGuardado();
        var datos = partida().guardar();
        String fecha = Instant.now().toString();
        contexto.publicarEvento("partida.guardada", Map.of("ronda", partida().ronda(), "fase", partida().faseActual().name()));
        return new PartidaGuardada(PartidaGuardada.VERSION, PartidaGuardada.REGLAS, fecha, datos,
                contexto.vetadosGuardados(), contexto.protegidosGuardados(), contexto.jugadorInicialSiguienteRonda(), historial());
    }

    @Override public void recuperarPartida(PartidaGuardada guardada) {
        Objects.requireNonNull(guardada, "La partida guardada no puede ser nula");
        validarReglasGuardado();
        // Primero reconstruir y validar; un fallo deja intacta la partida que se estaba jugando.
        Partida recuperada = Partida.restaurar(guardada.partida());
        ContextoJuegoImpl nuevo = new ContextoJuegoImpl(recuperada, reglas, busEventos, registro);
        nuevo.recuperarEfectos(guardada);
        if (recuperada.faseActual() == FaseDeTurno.SELECCION_ROLES
                && (!guardada.vetados().isEmpty() || !guardada.protegidos().isEmpty())) {
            throw new IllegalArgumentException("La selección no puede tener efectos de la ronda anterior");
        }
        if (recuperada.faseActual() == FaseDeTurno.TURNO_JUGADOR && nuevo.estaVetado(nuevo.jugadorActual().nombre())) {
            throw new IllegalArgumentException("El guardado no puede estar detenido en un turno vetado");
        }
        if (recuperada.faseActual() == FaseDeTurno.TURNO_JUGADOR
                && nuevo.jugadorActual().personaje().habilidad().requiereResolucionAlInicio()
                && !recuperada.habilidadUsada() && recuperada.accionesBaseRealizadas() > 0) {
            throw new IllegalArgumentException("Guardado incompatible: se realizaron acciones antes de resolver la habilidad inicial");
        }
        if (contexto == null) registro.importar(guardada.eventos());
        contexto = nuevo;
        estado = switch (recuperada.faseActual()) {
            case SELECCION_ROLES -> new EstadoSeleccionRoles();
            case TURNO_JUGADOR -> new EstadoTurno();
            case FIN_RONDA -> new EstadoFinRonda();
            case FIN_PARTIDA -> new EstadoFinPartida();
        };
        // No llamar a entrarEn: repetiría efectos automáticos, descartes o eventos de finalización.
        contexto.publicarEvento("partida.recuperada", Map.of("guardado", guardada.fecha(),
                "ronda", recuperada.ronda(), "fase", recuperada.faseActual().name()));
    }

    @Override public List<RegistroEvento> historial() { return registro.eventos(); }

    private void validarReglasGuardado() {
        if (reglas.getClass() != ReglasAcademicas.class) {
            throw new IllegalStateException("El formato de guardado actual admite la variante académica");
        }
    }
}
