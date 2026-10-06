package es.tesis.web;

import java.time.Clock;
import java.time.Duration;
import java.util.*;

/** Colas en memoria; una sola sección crítica cubre grupos, confirmaciones y asignaciones. */
public final class GestorMatchmaking {
    private static final long PRESENCIA_MS = 30_000;
    private static final long CONFIRMACION_MS = 20_000;
    private static final long RECUPERACION_MS = Duration.ofHours(24).toMillis();
    private static final int MAX_SOLICITUDES = 2048;
    private final GestorSalas salas;
    private final Clock reloj;
    private final Map<String, Solicitud> solicitudes = new LinkedHashMap<>();
    private long orden;

    public record Vista(String token, int jugadores, String fase, int reunidos, int confirmados,
                        boolean listo, String grupo, long hasta, Vistas.AccesoSala acceso) {}

    private static final class Solicitud {
        final String token, nombre;
        final int jugadores;
        final UUID cuenta;
        final long orden;
        long actividad, terminada;
        String fase = "BUSCANDO";
        Grupo grupo;
        boolean listo;
        Vistas.AccesoSala acceso;
        Solicitud(String token, String nombre, int jugadores, UUID cuenta, long orden, long ahora) {
            this.token = token; this.nombre = nombre; this.jugadores = jugadores;
            this.cuenta = cuenta; this.orden = orden; actividad = ahora;
        }
        boolean activa() { return fase.equals("BUSCANDO") || fase.equals("CONFIRMACION"); }
    }
    private static final class Grupo {
        final String id = UUID.randomUUID().toString();
        final List<Solicitud> miembros;
        final long hasta;
        Grupo(List<Solicitud> miembros, long hasta) { this.miembros = miembros; this.hasta = hasta; }
    }

    public GestorMatchmaking(GestorSalas salas) { this(salas, Clock.systemUTC()); }
    GestorMatchmaking(GestorSalas salas, Clock reloj) { this.salas = salas; this.reloj = reloj; }

    public synchronized Vista buscar(String token, String nombre, int jugadores, UUID cuenta) {
        validarToken(token);
        nombre = SalaJuego.validarNombre(nombre);
        if (jugadores < 3 || jugadores > 5) throw new IllegalArgumentException("Elige una partida de 3, 4 o 5 personas.");
        limpiar();
        var existente = solicitudes.get(token);
        if (existente != null) {
            if (!existente.nombre.equals(nombre) || existente.jugadores != jugadores || !Objects.equals(existente.cuenta, cuenta))
                throw new ErrorSala(409, "Esta búsqueda ya tiene otros datos. Cancélala antes de cambiar.");
            existente.actividad = reloj.millis();
            return vista(existente);
        }
        if (cuenta != null && solicitudes.values().stream().anyMatch(s -> s.activa() && cuenta.equals(s.cuenta)))
            throw new ErrorSala(409, "Esta cuenta ya está buscando partida.");
        if (solicitudes.size() >= MAX_SOLICITUDES) throw new ErrorSala(409, "Hay demasiadas búsquedas. Inténtalo más tarde.");
        var solicitud = new Solicitud(token, nombre, jugadores, cuenta, orden++, reloj.millis());
        solicitudes.put(token, solicitud);
        formarGrupos();
        return vista(solicitud);
    }

    public synchronized Vista estado(String token) {
        limpiar();
        var solicitud = autenticar(token);
        solicitud.actividad = reloj.millis();
        return vista(solicitud);
    }

    public synchronized Vista confirmar(String token, String grupo) {
        limpiar();
        var solicitud = autenticar(token);
        if (solicitud.grupo == null || !solicitud.grupo.id.equals(grupo))
            throw new ErrorSala(409, "El grupo ha cambiado. Actualiza la búsqueda.");
        solicitud.actividad = reloj.millis();
        if (solicitud.fase.equals("ASIGNADA")) return vista(solicitud);
        solicitud.listo = true;
        var miembros = solicitud.grupo.miembros;
        if (miembros.stream().allMatch(s -> s.listo)) {
            // Si crear falla, las confirmaciones permanecen recuperables y se puede volver a intentar.
            var cuentas = new ArrayList<UUID>();
            miembros.forEach(s -> cuentas.add(s.cuenta));
            var accesos = salas.crearPartida(miembros.stream().map(s -> s.nombre).toList(), cuentas);
            for (int i = 0; i < miembros.size(); i++) {
                var miembro = miembros.get(i);
                miembro.acceso = accesos.get(i); miembro.fase = "ASIGNADA"; miembro.terminada = reloj.millis();
            }
        }
        return vista(solicitud);
    }

