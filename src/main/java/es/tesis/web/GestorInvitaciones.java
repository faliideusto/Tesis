package es.tesis.web;

import java.time.Clock;
import java.util.*;

/** Invitaciones efímeras: no persisten salas ni contienen tokens de jugadores. */
public final class GestorInvitaciones {
    public record Invitacion(String id, String codigoSala, String nombreAnfitrion) {}
    public record Bandeja(List<Invitacion> invitaciones) {}
    public record Envio(String id, boolean enviada) {}
    private record Pendiente(Invitacion vista, UUID destinatario, long hasta) {}
    private record Par(String sala,UUID destinatario) {}
    private final Map<String, Pendiente> pendientes = new LinkedHashMap<>();
    private final Map<Par,Long> ultimoEnvio = new HashMap<>();
    private final GestorSalas salas;
    private final Clock reloj;
    public GestorInvitaciones(GestorSalas salas) { this(salas, Clock.systemUTC()); }
    GestorInvitaciones(GestorSalas salas, Clock reloj) { this.salas = salas; this.reloj = reloj; }

    public synchronized Envio enviar(String codigo, String token, UUID actor, UUID destinatario) {
        Objects.requireNonNull(destinatario);
        limpiar();
        SalaJuego sala = salas.buscar(codigo);
        synchronized (sala) {
            String nombre = sala.validarInvitador(token, actor, destinatario);
            String normal = codigo.strip().toUpperCase(Locale.ROOT);
            for (Pendiente p : pendientes.values())
                if (p.destinatario.equals(destinatario) && p.vista.codigoSala.equals(normal)) return new Envio(p.vista.id,true);
            Par par = new Par(normal,destinatario);
            if (ultimoEnvio.containsKey(par)) throw new ErrorSala(409,"Espera un minuto antes de volver a invitar a este amigo.");
            if (pendientes.size() >= 25600 || ultimoEnvio.size() >= 25600 || pendientes.values().stream().filter(p -> p.destinatario.equals(destinatario)).count() >= 20
                    || pendientes.values().stream().filter(p -> p.vista.codigoSala.equals(normal)).count() >= 100)
                throw new ErrorSala(409, "Hay demasiadas invitaciones pendientes. Inténtalo más tarde.");
            Invitacion vista = new Invitacion(UUID.randomUUID().toString(),normal,nombre);
            pendientes.put(vista.id,new Pendiente(vista,destinatario,reloj.millis()+300000));
            ultimoEnvio.put(par,reloj.millis()+60000);
            return new Envio(vista.id,true);
        }
    }
    public synchronized Bandeja listar(UUID actor) {
        Objects.requireNonNull(actor); limpiar();
        return new Bandeja(pendientes.values().stream().filter(p -> p.destinatario.equals(actor)).map(Pendiente::vista).toList());
    }
    public synchronized Vistas.AccesoSala aceptar(String id, UUID actor, String nombre) {
        Pendiente pendiente = obtener(id,actor);
        SalaJuego sala = salas.buscar(pendiente.vista.codigoSala);
        synchronized (sala) {
            if (!sala.admiteInvitado(actor)) { pendientes.remove(id); throw new ErrorSala(409,"La sala ya no admite esta invitación."); }
            Vistas.AccesoSala acceso = sala.unirse(nombre,actor);
            pendientes.remove(id);
            return acceso;
        }
    }
    public synchronized void rechazar(String id, UUID actor) { obtener(id,actor); pendientes.remove(id); }
    private Pendiente obtener(String id, UUID actor) {
        Objects.requireNonNull(actor); limpiar();
        Pendiente p = pendientes.get(id);
        if (p == null || !p.destinatario.equals(actor)) throw new ErrorSala(404,"La invitación no existe o ha caducado.");
        return p;
    }
    public synchronized void limpiar() {
        ultimoEnvio.values().removeIf(hasta -> hasta <= reloj.millis());
        pendientes.values().removeIf(p -> {
            if (p.hasta <= reloj.millis()) return true;
            try { return !salas.buscar(p.vista.codigoSala).admiteInvitado(p.destinatario); }
            catch (ErrorSala e) { return true; }
        });
    }
}
