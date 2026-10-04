package es.tesis.web;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import es.tesis.cuentas.CuentasSupabase;
import es.tesis.cuentas.ExcepcionCuenta;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Servidor de salas, sin framework adicional. Sirve recursos del classpath static. */
public final class ServidorWeb implements AutoCloseable {
    private final HttpServer servidor;
    private final ExecutorService ejecutor = Executors.newFixedThreadPool(4);
    private final Map<String, Entrada> sesiones = new ConcurrentHashMap<>();
    private final Gson gson = new GsonBuilder().setStrictness(Strictness.STRICT).create();
    private final GestorSalas salas;
    private final CuentasSupabase cuentas;
    private final ProgresionPartidas progresion;
    // Al menos dos trabajadores HTTP quedan disponibles para las salas durante una caída de Auth.
    private final Semaphore consultasCuenta = new Semaphore(2);
    private final ScheduledExecutorService limpieza = Executors.newSingleThreadScheduledExecutor();
    private final boolean localCompatible;
    private record Entrada(SesionJuego juego, java.util.concurrent.atomic.AtomicLong acceso) {}

    /** Compatibilidad para las pruebas originales de pantalla compartida; solo loopback. */
    public ServidorWeb(int puerto) throws IOException {
        this("127.0.0.1", puerto, true, CuentasSupabase.desdeEntorno());
    }
    public ServidorWeb(String host, int puerto) throws IOException { this(host, puerto, false, CuentasSupabase.desdeEntorno()); }
    public ServidorWeb(String host, int puerto, CuentasSupabase cuentas) throws IOException {
        this(host, puerto, false, cuentas);
    }
    private ServidorWeb(String host, int puerto, boolean localCompatible, CuentasSupabase cuentas) throws IOException {
        this.localCompatible = localCompatible;
        this.cuentas = cuentas;
        this.progresion = cuentas.habilitado() ? new ProgresionPartidas(cuentas::registrarResultado) : null;
        this.salas = new GestorSalas(java.time.Clock.systemUTC(), java.time.Duration.ofHours(24), progresion);
        servidor = HttpServer.create(new InetSocketAddress(host, puerto), 0);
        servidor.setExecutor(ejecutor);
        servidor.createContext("/api/", this::api);
        servidor.createContext("/", this::estatico);
    }
    public void iniciar() { servidor.start(); limpieza.scheduleAtFixedRate(salas::limpiar, 1, 1, TimeUnit.MINUTES); }
    public int puerto() { return servidor.getAddress().getPort(); }
    @Override public void close() {
        servidor.stop(0); ejecutor.shutdownNow(); limpieza.shutdownNow();
        if (progresion != null) progresion.close();
        cuentas.close();
    }

    public static void main(String[] args) throws IOException {
        int puerto = Integer.parseInt(args.length == 0 ? System.getenv().getOrDefault("PORT", "8080") : args[0]);
        var web = new ServidorWeb(System.getenv().getOrDefault("HOST", "0.0.0.0"), puerto);
        Runtime.getRuntime().addShutdownHook(new Thread(web::close));
        web.iniciar();
        System.out.println("Tesis: http://localhost:" + web.puerto());
    }