    public synchronized Vista cancelar(String token) {
        limpiar();
        var solicitud = autenticar(token);
        if (solicitud.fase.equals("ASIGNADA")) throw new ErrorSala(409, "La partida ya está asignada. Entra en ella.");
        var grupo = solicitud.grupo;
        terminar(solicitud);
        if (grupo != null) disolver(grupo);
        formarGrupos();
        return vista(solicitud);
    }

    public synchronized void limpiar() {
        long ahora = reloj.millis();
        var grupos = new HashSet<Grupo>();
        for (var solicitud : solicitudes.values()) {
            if (solicitud.activa() && ahora - solicitud.actividad >= PRESENCIA_MS) {
                if (solicitud.grupo != null) grupos.add(solicitud.grupo);
                terminar(solicitud);
            } else if (solicitud.fase.equals("CONFIRMACION") && ahora >= solicitud.grupo.hasta) {
                grupos.add(solicitud.grupo);
                if (!solicitud.listo) terminar(solicitud);
            }
        }
        grupos.forEach(this::disolver);
        solicitudes.values().removeIf(s -> !s.activa() && ahora - s.terminada >=
                (s.fase.equals("ASIGNADA") ? RECUPERACION_MS : 60_000));
        formarGrupos();
    }

    private void terminar(Solicitud solicitud) {
        solicitud.fase = "CANCELADA"; solicitud.terminada = reloj.millis();
        solicitud.grupo = null; solicitud.listo = false;
    }
    private void disolver(Grupo grupo) {
        for (var miembro : grupo.miembros) if (miembro.activa()) {
            miembro.fase = "BUSCANDO"; miembro.grupo = null; miembro.listo = false;
        }
    }
    private void formarGrupos() {
        for (int cantidad = 3; cantidad <= 5; cantidad++) {
            final int tamanyo = cantidad;
            var cola = solicitudes.values().stream().filter(s -> s.fase.equals("BUSCANDO") && s.jugadores == tamanyo)
                    .sorted(Comparator.comparingLong(s -> s.orden)).toList();
            for (int inicio = 0; inicio + cantidad <= cola.size(); inicio += cantidad) {
                var grupo = new Grupo(List.copyOf(cola.subList(inicio, inicio + cantidad)), reloj.millis() + CONFIRMACION_MS);
                for (var miembro : grupo.miembros) { miembro.grupo = grupo; miembro.fase = "CONFIRMACION"; }
            }
        }
    }
    private Solicitud autenticar(String token) {
        validarToken(token);
        var solicitud = solicitudes.get(token);
        if (solicitud == null) throw new ErrorSala(404, "La búsqueda no existe o ha caducado.");
        return solicitud;
    }
    private static void validarToken(String token) {
        if (token == null || !token.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"))
            throw new ErrorSala(401, "La identidad de búsqueda no es válida.");
    }
    private Vista vista(Solicitud solicitud) {
        if (solicitud.acceso != null) {
            var acceso = solicitud.acceso;
            solicitud.acceso = new Vistas.AccesoSala(acceso.codigo(), acceso.playerToken(),
                    salas.buscar(acceso.codigo()).estado(acceso.playerToken()));
        }
        var grupo = solicitud.grupo;
        int reunidos = grupo != null ? grupo.miembros.size() : solicitud.activa()
                ? (int) solicitudes.values().stream().filter(s -> s.fase.equals("BUSCANDO") && s.jugadores == solicitud.jugadores).count() : 0;
        return new Vista(solicitud.token, solicitud.jugadores, solicitud.fase, reunidos,
                grupo == null ? 0 : (int) grupo.miembros.stream().filter(s -> s.listo).count(), solicitud.listo,
                grupo == null ? null : grupo.id, grupo == null ? 0 : grupo.hasta, solicitud.acceso);
    }
}
