package es.tesis;

import es.tesis.dominio.Jugador;
import es.tesis.dominio.Partida;
import es.tesis.eventos.EventoJuego;
import es.tesis.motor.ContextoJuego;
import es.tesis.reglas.ReglasJuego;

import java.util.Map;

class ContextoJuegoTest implements ContextoJuego {

    private final Partida partida;

    ContextoJuegoTest(Partida partida) {
        this.partida = partida;
    }

    @Override
    public Partida partida() {
        return partida;
    }

    @Override
    public ReglasJuego reglas() {
        return null;
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
    }

    @Override
    public void publicarEvento(EventoJuego evento) {
    }

    @Override
    public void vetarJugador(String nombre) {
    }

    @Override
    public boolean estaVetado(String nombre) {
        return false;
    }

    @Override
    public void protegerJugador(String nombre) {
    }

    @Override
    public boolean estaProtegido(String nombre) {
        return false;
    }

    @Override
    public void marcarJugadorInicialSiguienteRonda(String nombre) {
    }

    @Override
    public String jugadorInicialSiguienteRonda() {
        return null;
    }
}