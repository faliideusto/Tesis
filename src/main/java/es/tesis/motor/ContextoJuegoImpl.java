package es.tesis.motor;

import es.tesis.dominio.*;
import es.tesis.eventos.*;
import es.tesis.reglas.ReglasJuego;
import java.util.*;

final class ContextoJuegoImpl implements ContextoJuego {
    private final Partida partida;
    private final ReglasJuego reglas;
    private final BusEventosSimple busEventos;
    private final RegistroPartida registro;
    private final Set<String> vetados = new HashSet<>();
    private final Set<String> protegidos = new HashSet<>();
    private String jugadorInicialSiguienteRonda;

    ContextoJuegoImpl(Partida partida, ReglasJuego reglas, BusEventosSimple busEventos, RegistroPartida registro) {
        this.partida = partida;
        this.reglas = reglas;
        this.busEventos = busEventos;
        this.registro = registro;
        jugadorInicialSiguienteRonda = partida.jugadorActual().nombre();
    }

    @Override public Partida partida() { return partida; }

    void limpiarEfectosRonda() {
        vetados.clear();
        protegidos.clear();
    }

    Set<String> vetadosGuardados() { return Set.copyOf(vetados); }
    Set<String> protegidosGuardados() { return Set.copyOf(protegidos); }

    void recuperarEfectos(es.tesis.persistencia.PartidaGuardada guardada) {
        vetados.addAll(guardada.vetados());
        protegidos.addAll(guardada.protegidos());
        jugadorInicialSiguienteRonda = guardada.siguienteJugadorInicial();
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
        publicarEvento(new EventoJuego(tipo, datos));
    }

    @Override
    public void publicarEvento(EventoJuego evento) {
        registro.alRecibir(evento);
        busEventos.publicar(evento);
    }

    @Override
    public void vetarJugador(String nombre) {
        Jugador jugador = buscarJugador(nombre);
        if (jugador == null) throw new IllegalArgumentException("Jugador desconocido");
        if (!estaProtegido(jugador.nombre())) {
            vetados.add(jugador.nombre());
        }
    }

    @Override
    public boolean estaVetado(String nombre) {
        Jugador jugador = buscarJugador(nombre);
        return jugador != null && vetados.contains(jugador.nombre()) && !estaProtegido(jugador.nombre());
    }

    @Override
    public void protegerJugador(String nombre) {
        protegidos.add(nombre);
    }

    @Override
    public boolean estaProtegido(String nombre) {
        Jugador jugador = buscarJugador(nombre);
        return jugador != null && (protegidos.contains(jugador.nombre())
                || (jugador.personaje() != null && jugador.personaje().habilidad().esInmune()));
    }

    @Override
    public void marcarJugadorInicialSiguienteRonda(String nombre) {
        jugadorInicialSiguienteRonda = nombre;
    }

    @Override
    public String jugadorInicialSiguienteRonda() {
        return jugadorInicialSiguienteRonda;
    }

}
