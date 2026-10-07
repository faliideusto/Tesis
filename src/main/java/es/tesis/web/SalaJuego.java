package es.tesis.web;

import es.tesis.dominio.Jugador;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.*;

/** Cada operación autentica, valida y obtiene su DTO bajo el mismo bloqueo. */
public final class SalaJuego {
    private static final long PAUSA_FIN_RONDA_MS = 5_000;
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
    private long finRondaHasta;
    private final Map<Jugador, UUID> cuentas = new IdentityHashMap<>();
    private final UUID partidaId = UUID.randomUUID();
    private final ProgresionPartidas progresion;
    private ProgresionPartidas.Registro resultado;

    SalaJuego(String codigo, Clock reloj, SecureRandom azar) {
        this(codigo, reloj, azar, null);
    }
    SalaJuego(String codigo, Clock reloj, SecureRandom azar, ProgresionPartidas progresion) {
        this.codigo = codigo; this.reloj = reloj; this.azar = azar;
        this.progresion = progresion;
        actividad = reloj.millis();
    }

    public synchronized Vistas.AccesoSala unirse(String nombre) {
        return unirse(nombre, null);
    }
    public synchronized Vistas.AccesoSala unirse(String nombre, UUID cuenta) {
        vigente();
        nombre = validarNombre(nombre);
        if (iniciada) throw new ErrorSala(409, "La partida ya ha comenzado.");
        if (miembros.size() >= es.tesis.reglas.ReglasAcademicas.MAX_JUGADORES) throw new ErrorSala(409, "La sala está llena (máximo 5 personas).");
        if (cuenta != null && cuentas.values().stream().anyMatch(cuenta::equals))
            throw new ErrorSala(409, "Esta cuenta ya está vinculada a un jugador de la sala.");
        String elegido = nombre;
        if (miembros.values().stream().anyMatch(j -> j.nombre().equalsIgnoreCase(elegido)))
            throw new ErrorSala(409, "Ese nombre ya está en la sala.");
        byte[] bytes = new byte[32];
        String token;
        do { azar.nextBytes(bytes); token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
        while (miembros.containsKey(token));
        var jugador = new Jugador(nombre);
        miembros.put(token, jugador);
        if (cuenta != null) cuentas.put(jugador, cuenta);
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

    synchronized String validarInvitador(String token, UUID cuenta, UUID destinatario) {
        Jugador jugador = autenticar(token);
        if (jugador != anfitrion) throw new ErrorSala(403, "Solo el anfitrión puede invitar amigos.");
        if (cuenta == null || !cuenta.equals(cuentas.get(jugador)))
            throw new ErrorSala(403, "La cuenta no corresponde al anfitrión de esta sala.");
        if (!admiteInvitado(destinatario)) throw new ErrorSala(409, "La sala ya no admite esta invitación.");
        return anfitrion.nombre();
    }

    synchronized boolean admiteInvitado(UUID cuenta) {
        return !caducada && !iniciada && miembros.size() < es.tesis.reglas.ReglasAcademicas.MAX_JUGADORES
                && (cuenta == null || !cuentas.containsValue(cuenta));
    }

    public synchronized Vistas.Sala iniciar(String token, Long version) {
        var jugador = autenticar(token);
        if (jugador != anfitrion) throw new ErrorSala(403, "Solo el anfitrión puede iniciar la partida.");
        comprobarVersion(version);
        if (iniciada) throw new ErrorSala(409, "La partida ya ha comenzado.");
        if (miembros.size() < es.tesis.reglas.ReglasAcademicas.MIN_JUGADORES || miembros.size() > es.tesis.reglas.ReglasAcademicas.MAX_JUGADORES) throw new ErrorSala(409, "Se necesitan entre 3 y 5 jugadores.");
        juego.crearJugadores(List.copyOf(miembros.values()));
        iniciada = true; revision++;
        return vista(jugador);
    }

    public synchronized Vistas.Sala actuar(String token, Vistas.Peticion peticion) {
        var jugador = autenticar(token);
        if (peticion == null) throw new IllegalArgumentException("Falta la acción.");
        continuarRondaSiCorresponde();
        comprobarVersion(peticion.revision());
        if (!iniciada) throw new ErrorSala(409, "La partida todavía no ha comenzado.");
        var estado = juego.estado(jugador);
        if (estado.fase().equals("FIN_PARTIDA")) throw new ErrorSala(409, "La partida ha terminado.");
        juego.actuar(jugador, new Vistas.Peticion(estado.revision(), peticion.tipo(), peticion.indice(), peticion.objetivo(), null));
        revision++;
        if (juego.estado(jugador).fase().equals("FIN_RONDA")) {
            if (finRondaHasta == 0) finRondaHasta = reloj.millis() + PAUSA_FIN_RONDA_MS;
        } else finRondaHasta = 0;
        return vista(jugador);
    }

    private void continuarRondaSiCorresponde() {
        if (finRondaHasta == 0 || reloj.millis() < finRondaHasta) return;
        finRondaHasta = 0;
        juego.avanzarRondaAutomatica();
        revision++;
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
        continuarRondaSiCorresponde();
        var estado = iniciada ? juego.estado(jugador) : null;
        String fase = !iniciada ? "LOBBY" : estado.fase().equals("FIN_PARTIDA") ? "FINALIZADA" : "EN_PARTIDA";
        registrarResultado();
        return new Vistas.Sala(codigo, revision, fase, jugador.nombre(), anfitrion.nombre(), jugador == anfitrion,
                miembros.values().stream().map(Jugador::nombre).toList(), estado, progreso(jugador));
    }

    private void registrarResultado() {
        if (resultado != null || progresion == null || cuentas.isEmpty()) return;
        var finalizados = juego.resultadoFinal();
        if (finalizados.isEmpty()) return;
        var participantes = new ArrayList<es.tesis.cuentas.CuentasSupabase.Participante>();
        for (int i = 0; i < finalizados.size(); i++) {
            var finalizado = finalizados.get(i);
            participantes.add(new es.tesis.cuentas.CuentasSupabase.Participante(i,
                    cuentas.get(finalizado.jugador()), finalizado.jugador().nombre(),
                    finalizado.prestigio(), finalizado.ganador()));
        }
        resultado = progresion.registrar(partidaId, reloj.instant(), participantes);
    }
    private Vistas.Progreso progreso(Jugador jugador) {
        if (!cuentas.containsKey(jugador)) return new Vistas.Progreso("INVITADO", false, null, null);
        if (resultado == null) return new Vistas.Progreso("VINCULADA", true, null, null);
        int xp = resultado.participantes.stream().filter(p -> p.user_id() != null
                && p.user_id().equals(cuentas.get(jugador))).findFirst().map(p -> p.winner() ? 150 : 100).orElse(0);
        return new Vistas.Progreso(resultado.estado, true,
                resultado.estado.equals("CONFIRMADA") ? xp : null, partidaId);
    }

    private void vigente() { if (caducada) throw new ErrorSala(404, "La sala ha caducado."); }

    synchronized boolean caducar(long antesDe) {
        if (actividad < antesDe) caducada = true;
        return caducada;
    }
}
