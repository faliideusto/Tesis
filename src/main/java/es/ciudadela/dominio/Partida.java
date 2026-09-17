package es.ciudadela.dominio;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

public class Partida {
    private final List<Jugador> jugadores;
    private final Mazo<Personaje> mazoRoles;
    private final Mazo<IdeaCarta> mazoIdeas;
    private final Tablero tablero = new Tablero();
    private FaseDeTurno faseActual = FaseDeTurno.SELECCION_ROLES;
    private int ronda = 1;
    private int indiceJugadorActual;
    private int accionesBaseRealizadas;
    private boolean habilidadUsada;
    private int rondaPreparada;
    private boolean jugadorInicialElegido;

    public Partida(List<Jugador> jugadores, Mazo<Personaje> mazoRoles, Mazo<IdeaCarta> mazoIdeas) {
        this.jugadores = Collections.unmodifiableList(new ArrayList<>(Objects.requireNonNull(jugadores)));
        this.mazoRoles = mazoRoles;
        this.mazoIdeas = mazoIdeas;
    }

    public List<Jugador> jugadores() { return jugadores; }
    public Mazo<Personaje> mazoRoles() { return mazoRoles; }
    public Mazo<IdeaCarta> mazoIdeas() { return mazoIdeas; }
    public Tablero tablero() { return tablero; }
    public FaseDeTurno faseActual() { return faseActual; }
    public int ronda() { return ronda; }
    public Jugador jugadorActual() { return jugadores.get(indiceJugadorActual); }
    public int accionesBaseRealizadas() { return accionesBaseRealizadas; }
    public boolean habilidadUsada() { return habilidadUsada; }

    public void registrarHabilidad() {
        exigirFase(FaseDeTurno.TURNO_JUGADOR);
        habilidadUsada = true;
    }

    public void registrarAccionBase() {
        exigirFase(FaseDeTurno.TURNO_JUGADOR);
        if (accionesBaseRealizadas >= 2) throw new IllegalStateException("Ya se han realizado las dos acciones del turno");
        accionesBaseRealizadas++;
    }

    private void reiniciarTurno() {
        accionesBaseRealizadas = 0;
        habilidadUsada = false;
    }

    public void establecerJugadorInicialAleatorio() {
        exigirFase(FaseDeTurno.SELECCION_ROLES);
        if (jugadorInicialElegido || rondaPreparada != 0 || jugadores.isEmpty()) {
            throw new IllegalStateException("El jugador inicial solo se elige una vez antes de la selección");
        }
        indiceJugadorActual = ThreadLocalRandom.current().nextInt(jugadores.size());
        jugadorInicialElegido = true;
    }

    public boolean prepararSeleccion() {
        exigirFase(FaseDeTurno.SELECCION_ROLES);
        if (rondaPreparada == ronda) return false;
        if (mazoRoles.cartas().size() <= jugadores.size()) throw new IllegalStateException("No hay roles suficientes para descartar");
        mazoRoles.robarAleatoria();
        rondaPreparada = ronda;
        return true;
    }

    public boolean seleccionCompleta() {
        return !jugadores.isEmpty() && jugadores.stream().allMatch(j -> j.personaje() != null);
    }

    public void avanzarSelector() {
        exigirFase(FaseDeTurno.SELECCION_ROLES);
        if (jugadorActual().personaje() == null) throw new IllegalStateException("El jugador debe elegir personaje");
        if (!seleccionCompleta()) indiceJugadorActual = (indiceJugadorActual + 1) % jugadores.size();
    }

    public void iniciarTurnos() {
        exigirFase(FaseDeTurno.SELECCION_ROLES);
        if (!seleccionCompleta() || rondaPreparada != ronda) throw new IllegalStateException("La selección no ha terminado");
        int menorOrden = Integer.MAX_VALUE;
        var ordenes = new HashSet<Integer>();
        int primero = 0;
        for (int i = 0; i < jugadores.size(); i++) {
            int orden = jugadores.get(i).personaje().ordenTurno();
            if (!ordenes.add(orden)) throw new IllegalStateException("Los personajes deben tener órdenes distintos");
            if (orden < menorOrden) { menorOrden = orden; primero = i; }
        }
        indiceJugadorActual = primero;
        faseActual = FaseDeTurno.TURNO_JUGADOR;
        reiniciarTurno();
    }

    /** Termina el turno actual; devuelve false al terminar el último turno de la ronda. */
    public boolean avanzarTurno() {
        exigirFase(FaseDeTurno.TURNO_JUGADOR);
        int actual = jugadorActual().personaje().ordenTurno();
        int siguiente = -1;
        int ordenSiguiente = Integer.MAX_VALUE;
        for (int i = 0; i < jugadores.size(); i++) {
            int orden = jugadores.get(i).personaje().ordenTurno();
            if (orden > actual && orden < ordenSiguiente) { siguiente = i; ordenSiguiente = orden; }
        }
        if (siguiente == -1) {
            faseActual = FaseDeTurno.FIN_RONDA;
            return false;
        }
        indiceJugadorActual = siguiente;
        reiniciarTurno();
        return true;
    }

    public void iniciarSiguienteRonda(String nombreInicial) {
        exigirFase(FaseDeTurno.FIN_RONDA);
        int inicial = -1;
        for (int i = 0; i < jugadores.size(); i++) {
            if (jugadores.get(i).nombre().equalsIgnoreCase(nombreInicial)) inicial = i;
        }
        if (inicial < 0) throw new IllegalArgumentException("Jugador inicial desconocido");
        mazoRoles.reiniciar();
        jugadores.forEach(j -> j.asignarPersonaje(null));
        indiceJugadorActual = inicial;
        ronda++;
        reiniciarTurno();
        faseActual = FaseDeTurno.SELECCION_ROLES;
    }

    public void finalizar() {
        exigirFase(FaseDeTurno.FIN_RONDA);
        faseActual = FaseDeTurno.FIN_PARTIDA;
    }

    public List<Jugador> ganadores() {
        if (faseActual != FaseDeTurno.FIN_PARTIDA) return List.of();
        int maximo = jugadores.stream().mapToInt(Jugador::prestigio).max().orElse(0);
        return jugadores.stream().filter(j -> j.prestigio() == maximo).toList();
    }

    private void exigirFase(FaseDeTurno esperada) {
        if (faseActual != esperada) throw new IllegalStateException("Operación no permitida en la fase " + faseActual);
    }
}
