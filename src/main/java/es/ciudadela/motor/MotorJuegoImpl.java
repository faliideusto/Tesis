package es.ciudadela.motor;

import es.ciudadela.acciones.AccionTurno;
import es.ciudadela.dominio.*;
import es.ciudadela.eventos.BusEventosSimple;
import es.ciudadela.reglas.ReglasJuego;
import java.util.Map;
import java.util.Objects;

public final class MotorJuegoImpl implements MotorJuego {
    private final ReglasJuego reglas;
    private final BusEventosSimple busEventos;
    private ContextoJuegoImpl contexto;
    private EstadoJuego estado;

    public MotorJuegoImpl(ReglasJuego reglas, BusEventosSimple busEventos) {
        this.reglas = Objects.requireNonNull(reglas);
        this.busEventos = Objects.requireNonNull(busEventos);
    }

    @Override
    public void iniciarPartida(Partida partida) {
        if (contexto != null) throw new IllegalStateException("El motor ya tiene una partida iniciada");
        reglas.validarPartida(partida);
        partida.establecerJugadorInicialAleatorio();
        contexto = new ContextoJuegoImpl(partida, reglas, busEventos);
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
        accion.ejecutar(contexto);
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
}
