package es.ciudadela.web;

import es.ciudadela.dominio.Jugador;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.*;

/** Cada operación autentica, valida y obtiene su DTO bajo el mismo bloqueo. */
public final class SalaJuego {
    private final String codigo;
    private final Clock reloj;
    private final SecureRandom azar;
    private final Map<String, Jugador> miembros = new LinkedHashMap<>();
    private final SesionJuego juego = new SesionJuego();
    private Jugador anfitrion;
    private long revision;
    private long actividad;
    private boolean iniciada;
    private boolean caducada;

    SalaJuego(String codigo, Clock reloj, SecureRandom azar) {
        this.codigo = codigo; this.reloj = reloj; this.azar = azar;
        actividad = reloj.millis();
    }

    public synchronized Vistas.AccesoSala unirse(String nombre) {
        vigente();
        nombre = validarNombre(nombre);
        if (iniciada) throw new ErrorSala(409, "La partida ya ha comenzado.");
        if (miembros.size() >= 7) throw new ErrorSala(409, "La sala está llena.");
        String elegido = nombre;
        if (miembros.values().stream().anyMatch(j -> j.nombre().equalsIgnoreCase(elegido)))
            throw new ErrorSala(409, "Ese nombre ya está en la sala.");
        byte[] bytes = new byte[32];
        String token;
        do { azar.nextBytes(bytes); token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
        while (miembros.containsKey(token));
        var jugador = new Jugador(nombre);
        miembros.put(token, jugador);
        if (anfitrion == null) anfitrion = jugador;
        revision++; actividad = reloj.millis();
        return new Vistas.AccesoSala(codigo, token, vista(jugador));
    }

    static String validarNombre(String nombre) {
        if (nombre == null || nombre.isBlank() || nombre.length() > 24 || nombre.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("El nombre debe tener entre 1 y 24 caracteres sin saltos de línea.");
        return nombre.strip();
    }

    public synchronized Vistas.Sala estado(String token) { return vista(autenticar(token)); }

    public synchronized Vistas.Sala iniciar(String token, Long version) {
        var jugador = autenticar(token);
        if (jugador != anfitrion) throw new ErrorSala(403, "Solo el anfitrión puede iniciar la partida.");
        comprobarVersion(version);
        if (iniciada) throw new ErrorSala(409, "La partida ya ha comenzado.");
        if (miembros.size() < 2) throw new ErrorSala(409, "Se necesitan al menos dos jugadores.");
        juego.crearJugadores(List.copyOf(miembros.values()));
        iniciada = true; revision++;
        return vista(jugador);
    }

    public synchronized Vistas.Sala actuar(String token, Vistas.Peticion peticion) {
        var jugador = autenticar(token);
        if (peticion == null) throw new IllegalArgumentException("Falta la acción.");
        comprobarVersion(peticion.revision());
        if (!iniciada) throw new ErrorSala(409, "La partida todavía no ha comenzado.");
        var estado = juego.estado(jugador);
        if (estado.fase().equals("FIN_PARTIDA")) throw new ErrorSala(409, "La partida ha terminado.");
        juego.actuar(jugador, new Vistas.Peticion(estado.revision(), peticion.tipo(), peticion.indice(), peticion.objetivo(), null));
        revision++;
        return vista(jugador);
    }

    private Jugador autenticar(String token) {
        vigente();
        Jugador jugador = token == null ? null : miembros.get(token);
        if (jugador == null) throw new ErrorSala(401, "Tu identidad no es válida para esta sala. Vuelve al inicio.");
        actividad = reloj.millis();
        return jugador;
    }

    private void comprobarVersion(Long version) {
        if (version == null) throw new IllegalArgumentException("Falta la versión de la sala.");
        if (revision != version) throw new ErrorSala(409, "La sala ha cambiado. Actualiza antes de actuar.");
    }

    private Vistas.Sala vista(Jugador jugador) {
        var estado = iniciada ? juego.estado(jugador) : null;
        String fase = !iniciada ? "LOBBY" : estado.fase().equals("FIN_PARTIDA") ? "FINALIZADA" : "EN_PARTIDA";
        return new Vistas.Sala(codigo, revision, fase, jugador.nombre(), anfitrion.nombre(), jugador == anfitrion,
                miembros.values().stream().map(Jugador::nombre).toList(), estado);
    }

    private void vigente() { if (caducada) throw new ErrorSala(404, "La sala ha caducado."); }

    synchronized boolean caducar(long antesDe) {
        if (actividad < antesDe) caducada = true;
        return caducada;
    }
}
