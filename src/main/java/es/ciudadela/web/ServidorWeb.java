package es.ciudadela.web;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Servidor local, sin framework adicional. Sirve solo recursos del classpath static. */
public final class ServidorWeb implements AutoCloseable {
    private final HttpServer servidor;
    private final ExecutorService ejecutor = Executors.newFixedThreadPool(4);
    private final Map<String, Entrada> sesiones = new ConcurrentHashMap<>();
    private final Gson gson = new GsonBuilder().setStrictness(Strictness.STRICT).create();
    private record Entrada(SesionJuego juego, java.util.concurrent.atomic.AtomicLong acceso) {}

    public ServidorWeb(int puerto) throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", puerto), 0);
        servidor.setExecutor(ejecutor);
        servidor.createContext("/api/", this::api);
        servidor.createContext("/", this::estatico);
    }
    public void iniciar() { servidor.start(); }
    public int puerto() { return servidor.getAddress().getPort(); }
    @Override public void close() { servidor.stop(0); ejecutor.shutdownNow(); }

    public static void main(String[] args) throws IOException {
        int puerto = args.length == 0 ? 8080 : Integer.parseInt(args[0]);
        var web = new ServidorWeb(puerto);
        Runtime.getRuntime().addShutdownHook(new Thread(web::close));
        web.iniciar();
        System.out.println("Ciudadela Académica: http://localhost:" + web.puerto());
    }

    private void api(HttpExchange x) throws IOException {
        x.getResponseHeaders().set("Cache-Control", "no-store");
        try {
            String metodo = x.getRequestMethod(); String ruta = x.getRequestURI().getPath();
            if (!Set.of("GET", "POST").contains(metodo)) { json(x, 405, Map.of("error", "Método no permitido.")); return; }
            if (!hostValido(x)) { json(x, 403, Map.of("error", "Acceso local no válido.")); return; }
            if (metodo.equals("POST") && (!"1".equals(x.getRequestHeaders().getFirst("X-Ciudadela")) || !origenValido(x))) {
                json(x, 403, Map.of("error", "Solicitud de otro origen rechazada.")); return;
            }
            if (ruta.equals("/api/config") && metodo.equals("GET")) { json(x, 200, SesionJuego.configuracion()); return; }
            SesionJuego juego = sesion(x);
            if (ruta.equals("/api/game/state") && metodo.equals("GET")) { json(x, 200, juego.estado()); return; }
            if (!metodo.equals("POST")) { json(x, 404, Map.of("error", "Ruta no encontrada.")); return; }
            byte[] cuerpo = x.getRequestBody().readNBytes(8193);
            if (cuerpo.length > 8192) { json(x, 413, Map.of("error", "Solicitud demasiado grande.")); return; }
            var p = gson.fromJson(new String(cuerpo, StandardCharsets.UTF_8), Vistas.Peticion.class);
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
        } catch (SesionJuego.Conflicto e) {
            json(x, 409, Map.of("error", e.getMessage()));
        } catch (JsonParseException e) {
            json(x, 400, Map.of("error", "La solicitud JSON no es válida."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            json(x, 400, Map.of("error", e.getMessage() == null ? "Solicitud no válida." : e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace(); json(x, 500, Map.of("error", "No se pudo completar la operación. Actualiza la mesa."));
        } finally { x.close(); }
    }

    private boolean hostValido(HttpExchange x) {
        String host = x.getRequestHeaders().getFirst("Host");
        return ("localhost:" + puerto()).equals(host) || ("127.0.0.1:" + puerto()).equals(host);
    }
    private boolean origenValido(HttpExchange x) {
        String origen = x.getRequestHeaders().getFirst("Origin");
        return origen == null || origen.equals("http://" + x.getRequestHeaders().getFirst("Host"));
    }

    private synchronized SesionJuego sesion(HttpExchange x) {
        long ahora = Instant.now().getEpochSecond();
        sesiones.entrySet().removeIf(e -> ahora - e.getValue().acceso().get() > 86400);
        String cookie = x.getRequestHeaders().getFirst("Cookie");
        if (cookie != null) for (String parte : cookie.split(";")) {
            String[] par = parte.trim().split("=", 2);
            if (par.length == 2 && par[0].equals("ciudadela")) {
                Entrada entrada = sesiones.get(par[1]);
                if (entrada != null) { entrada.acceso().set(ahora); return entrada.juego(); }
            }
        }
        if (sesiones.size() >= 64) throw new IllegalStateException("Hay demasiadas mesas abiertas.");
        String id = UUID.randomUUID().toString();
        var entrada = new Entrada(new SesionJuego(), new java.util.concurrent.atomic.AtomicLong(ahora));
        sesiones.put(id, entrada);
        x.getResponseHeaders().add("Set-Cookie", "ciudadela=" + id + "; Path=/; HttpOnly; SameSite=Strict");
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
                String tipo = ruta.endsWith(".png") ? "image/png" : ruta.endsWith(".css") ? "text/css; charset=utf-8"
                        : ruta.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
                x.getResponseHeaders().set("Cache-Control", ruta.endsWith(".png") ? "public, max-age=86400" : "no-cache");
                x.getResponseHeaders().set("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
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
