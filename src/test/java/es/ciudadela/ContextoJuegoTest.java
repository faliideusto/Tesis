package es.ciudadela;

import es.ciudadela.dominio.Jugador;
import es.ciudadela.dominio.Partida;
import es.ciudadela.eventos.EventoJuego;
import es.ciudadela.motor.ContextoJuego;
import es.ciudadela.reglas.ReglasJuego;

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