    private void api(HttpExchange x) throws IOException {
        x.getResponseHeaders().set("Cache-Control", "no-store");
        try {
            String metodo = x.getRequestMethod(); String ruta = x.getRequestURI().getPath();
            if (!Set.of("GET", "POST").contains(metodo)) { json(x, 405, Map.of("error", "Método no permitido.")); return; }
            if (metodo.equals("POST") && (!"1".equals(x.getRequestHeaders().getFirst("X-Tesis")) || !origenValido(x))) {
                json(x, 403, Map.of("error", "Solicitud de otro origen rechazada.")); return;
            }
            if (ruta.equals("/api/config") && metodo.equals("GET")) {
                json(x, 200, SesionJuego.configuracion()); return;
            }
            if (ruta.equals("/api/cuentas/config") && metodo.equals("GET")) {
                json(x, 200, Map.of("habilitado", cuentas.habilitado(), "url", cuentas.url(),
                        "publishableKey", cuentas.publishableKey())); return;
            }
            if (ruta.equals("/api/perfil")) {
                String jwt = bearer(x.getRequestHeaders().getFirst("Authorization"));
                String nuevoNombre = metodo.equals("POST")
                        ? SalaJuego.validarNombre(nombre(cuerpoSala(x, Set.of("nombre")))) : null;
                json(x, 200, consultarCuenta(() -> metodo.equals("GET") ? cuentas.perfil(jwt)
                        : cuentas.renombrar(jwt, nuevoNombre)));
                return;
            }
            if (ruta.equals("/api/salas") || ruta.startsWith("/api/salas/")) { salas(x, ruta, metodo); return; }
            // Compatibilidad del servidor local de pruebas, nunca conectada al registro de salas.
            // El arranque main y el constructor de red no publican estas rutas.
            if (!localCompatible) { json(x, 404, Map.of("error", "Ruta no encontrada.")); return; }
            if (!x.getRemoteAddress().getAddress().isLoopbackAddress() || !hostValido(x)) {
                json(x, 403, Map.of("error", "Acceso local no válido.")); return;
            }
            SesionJuego juego = sesion(x);
            if (ruta.equals("/api/game/state") && metodo.equals("GET")) { json(x, 200, juego.estado()); return; }
            if (!metodo.equals("POST")) { json(x, 404, Map.of("error", "Ruta no encontrada.")); return; }
            byte[] cuerpo = x.getRequestBody().readNBytes(8193);
            if (cuerpo.length > 8192) { json(x, 413, Map.of("error", "Solicitud demasiado grande.")); return; }
            var datos = gson.fromJson(new String(cuerpo, StandardCharsets.UTF_8), JsonObject.class);
            if (datos == null) throw new IllegalArgumentException("Faltan los datos de la solicitud.");
            if (Set.of("/api/game/action", "/api/game/select-role", "/api/game/reveal", "/api/game/lock").contains(ruta))
                validarPeticion(datos, ruta.endsWith("action") || ruta.endsWith("select-role"));
            var p = gson.fromJson(datos, Vistas.Peticion.class);
            if (p == null) throw new IllegalArgumentException("Faltan los datos de la solicitud.");
            Object resultado = switch (ruta) {
                case "/api/game" -> juego.crear(p.nombres());
                case "/api/game/action", "/api/game/select-role" -> {
                    if (ruta.endsWith("select-role") && !"SELECCIONAR".equals(p.tipo()))
                        throw new IllegalArgumentException("Esta ruta requiere seleccionar un personaje.");
                    yield juego.actuar(p);
                }
                case "/api/game/reveal", "/api/game/lock" -> {
                    if (p.revision() == null) throw new IllegalArgumentException("Falta la versión de la partida.");
                    yield ruta.endsWith("reveal") ? juego.revelar(p.revision()) : juego.ocultar(p.revision());
                }
                default -> null;
            };
            if (resultado == null) json(x, 404, Map.of("error", "Ruta no encontrada.")); else json(x, 200, resultado);
        } catch (ExcepcionCuenta e) {
            json(x, e.estado(), Map.of("error", e.getMessage()));
        } catch (ErrorSala e) {
            json(x, e.estado, Map.of("error", e.getMessage()));
        } catch (SesionJuego.Conflicto e) {
            json(x, 409, Map.of("error", e.getMessage()));
        } catch (JsonParseException e) {
            json(x, 400, Map.of("error", "La solicitud JSON no es válida."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            json(x, 400, Map.of("error", e.getMessage() == null ? "Solicitud no válida." : e.getMessage()));
        } catch (Exception e) {
            json(x, 500, Map.of("error", "No se pudo completar la operación. Actualiza la mesa."));
        } finally { x.close(); }
    }

    private boolean hostValido(HttpExchange x) {
        String host = x.getRequestHeaders().getFirst("Host");
        return ("localhost:" + puerto()).equals(host) || ("127.0.0.1:" + puerto()).equals(host);
    }
    private boolean origenValido(HttpExchange x) {
        String origen = x.getRequestHeaders().getFirst("Origin");
        String publico = System.getenv("PUBLIC_ORIGIN");
        if (origen == null) return true;
        if (publico != null && !publico.isBlank()) return origen.equals(publico);
        String host = x.getRequestHeaders().getFirst("Host");
        return origen.equals("http://" + host) || origen.equals("https://" + host);
    }

    private void salas(HttpExchange x, String ruta, String metodo) throws IOException {
        String[] partes = ruta.split("/", -1);
        if (ruta.equals("/api/salas") && metodo.equals("POST")) {
            UUID cuenta = cuentaEntrada(x);
            json(x, 201, salas.crear(nombre(cuerpoSala(x, Set.of("nombre"))), cuenta)); return;
        }
        if (partes.length != 5 || !Set.of("unirse", "estado", "iniciar", "accion").contains(partes[4]))
            throw new ErrorSala(404, "Ruta no encontrada.");
        String operacion = partes[4];
        if (!(operacion.equals("estado") ? metodo.equals("GET") : metodo.equals("POST")))
            throw new ErrorSala(405, "Método no permitido.");
        var sala = salas.buscar(partes[3]);
        if (operacion.equals("unirse")) {
            UUID cuenta = cuentaEntrada(x);
            json(x, 200, sala.unirse(nombre(cuerpoSala(x, Set.of("nombre"))), cuenta)); return;
        }
        String cabecera = x.getRequestHeaders().getFirst("Authorization");
        String token = cabecera != null && cabecera.startsWith("Bearer ") ? cabecera.substring(7) : null;
        // Autenticar antes de interpretar acciones o devolver información del juego.
        var estado = sala.estado(token);
        if (operacion.equals("estado")) { json(x, 200, estado); return; }
        var objeto = cuerpoSala(x, operacion.equals("iniciar") ? Set.of("revision") : Set.of("revision", "tipo", "indice", "objetivo"));
        validarPeticion(objeto, operacion.equals("accion"));
        var peticion = gson.fromJson(objeto, Vistas.Peticion.class);
        json(x, 200, operacion.equals("iniciar") ? sala.iniciar(token, peticion.revision()) : sala.actuar(token, peticion));
    }

    private static String bearer(String cabecera) {
        return cabecera != null && cabecera.startsWith("Bearer ") ? cabecera.substring(7) : null;
    }
    private UUID cuentaEntrada(HttpExchange x) {
        String cabecera = x.getRequestHeaders().getFirst("X-Tesis-Account-Authorization");
        return cabecera == null ? null : consultarCuenta(() -> cuentas.autenticar(bearer(cabecera)));
    }
    private <T> T consultarCuenta(java.util.function.Supplier<T> consulta) {
        if (!consultasCuenta.tryAcquire())
            throw new ExcepcionCuenta(503, "Las cuentas están ocupadas. Inténtalo más tarde.");
        try { return consulta.get(); } finally { consultasCuenta.release(); }
    }

    private void validarPeticion(JsonObject objeto, boolean accion) {
        entero(objeto, "revision", Long.MAX_VALUE, true);
        if (!accion) return;
        entero(objeto, "indice", Integer.MAX_VALUE, false);
        texto(objeto, "tipo", true);
        texto(objeto, "objetivo", false);
    }

    private void entero(JsonObject objeto, String campo, long maximo, boolean obligatorio) {
        var valor = objeto.get(campo);
        if (valor == null || valor.isJsonNull()) {
            if (obligatorio || valor != null) throw new IllegalArgumentException("Falta un valor válido para " + campo + ".");
            return;
        }
        // Never let Gson coerce strings, truncate fractions or wrap oversized integers.
        if (!valor.isJsonPrimitive() || !valor.getAsJsonPrimitive().isNumber()
                || !valor.getAsString().matches("[0-9]+"))
            throw new IllegalArgumentException(campo + " debe ser un entero no negativo.");
        try {
            if (new java.math.BigInteger(valor.getAsString()).compareTo(java.math.BigInteger.valueOf(maximo)) > 0)
                throw new IllegalArgumentException(campo + " está fuera de rango.");
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(campo + " está fuera de rango.");
        }
    }

    private void texto(JsonObject objeto, String campo, boolean obligatorio) {
        var valor = objeto.get(campo);
        if (valor == null && !obligatorio) return;
        if (valor == null || !valor.isJsonPrimitive() || !valor.getAsJsonPrimitive().isString()
                || valor.getAsString().isBlank()) throw new IllegalArgumentException(campo + " debe ser texto no vacío.");
    }

    private JsonObject cuerpoSala(HttpExchange x, Set<String> campos) throws IOException {
        if (!Optional.ofNullable(x.getRequestHeaders().getFirst("Content-Type")).orElse("").toLowerCase(Locale.ROOT).startsWith("application/json"))
            throw new ErrorSala(400, "Se requiere JSON.");
        byte[] bytes = x.getRequestBody().readNBytes(8193);
        if (bytes.length > 8192) throw new ErrorSala(413, "Solicitud demasiado grande.");
        JsonElement dato = gson.fromJson(new String(bytes, StandardCharsets.UTF_8), JsonElement.class);
        if (dato == null || !dato.isJsonObject() || !campos.containsAll(dato.getAsJsonObject().keySet()))
            throw new IllegalArgumentException("Campos de solicitud no válidos.");
        return dato.getAsJsonObject();
    }

    private String nombre(JsonObject cuerpo) {
        var nombre = cuerpo.get("nombre");
        if (nombre == null || !nombre.isJsonPrimitive() || !nombre.getAsJsonPrimitive().isString())
            throw new IllegalArgumentException("Indica tu nombre.");
        return nombre.getAsString();
    }

    private synchronized SesionJuego sesion(HttpExchange x) {
        long ahora = Instant.now().getEpochSecond();
        sesiones.entrySet().removeIf(e -> ahora - e.getValue().acceso().get() > 86400);
        String cookie = x.getRequestHeaders().getFirst("Cookie");
        if (cookie != null) for (String parte : cookie.split(";")) {
            String[] par = parte.trim().split("=", 2);
            if (par.length == 2 && par[0].equals("tesis")) {
                Entrada entrada = sesiones.get(par[1]);
                if (entrada != null) { entrada.acceso().set(ahora); return entrada.juego(); }
            }
        }
        if (sesiones.size() >= 64) throw new IllegalStateException("Hay demasiadas mesas abiertas.");
        String id = UUID.randomUUID().toString();
        var entrada = new Entrada(new SesionJuego(), new java.util.concurrent.atomic.AtomicLong(ahora));
        sesiones.put(id, entrada);
        x.getResponseHeaders().add("Set-Cookie", "tesis=" + id + "; Path=/; HttpOnly; SameSite=Strict");
        return entrada.juego();
    }
    private void json(HttpExchange x, int estado, Object dato) throws IOException {
        enviar(x, estado, "application/json; charset=utf-8", gson.toJson(dato).getBytes(StandardCharsets.UTF_8));
    }
    private void estatico(HttpExchange x) throws IOException {
        try {
            if (!x.getRequestMethod().equals("GET") && !x.getRequestMethod().equals("HEAD")) {
                enviar(x, 405, "text/plain", new byte[0]); return;
            }
            String ruta = x.getRequestURI().getPath();
            if (ruta.equals("/")) ruta = "/index.html";
            if (ruta.contains("..") || ruta.contains("\\") || ruta.contains("\0") || ruta.contains("/referencias/")) {
                enviar(x, 404, "text/plain", new byte[0]); return;
            }
            try (InputStream archivo = ServidorWeb.class.getResourceAsStream("/static" + ruta)) {
                if (archivo == null) { enviar(x, 404, "text/plain", new byte[0]); return; }
                String tipo = ruta.endsWith(".webp") ? "image/webp" : ruta.endsWith(".png") ? "image/png" : ruta.endsWith(".css") ? "text/css; charset=utf-8"
                        : ruta.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
                x.getResponseHeaders().set("Cache-Control", ruta.endsWith(".png") || ruta.endsWith(".webp") ? "public, max-age=86400" : "no-cache");
                x.getResponseHeaders().set("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
                        + (cuentas.habilitado() ? " " + cuentas.url() : "")
                        + "; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
                if (x.getRequestMethod().equals("HEAD")) { x.getResponseHeaders().set("Content-Type", tipo); x.sendResponseHeaders(200, -1); }
                else {
                    x.getResponseHeaders().set("Content-Type", tipo);
                    x.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
                    x.sendResponseHeaders(200, 0); archivo.transferTo(x.getResponseBody());
                }
            }
        } finally { x.close(); }
    }
    private void enviar(HttpExchange x, int codigo, String tipo, byte[] bytes) throws IOException {
        x.getResponseHeaders().set("Content-Type", tipo);
        x.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        x.sendResponseHeaders(codigo, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) x.getResponseBody().write(bytes);
    }
}
