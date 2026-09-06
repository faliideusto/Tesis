package es.ciudadela.motor;

import es.ciudadela.acciones.AccionTurno;
import es.ciudadela.dominio.FaseDeTurno;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.dominio.Partida;
import es.ciudadela.eventos.BusEventosSimple;
import es.ciudadela.eventos.EventoJuego;
import es.ciudadela.reglas.ReglasJuego;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class MotorJuegoImpl implements MotorJuego, ContextoJuego {

    private final ReglasJuego reglas;
    private final BusEventosSimple busEventos;
    private final Set<String> vetados;
    private final Set<String> protegidos;
    private Partida partida;
    private EstadoJuego estado;
    private String jugadorInicialSiguienteRonda;

    public MotorJuegoImpl(ReglasJuego reglas, BusEventosSimple busEventos) {
        this.reglas = reglas;
        this.busEventos = busEventos;
        this.vetados = new HashSet<>();
        this.protegidos = new HashSet<>();
    }

    @Override
    public void iniciarPartida(Partida partida) {
        this.partida = partida;
        this.estado = new EstadoSeleccionRoles();
        reglas.prepararPartida(this);
        estado.entrar(this);
        publicarEvento("partida.iniciada", Map.of("ronda", partida.ronda()));
    }

    @Override
    public void avanzarFase() {
        if (estado == null) {
            throw new IllegalStateException("La partida aún no ha iniciado");
        }
        estado.avanzar(this);
    }

    @Override
    public void ejecutarAccion(AccionTurno accion) {
        if (partida == null) {
            throw new IllegalStateException("La partida aún no ha iniciado");
        }
        accion.ejecutar(this);
        if (reglas.debeFinalizarPartida(this)) {
            partida.faseActual(FaseDeTurno.FIN_PARTIDA);
            publicarEvento("partida.fin", Map.of("ronda", partida.ronda()));
        }
    }

    @Override
    public Partida partida() {
        return partida;
    }

    @Override
    public ContextoJuego contexto() {
        return this;
    }

    @Override
    public ReglasJuego reglas() {
        return reglas;
    }

    @Override
    public Jugador jugadorActual() {
        return partida.jugadorActual();
    }

    @Override
    public Jugador buscarJugador(String nombre) {
        return partida.jugadores().stream()
                .filter(jugador -> jugador.nombre().equalsIgnoreCase(nombre))
                .findFirst()
                .orElse(null);
    }

    @Override
    public void publicarEvento(String tipo, Map<String, Object> datos) {
        busEventos.publicar(new EventoJuego(tipo, datos));
    }

    @Override
    public void publicarEvento(EventoJuego evento) {
        busEventos.publicar(evento);
    }

    @Override
    public void vetarJugador(String nombre) {
        if (!protegidos.contains(nombre)) {
            vetados.add(nombre);
        }
    }

    @Override
    public boolean estaVetado(String nombre) {
        return vetados.contains(nombre);
    }

    @Override
    public void protegerJugador(String nombre) {
        protegidos.add(nombre);
    }

    @Override
    public boolean estaProtegido(String nombre) {
        return protegidos.contains(nombre);
    }

    @Override
    public void marcarJugadorInicialSiguienteRonda(String nombre) {
        jugadorInicialSiguienteRonda = nombre;
    }

    @Override
    public String jugadorInicialSiguienteRonda() {
        return jugadorInicialSiguienteRonda;
    }

    public void pasarALaSiguienteRonda() {
        partida.siguienteRonda();

        partida.mazoRoles().reiniciar();

        for (var jugador : partida.jugadores()) {
            jugador.asignarPersonaje(null);
        }

        partida.faseActual(FaseDeTurno.SELECCION_ROLES);

        vetados.clear();
        protegidos.clear();
    }

    public void establecerEstado(EstadoJuego nuevoEstado) {
        this.estado = nuevoEstado;
        nuevoEstado.entrar(this);
    }
}