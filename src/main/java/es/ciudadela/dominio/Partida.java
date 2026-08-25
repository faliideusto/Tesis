package es.ciudadela.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Partida {

    private final List<Jugador> jugadores;
    private final Mazo<Personaje> mazoRoles;
    private final Mazo<IdeaCarta> mazoIdeas;
    private final Tablero tablero;
    private FaseDeTurno faseActual;
    private int ronda;
    private int indiceJugadorActual;

    public Partida(List<Jugador> jugadores, Mazo<Personaje> mazoRoles, Mazo<IdeaCarta> mazoIdeas) {
        this.jugadores = new ArrayList<>(jugadores);
        this.mazoRoles = mazoRoles;
        this.mazoIdeas = mazoIdeas;
        this.tablero = new Tablero();
        this.faseActual = FaseDeTurno.SELECCION_ROLES;
        this.ronda = 1;
        this.indiceJugadorActual = 0;
    }

    public List<Jugador> jugadores() {
        return Collections.unmodifiableList(jugadores);
    }

    public Mazo<Personaje> mazoRoles() {
        return mazoRoles;
    }

    public Mazo<IdeaCarta> mazoIdeas() {
        return mazoIdeas;
    }

    public Tablero tablero() {
        return tablero;
    }

    public FaseDeTurno faseActual() {
        return faseActual;
    }

    public void faseActual(FaseDeTurno faseActual) {
        this.faseActual = faseActual;
    }

    public int ronda() {
        return ronda;
    }

    public void siguienteRonda() {
        ronda++;
    }

    public Jugador jugadorActual() {
        return jugadores.get(indiceJugadorActual);
    }

    public void siguienteJugador() {
        indiceJugadorActual = (indiceJugadorActual + 1) % jugadores.size();
    }

    public void establecerJugadorInicial(int indiceJugadorActual) {
        this.indiceJugadorActual = indiceJugadorActual;
    }
    public void establecerJugadorInicialPorPersonaje() {
        int indiceMejor = 0;
        int mejorOrden = Integer.MAX_VALUE;

        for (int i = 0; i < jugadores.size(); i++) {
            int orden = jugadores.get(i).personaje().ordenTurno();

            if (orden < mejorOrden) {
                mejorOrden = orden;
                indiceMejor = i;
            }
        }

        indiceJugadorActual = indiceMejor;
    }
}