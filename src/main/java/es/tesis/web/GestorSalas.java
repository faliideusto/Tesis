package es.tesis.web;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Registro en memoria; los bloqueos largos pertenecen a cada sala. */
public final class GestorSalas {
    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final Map<String, SalaJuego> salas = new ConcurrentHashMap<>();
    private final SecureRandom azar = new SecureRandom();
    private final Clock reloj;
    private final Duration caducidad;
    private final ProgresionPartidas progresion;

    public GestorSalas() { this(Clock.systemUTC(), Duration.ofHours(24)); }
    GestorSalas(Clock reloj, Duration caducidad) { this(reloj, caducidad, null); }
    GestorSalas(Clock reloj, Duration caducidad, ProgresionPartidas progresion) {
        this.reloj = reloj; this.caducidad = caducidad; this.progresion = progresion;
    }

    public synchronized Vistas.AccesoSala crear(String nombre) {
        return crear(nombre, null);
    }
    public synchronized Vistas.AccesoSala crear(String nombre, UUID cuenta) {
        SalaJuego.validarNombre(nombre);
        limpiar();
        if (salas.size() >= 256) throw new ErrorSala(409, "Hay demasiadas salas abiertas. Inténtalo más tarde.");
        String codigo;
        do {
            var texto = new StringBuilder();
            for (int i = 0; i < 5; i++) texto.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
            codigo = texto.toString();
        } while (salas.containsKey(codigo));
        var sala = new SalaJuego(codigo, reloj, azar, progresion);
        var acceso = sala.unirse(nombre, cuenta);
        salas.put(codigo, sala);
        return acceso;
    }

    public SalaJuego buscar(String codigo) {
        if (codigo == null || !codigo.strip().toUpperCase(Locale.ROOT).matches("[A-HJ-NP-Z2-9]{5}"))
            throw new IllegalArgumentException("Introduce un código de sala válido de cinco caracteres.");
        var sala = salas.get(codigo.strip().toUpperCase(Locale.ROOT));
        if (sala == null || sala.caducar(reloj.millis() - caducidad.toMillis()))
            throw new ErrorSala(404, "La sala no existe o ha caducado.");
        return sala;
    }

    /** Construye una mesa completa antes de hacerla visible en el registro. */
    synchronized List<Vistas.AccesoSala> crearPartida(List<String> nombres, List<UUID> cuentas) {
        if (nombres == null || cuentas == null || nombres.size() < 3 || nombres.size() > 5
                || nombres.size() != cuentas.size())
            throw new IllegalArgumentException("Se necesitan entre 3 y 5 jugadores.");
        nombres.forEach(SalaJuego::validarNombre);
        limpiar();
        if (salas.size() >= 256) throw new ErrorSala(409, "Hay demasiadas salas abiertas. Inténtalo más tarde.");
        String codigo;
        do {
            var texto = new StringBuilder();
            for (int i = 0; i < 5; i++) texto.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
            codigo = texto.toString();
        } while (salas.containsKey(codigo));
        var sala = new SalaJuego(codigo, reloj, azar, progresion);
        var accesos = new ArrayList<Vistas.AccesoSala>();
        var usados = new TreeSet<String>(String.CASE_INSENSITIVE_ORDER);
        for (int i = 0; i < nombres.size(); i++) {
            String base = SalaJuego.validarNombre(nombres.get(i));
            String nombre = base;
            for (int sufijo = 2; !usados.add(nombre); sufijo++) {
                String fin = " (" + sufijo + ")";
                nombre = base.substring(0, Math.min(base.length(), 24 - fin.length())).stripTrailing() + fin;
            }
            accesos.add(sala.unirse(nombre, cuentas.get(i)));
        }
        String anfitrion = accesos.get(0).playerToken();
        sala.iniciar(anfitrion, sala.estado(anfitrion).revision());
        var resultado = accesos.stream().map(a -> new Vistas.AccesoSala(a.codigo(), a.playerToken(), sala.estado(a.playerToken()))).toList();
        salas.put(codigo, sala);
        return resultado;
    }

    public void limpiar() {
        long limite = reloj.millis() - caducidad.toMillis();
        salas.entrySet().removeIf(e -> e.getValue().caducar(limite));
    }
}
