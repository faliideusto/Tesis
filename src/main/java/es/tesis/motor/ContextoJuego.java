package es.tesis.motor;

import es.tesis.dominio.Jugador;
import es.tesis.dominio.Partida;
import es.tesis.eventos.EventoJuego;
import es.tesis.reglas.ReglasJuego;

import java.util.Map;

public interface ContextoJuego {

    Partida partida();

    ReglasJuego reglas();

    Jugador jugadorActual();

    Jugador buscarJugador(String nombre);

    void publicarEvento(String tipo, Map<String, Object> datos);

    void publicarEvento(EventoJuego evento);

    void vetarJugador(String nombre);

    boolean estaVetado(String nombre);

    void protegerJugador(String nombre);

    boolean estaProtegido(String nombre);

    void marcarJugadorInicialSiguienteRonda(String nombre);

    String jugadorInicialSiguienteRonda();
}