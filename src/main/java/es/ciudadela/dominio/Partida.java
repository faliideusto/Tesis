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

    public InstantaneaPartida guardar() {
        if (!jugadorInicialElegido || rondaPreparada != ronda) {
            throw new IllegalStateException("La partida debe estar iniciada para guardarla");
        }
        var datosJugadores = jugadores.stream().map(j -> new InstantaneaPartida.JugadorDatos(
                j.nombre(), j.monedas(), j.prestigio(), j.personaje() == null ? null : j.personaje().ordenTurno(),
                j.cartasIdea().stream().map(InstantaneaPartida.IdeaDatos::de).toList(),
                j.estudios().stream().map(InstantaneaPartida.EstudioDatos::de).toList())).toList();
        Map<Estudio, InstantaneaPartida.EstudioEnMesa> posiciones = new IdentityHashMap<>();
        for (int j = 0; j < jugadores.size(); j++) {
            var estudios = jugadores.get(j).estudios();
            for (int e = 0; e < estudios.size(); e++) posiciones.put(estudios.get(e), new InstantaneaPartida.EstudioEnMesa(j, e));
        }
        var mesa = tablero.estudiosEnMesa().stream().map(e -> {
            var posicion = posiciones.get(e);
            if (posicion == null) throw new IllegalStateException("Hay un estudio en mesa sin propietario");
            return posicion;
        }).toList();
        return new InstantaneaPartida(datosJugadores,
                mazoRoles.cartasIniciales().stream().map(InstantaneaPartida.RolDatos::de).toList(),
                mazoRoles.cartas().stream().map(Personaje::ordenTurno).toList(),
                mazoIdeas.cartasIniciales().stream().map(InstantaneaPartida.IdeaDatos::de).toList(),
                mazoIdeas.cartas().stream().map(InstantaneaPartida.IdeaDatos::de).toList(), mesa,
                faseActual, ronda, indiceJugadorActual, accionesBaseRealizadas, habilidadUsada);
    }

    /** Reconstruye datos ya jugados sin ejecutar reparto, descarte ni efectos de turno. */
    public static Partida restaurar(InstantaneaPartida datos) {
        Objects.requireNonNull(datos);
        Map<Integer, Personaje> roles = new LinkedHashMap<>();
        Set<String> nombresRoles = new HashSet<>();
        for (var rol : datos.rolesIniciales()) {
            if (roles.putIfAbsent(rol.orden(), rol.crear()) != null
                    || !nombresRoles.add(rol.nombre().toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Roles duplicados en el guardado");
            }
        }
        if (roles.size() <= datos.jugadores().size()) throw new IllegalArgumentException("Faltan roles en el guardado");
        Set<Integer> usados = new HashSet<>();
        List<Personaje> disponibles = new ArrayList<>();
        for (int orden : datos.rolesDisponibles()) {
            if (!roles.containsKey(orden) || !usados.add(orden)) throw new IllegalArgumentException("Mazo de roles no válido");
            disponibles.add(roles.get(orden));
        }
        Set<String> nombres = new HashSet<>();
        List<Jugador> jugadores = new ArrayList<>();
        for (var jugador : datos.jugadores()) {
            if (!nombres.add(jugador.nombre().toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("Jugadores duplicados");
            Integer rol = jugador.rol();
            if (rol != null && (!roles.containsKey(rol) || !usados.add(rol))) throw new IllegalArgumentException("Rol asignado no válido");
            jugadores.add(Jugador.restaurar(jugador, rol == null ? null : roles.get(rol)));
        }
        if (usados.size() != roles.size() - 1) throw new IllegalArgumentException("El guardado debe conservar un rol descartado");
        boolean completos = jugadores.stream().allMatch(j -> j.personaje() != null);
        if (datos.fase() == FaseDeTurno.SELECCION_ROLES) {
            if (completos || jugadores.get(datos.jugadorActual()).personaje() != null
                    || datos.accionesRealizadas() != 0 || datos.habilidadUsada()) {
                throw new IllegalArgumentException("Selección de roles incoherente");
            }
        } else if (!completos) {
            throw new IllegalArgumentException("Faltan personajes para la fase guardada");
        }
        if (datos.fase() == FaseDeTurno.FIN_RONDA || datos.fase() == FaseDeTurno.FIN_PARTIDA) {
            int maximo = jugadores.stream().mapToInt(j -> j.personaje().ordenTurno()).max().orElseThrow();
            if (jugadores.get(datos.jugadorActual()).personaje().ordenTurno() != maximo) {
                throw new IllegalArgumentException("La ronda guardada no ha terminado");
            }
        }
        if (datos.fase() == FaseDeTurno.FIN_PARTIDA && jugadores.stream().noneMatch(j -> j.cantidadPublicados() >= 3)) {
            throw new IllegalArgumentException("La partida guardada no cumple la condición de fin");
        }
        Partida partida = new Partida(jugadores, Mazo.restaurar(new ArrayList<>(roles.values()), disponibles),
                Mazo.restaurar(datos.ideasIniciales().stream().map(InstantaneaPartida.IdeaDatos::crear).toList(),
                        datos.ideasDisponibles().stream().map(InstantaneaPartida.IdeaDatos::crear).toList()));
        Set<InstantaneaPartida.EstudioEnMesa> mesa = new HashSet<>();
        for (var posicion : datos.mesa()) {
            if (posicion.jugador() >= jugadores.size() || posicion.estudio() >= jugadores.get(posicion.jugador()).estudios().size()
                    || !mesa.add(posicion)) throw new IllegalArgumentException("Referencia de estudio en mesa no válida");
            partida.tablero.agregarEstudio(jugadores.get(posicion.jugador()).estudios().get(posicion.estudio()));
        }
        partida.faseActual = datos.fase();
        partida.ronda = datos.ronda();
        partida.rondaPreparada = datos.ronda();
        partida.jugadorInicialElegido = true;
        partida.indiceJugadorActual = datos.jugadorActual();
        partida.accionesBaseRealizadas = datos.accionesRealizadas();
        partida.habilidadUsada = datos.habilidadUsada();
        return partida;
    }
}
