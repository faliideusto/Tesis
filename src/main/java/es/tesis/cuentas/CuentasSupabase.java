package es.tesis.cuentas;

import com.google.gson.*;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jwt.SignedJWT;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** Adaptador de cuentas. La identidad de sala y el resultado del motor quedan fuera. */
public final class CuentasSupabase implements AutoCloseable {
    public record Configuracion(String url, String publishableKey, String secretKey) {
        @Override public String toString() { return "ConfiguracionSupabase[claves ocultas]"; }
    }
    public record Perfil(String nombre, long xp, int nivel, long partidasTerminadas, long victorias) {}
    public record PerfilPublico(String codigo, String nombre, long xp, int nivel, long partidasTerminadas,
                                long victorias, boolean enLinea, boolean presenciaDisponible) {}
    public record Amigo(String codigo, String nombre, int nivel, boolean enLinea) {}
    public record Comunidad(String codigo, List<Amigo> amigos, List<Amigo> recibidas, List<Amigo> enviadas, List<Amigo> sugerencias, boolean presenciaDisponible) {}
    public record Presencia(boolean activa) {}
    public record EntradaRanking(long posicion, String codigo, String nombre, int nivel, long xp,
                                 long victorias, long partidas, boolean yo) {}
    public record Ranking(String criterio, List<EntradaRanking> entradas, EntradaRanking propia) {}
    public record Mision(String id, String titulo, long objetivo, long progreso, long xp, boolean completada, boolean reclamada) {}
    public record Misiones(List<Mision> diarias, List<Mision> semanales, String reinicioDiario, String reinicioSemanal) {}
    public record Participante(int seat, UUID user_id, String display_name, int prestige, boolean winner) {}

    private static final Gson JSON = new GsonBuilder().serializeNulls().create();
    private final Configuracion configuracion;
    private final HttpClient cliente;
    private final Clock reloj;
    private JWKSet claves;
    private Instant cacheHasta = Instant.MIN;
    private Instant proximaConsulta = Instant.MIN;

    public static CuentasSupabase desdeEntorno() {
        return desdeVariables(System.getenv());
    }

    static CuentasSupabase desdeVariables(Map<String, String> variables) {
        String url = limpiar(variables.get("SUPABASE_URL"));
        String publica = limpiar(variables.get("SUPABASE_PUBLISHABLE_KEY"));
        String secreta = limpiar(variables.get("SUPABASE_SECRET_KEY"));
        if (url.isEmpty() && publica.isEmpty() && secreta.isEmpty()) return new CuentasSupabase(null);
        if (url.isEmpty() || publica.isEmpty() || secreta.isEmpty())
            throw new IllegalStateException("La configuración de Supabase está incompleta.");
        validarUrl(url, false);
        return new CuentasSupabase(new Configuracion(url, publica, secreta));
    }

    public CuentasSupabase(Configuracion configuracion) {
        this(configuracion, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build(), Clock.systemUTC());
    }

    /** Inyección para pruebas: HTTP permitido únicamente contra loopback. */
    public CuentasSupabase(Configuracion configuracion, HttpClient cliente, Clock reloj) {
        if (configuracion != null) {
            validarUrl(configuracion.url(), true);
            if (limpiar(configuracion.publishableKey()).isEmpty() || limpiar(configuracion.secretKey()).isEmpty()
                    || configuracion.publishableKey().equals(configuracion.secretKey())
                    || configuracion.publishableKey().startsWith("sb_secret_"))
                throw new IllegalArgumentException("Claves de Supabase inválidas.");
            // Las claves legacy son JWT: la pública jamás puede llevar el rol service_role.
            if (configuracion.publishableKey().startsWith("eyJ")) {
                try {
                    if (!"anon".equals(SignedJWT.parse(configuracion.publishableKey()).getJWTClaimsSet().getStringClaim("role")))
                        throw new IllegalArgumentException("La clave pública debe tener rol anon.");
                } catch (java.text.ParseException e) { throw new IllegalArgumentException("Clave pública inválida."); }
            }
        }
        this.configuracion = configuracion;
        this.cliente = Objects.requireNonNull(cliente);
        this.reloj = Objects.requireNonNull(reloj);
    }

    private static String limpiar(String valor) { return valor == null ? "" : valor.strip(); }
    private static void validarUrl(String valor, boolean pruebas) {
        try {
            URI uri = URI.create(valor);
            boolean loopback = pruebas && "http".equals(uri.getScheme())
                    && Set.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost());
            if (!("https".equals(uri.getScheme()) || loopback) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || !uri.getRawPath().isEmpty()) throw new IllegalArgumentException();
        } catch (RuntimeException e) { throw new IllegalArgumentException("SUPABASE_URL debe ser un origen HTTPS sin ruta."); }
    }

    public boolean habilitado() { return configuracion != null; }
    public String url() { return habilitado() ? configuracion.url() : ""; }
    public String publishableKey() { return habilitado() ? configuracion.publishableKey() : ""; }
    private void exigirHabilitado() { if (!habilitado()) throw indisponible(); }
    private static ExcepcionCuenta invalida() { return new ExcepcionCuenta(401, "La sesión de cuenta no es válida. Inicia sesión de nuevo."); }
    private static ExcepcionCuenta indisponible() { return new ExcepcionCuenta(503, "El servicio de cuentas no está disponible. Inténtalo más tarde."); }

    public UUID autenticar(String token) {
        exigirHabilitado();
        if (token == null || token.length() > 16384 || token.isBlank()) throw invalida();
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            var alg = jwt.getHeader().getAlgorithm();
            if (!(JWSAlgorithm.ES256.equals(alg) || JWSAlgorithm.RS256.equals(alg))
                    || jwt.getHeader().getCriticalParams() != null || jwt.getHeader().getKeyID() == null) throw invalida();
            JWK clave = clave(jwt.getHeader().getKeyID());
            if (clave == null || (clave.getKeyUse() != null && !KeyUse.SIGNATURE.equals(clave.getKeyUse()))
                    || (clave.getAlgorithm() != null && !alg.equals(clave.getAlgorithm()))) throw invalida();
            boolean firma = JWSAlgorithm.ES256.equals(alg) && clave instanceof ECKey ec && Curve.P_256.equals(ec.getCurve())
                    ? jwt.verify(new ECDSAVerifier(ec.toECPublicKey()))
                    : JWSAlgorithm.RS256.equals(alg) && clave instanceof RSAKey rsa && rsa.size() >= 2048
                    && jwt.verify(new RSASSAVerifier(rsa.toRSAPublicKey()));
            if (!firma) throw invalida();
            var claims = jwt.getJWTClaimsSet();
            Instant ahora = reloj.instant();
            if (!Objects.equals(url() + "/auth/v1", claims.getIssuer())
                    || !claims.getAudience().contains("authenticated")
                    || !"authenticated".equals(claims.getStringClaim("role"))
                    || claims.getExpirationTime() == null || !claims.getExpirationTime().toInstant().isAfter(ahora)
                    || (claims.getNotBeforeTime() != null && claims.getNotBeforeTime().toInstant().isAfter(ahora))) throw invalida();
            String sub = claims.getSubject();
            UUID identidad = UUID.fromString(sub);
            if (!identidad.toString().equalsIgnoreCase(sub)) throw invalida();
            return identidad;
        } catch (ExcepcionCuenta e) { throw e; }
        catch (Exception e) { throw invalida(); }
    }

    private synchronized JWK clave(String kid) {
        Instant ahora = reloj.instant();
        JWK encontrada = claves == null ? null : claves.getKeyByKeyId(kid);
        if (encontrada != null && ahora.isBefore(cacheHasta)) return encontrada;
        if (ahora.isBefore(proximaConsulta)) {
            if (ahora.isBefore(cacheHasta)) return encontrada;
            throw indisponible();
        }
        proximaConsulta = ahora.plusSeconds(10);
        try {
            claves = JWKSet.parse(pedir("/auth/v1/.well-known/jwks.json", "GET", null, null, false));
            cacheHasta = ahora.plusSeconds(600);
            return claves.getKeyByKeyId(kid);
        } catch (Exception e) { throw indisponible(); }
    }

    public Perfil perfil(String jwt) {
        UUID id = autenticar(jwt);
        return leerPerfil(pedir("/rest/v1/profiles?id=eq." + id + "&select=display_name,xp,games_finished,wins", "GET", jwt, null, false));
    }

    public Perfil renombrar(String jwt, String nombre) {
        UUID id = autenticar(jwt);
        String limpio = nombre == null ? "" : nombre.strip();
        if (limpio.length() < 1 || limpio.length() > 24 || limpio.codePoints().anyMatch(Character::isISOControl))
            throw new ExcepcionCuenta(400, "El nombre debe tener entre 1 y 24 caracteres sin controles.");
        JsonObject cuerpo = new JsonObject();
        cuerpo.addProperty("display_name", limpio);
        return leerPerfil(pedir("/rest/v1/profiles?id=eq." + id + "&select=display_name,xp,games_finished,wins", "PATCH", jwt, JSON.toJson(cuerpo), false));
    }

    private Perfil leerPerfil(String cuerpo) {
        try {
            JsonArray filas = JsonParser.parseString(cuerpo).getAsJsonArray();
            if (filas.size() != 1) throw indisponible();
            JsonObject p = filas.get(0).getAsJsonObject();
            long xp = p.get("xp").getAsLong(), partidas = p.get("games_finished").getAsLong(), victorias = p.get("wins").getAsLong();
            if (xp < 0 || partidas < 0 || victorias < 0 || victorias > partidas) throw indisponible();
            return new Perfil(p.get("display_name").getAsString(), xp, (int)Math.min(Integer.MAX_VALUE, 1 + xp / 500), partidas, victorias);
        } catch (RuntimeException e) { throw indisponible(); }
    }

    public Comunidad comunidad(String jwt) { return leerComunidad(rpc(jwt, "comunidad", new JsonObject())); }

    public PerfilPublico perfilPublico(String jwt, String codigo) {
        if (codigo == null || !codigo.matches("[A-Fa-f0-9]{16}"))
            throw new ExcepcionCuenta(400, "Indica un código de perfil válido.");
        JsonObject cuerpo = new JsonObject(); cuerpo.addProperty("p_codigo", codigo.toUpperCase(Locale.ROOT));
        JsonObject dato = rpc(jwt, "perfil_publico", cuerpo);
        try {
            long xp = numero(dato, "xp"), partidas = numero(dato, "partidasTerminadas"), victorias = numero(dato, "victorias");
            int nivel = nivel(dato);
            boolean disponible = booleano(dato, "presenciaDisponible"), enLinea = booleano(dato, "enLinea");
            if (!codigo.toUpperCase(Locale.ROOT).equals(codigo(dato)) || victorias > partidas
                    || nivel != Math.min(Integer.MAX_VALUE, 1 + xp / 500) || (!disponible && enLinea)) throw indisponible();
            return new PerfilPublico(codigo(dato), cadena(dato, "nombre", 24), xp, nivel, partidas, victorias, enLinea, disponible);
        } catch (RuntimeException e) { throw indisponible(); }
    }

    public Presencia presencia(String jwt) {
        JsonObject dato = rpc(jwt, "presencia", new JsonObject());
        if (!booleano(dato, "activa")) throw indisponible();
        return new Presencia(true);
    }

    /** Solo servidor: actor previamente autenticado; UUID destino jamás sale al navegador. */
    public UUID resolverAmigoEnLinea(UUID actor, String codigo) {
        exigirHabilitado(); Objects.requireNonNull(actor);
        if (codigo == null || !codigo.matches("[A-Fa-f0-9]{16}"))
            throw new ExcepcionCuenta(400,"Indica un código de amistad válido.");
        JsonObject cuerpo = new JsonObject(); cuerpo.addProperty("p_actor",actor.toString());
        cuerpo.addProperty("p_codigo",codigo.toUpperCase(Locale.ROOT));
        try {
            JsonObject dato = JsonParser.parseString(pedir("/rest/v1/rpc/resolver_amigo_en_linea","POST",null,JSON.toJson(cuerpo),true)).getAsJsonObject();
            JsonElement destino = dato.get("destino");
            if (destino == null || destino.isJsonNull()) throw new ExcepcionCuenta(400,"Este amigo no está disponible para recibir una invitación.");
            if (!destino.isJsonPrimitive() || !destino.getAsJsonPrimitive().isString()) throw indisponible();
            UUID identidad = UUID.fromString(destino.getAsString());
            if (identidad.equals(actor) || !identidad.toString().equalsIgnoreCase(destino.getAsString())) throw indisponible();
            return identidad;
        } catch (ExcepcionCuenta e) { throw e; }
        catch (RuntimeException e) { throw indisponible(); }
    }

    public Comunidad amistad(String jwt, String codigo, String accion) {
        if (codigo == null || !codigo.matches("[A-Fa-f0-9]{16}"))
            throw new ExcepcionCuenta(400, "Indica un código de amistad válido.");
        if (!Set.of("solicitar", "aceptar", "rechazar", "cancelar", "eliminar").contains(accion == null ? "" : accion))
            throw new ExcepcionCuenta(400, "Acción de amistad no válida.");
        JsonObject cuerpo = new JsonObject();
        cuerpo.addProperty("p_codigo", codigo.toUpperCase(Locale.ROOT)); cuerpo.addProperty("p_accion", accion);
        return leerComunidad(rpc(jwt, "amistad", cuerpo));
    }

    public Ranking ranking(String jwt, String criterio) {
        if (!Set.of("xp", "victorias", "partidas").contains(criterio == null ? "" : criterio))
            throw new ExcepcionCuenta(400, "Criterio de ranking no válido.");
        JsonObject cuerpo = new JsonObject(); cuerpo.addProperty("p_criterio", criterio);
        JsonObject dato = rpc(jwt, "ranking", cuerpo);
        try {
            if (!criterio.equals(cadena(dato, "criterio", 16))) throw indisponible();
            List<EntradaRanking> entradas = new ArrayList<>();
            for (JsonElement fila : lista(dato, "entradas", 50)) entradas.add(leerEntrada(fila.getAsJsonObject()));
            JsonElement propia = dato.get("propia");
            if (propia == null) throw indisponible();
            EntradaRanking personal = propia.isJsonNull() ? null : leerEntrada(propia.getAsJsonObject());
            if (personal != null && !personal.yo()) throw indisponible();
            return new Ranking(criterio, List.copyOf(entradas), personal);
        } catch (RuntimeException e) { throw indisponible(); }
    }

    public Misiones misiones(String jwt) { return leerMisiones(rpc(jwt, "misiones", new JsonObject())); }

    public Misiones reclamarMision(String jwt, String id) {
        if (id == null || !id.matches("(diarias|semanales):[a-z0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}") || id.length() > 64)
            throw new ExcepcionCuenta(400, "Identificador de misión no válido.");
        JsonObject cuerpo = new JsonObject(); cuerpo.addProperty("p_id", id);
        return leerMisiones(rpc(jwt, "reclamar_mision", cuerpo));
    }

    private JsonObject rpc(String jwt, String nombre, JsonObject cuerpo) {
        autenticar(jwt);
        try { return JsonParser.parseString(pedir("/rest/v1/rpc/" + nombre, "POST", jwt, JSON.toJson(cuerpo), false)).getAsJsonObject(); }
        catch (ExcepcionCuenta e) { throw e; }
        catch (RuntimeException e) { throw indisponible(); }
    }

    private Comunidad leerComunidad(JsonObject dato) {
        try { return new Comunidad(codigo(dato), amigos(dato, "amigos"), amigos(dato, "recibidas"), amigos(dato, "enviadas"),
                dato.has("sugerencias") ? amigos(dato, "sugerencias") : List.of(),
                dato.has("presenciaDisponible") && booleano(dato, "presenciaDisponible")); }
        catch (RuntimeException e) { throw indisponible(); }
    }
    private List<Amigo> amigos(JsonObject dato, String campo) {
        List<Amigo> resultado = new ArrayList<>();
        for (JsonElement fila : lista(dato, campo, campo.equals("sugerencias") ? 12 : 100)) {
            JsonObject amigo = fila.getAsJsonObject();
            boolean enLinea = amigo.has("enLinea") && booleano(amigo, "enLinea");
            // La presencia solo se proyecta para amistades aceptadas.
            resultado.add(new Amigo(codigo(amigo), cadena(amigo, "nombre", 24), nivel(amigo), campo.equals("amigos") && enLinea));
        }
        return List.copyOf(resultado);
    }
    private EntradaRanking leerEntrada(JsonObject dato) {
        long posicion = numero(dato, "posicion"), xp = numero(dato, "xp"), victorias = numero(dato, "victorias"), partidas = numero(dato, "partidas");
        if (posicion < 1 || victorias > partidas) throw indisponible();
        return new EntradaRanking(posicion, codigo(dato), cadena(dato, "nombre", 24), nivel(dato), xp, victorias, partidas, booleano(dato, "yo"));
    }
    private Misiones leerMisiones(JsonObject dato) {
        try {
            String diario = cadena(dato, "reinicioDiario", 64), semanal = cadena(dato, "reinicioSemanal", 64);
            OffsetDateTime.parse(diario); OffsetDateTime.parse(semanal);
            return new Misiones(listaMisiones(dato, "diarias"), listaMisiones(dato, "semanales"), diario, semanal);
        } catch (RuntimeException e) { throw indisponible(); }
    }
    private List<Mision> listaMisiones(JsonObject dato, String campo) {
        List<Mision> resultado = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonElement fila : lista(dato, campo, 20)) {
            JsonObject m = fila.getAsJsonObject(); String id = cadena(m, "id", 64);
            long objetivo = numero(m, "objetivo"), progreso = numero(m, "progreso");
            boolean completa = booleano(m, "completada"), reclamada = booleano(m, "reclamada");
            if (!ids.add(id) || objetivo < 1 || completa != (progreso >= objetivo) || (reclamada && !completa)) throw indisponible();
            resultado.add(new Mision(id, cadena(m, "titulo", 120), objetivo, progreso, numero(m, "xp"), completa, reclamada));
        }
        return List.copyOf(resultado);
    }
    private static JsonArray lista(JsonObject dato, String campo, int maximo) {
        JsonArray lista = dato.getAsJsonArray(campo);
        if (lista == null || lista.size() > maximo) throw indisponible();
        return lista;
    }
    private static String cadena(JsonObject dato, String campo, int maximo) {
        JsonElement valor = dato.get(campo);
        if (valor == null || !valor.isJsonPrimitive() || !valor.getAsJsonPrimitive().isString()) throw indisponible();
        String texto = valor.getAsString();
        if (texto.isBlank() || texto.length() > maximo || texto.codePoints().anyMatch(Character::isISOControl)) throw indisponible();
        return texto;
    }
    private static String codigo(JsonObject dato) {
        String codigo = cadena(dato, "codigo", 32);
        if (!codigo.matches("[A-F0-9]{16}")) throw indisponible();
        return codigo;
    }
    private static int nivel(JsonObject dato) {
        long nivel = numero(dato, "nivel");
        if (nivel < 1 || nivel > Integer.MAX_VALUE) throw indisponible();
        return (int)nivel;
    }
    private static long numero(JsonObject dato, String campo) {
        JsonElement valor = dato.get(campo);
        if (valor == null || !valor.isJsonPrimitive() || !valor.getAsJsonPrimitive().isNumber()
                || !valor.getAsString().matches("[0-9]+")) throw indisponible();
        return Long.parseLong(valor.getAsString());
    }
    private static boolean booleano(JsonObject dato, String campo) {
        JsonElement valor = dato.get(campo);
        if (valor == null || !valor.isJsonPrimitive() || !valor.getAsJsonPrimitive().isBoolean()) throw indisponible();
        return valor.getAsBoolean();
    }

    public void registrarResultado(UUID matchId, String hash, Instant completedAt, List<Participante> participantes) {
        exigirHabilitado();
        Objects.requireNonNull(matchId); Objects.requireNonNull(hash); Objects.requireNonNull(completedAt);
        JsonObject cuerpo = new JsonObject();
        cuerpo.addProperty("p_match_id", matchId.toString());
        cuerpo.addProperty("p_result_hash", hash);
        cuerpo.addProperty("p_completed_at", completedAt.toString());
        cuerpo.addProperty("p_version", 1);
        cuerpo.add("p_participants", JSON.toJsonTree(List.copyOf(participantes)));
        pedir("/rest/v1/rpc/registrar_resultado", "POST", null, JSON.toJson(cuerpo), true);
    }

    private String pedir(String ruta, String metodo, String jwt, String cuerpo, boolean privilegiada) {
        try {
            var peticion = HttpRequest.newBuilder(URI.create(url() + ruta)).timeout(Duration.ofSeconds(8))
                    .header("Accept", "application/json");
            if (jwt != null) peticion.header("Authorization", "Bearer " + jwt);
            if (!ruta.startsWith("/auth/")) peticion.header("apikey", privilegiada ? configuracion.secretKey() : publishableKey());
            if (privilegiada && configuracion.secretKey().startsWith("eyJ"))
                peticion.header("Authorization", "Bearer " + configuracion.secretKey());
            if (cuerpo != null) peticion.header("Content-Type", "application/json");
            if ("PATCH".equals(metodo)) peticion.header("Prefer", "return=representation");
            peticion.method(metodo, cuerpo == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(cuerpo));
            var pendiente = cliente.sendAsync(peticion.build(), cuerpoLimitado());
            HttpResponse<byte[]> respuesta;
            try { respuesta = pendiente.get(10, TimeUnit.SECONDS); }
            catch (InterruptedException | TimeoutException e) { pendiente.cancel(true); throw e; }
            if (respuesta.body().length > 65536) throw indisponible();
            int estado = respuesta.statusCode();
            if (!privilegiada && (estado == 401 || estado == 403)) throw invalida();
            if (!privilegiada && ruta.startsWith("/rest/v1/rpc/") && (estado == 400 || estado == 404)) {
                // Únicamente errores de negocio conocidos: nunca publicar hints, detalles o secretos remotos.
                try {
                    JsonObject error = JsonParser.parseString(new String(respuesta.body(), java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
                    String mensaje = error.get("message").getAsString();
                    if (ruta.equals("/rest/v1/rpc/perfil_publico") && "P0002".equals(error.get("code").getAsString())
                            && "Perfil público no encontrado".equals(mensaje)) throw new ExcepcionCuenta(404, mensaje + ".");
                    if ("22023".equals(error.get("code").getAsString()) && Set.of(
                            "Código o acción de amistad inválidos", "No existe una cuenta con ese código",
                            "No puedes agregarte a ti mismo", "Se ha alcanzado el límite de cien amistades y solicitudes",
                            "Solo el receptor puede aceptar una solicitud", "No puedes rechazar esta solicitud",
                            "No puedes cancelar esta solicitud", "La amistad aún no ha sido aceptada",
                            "Criterio de ranking inválido", "Misión inválida", "La misión no existe o ha caducado",
                            "La misión todavía no está completada").contains(mensaje)) throw new ExcepcionCuenta(400, mensaje + ".");
                } catch (ExcepcionCuenta e) { throw e; }
                catch (RuntimeException e) { /* Respuesta desconocida: fallo genérico sin datos remotos. */ }
            }
            if (privilegiada && estado >= 400 && estado < 500 && estado != 408 && estado != 429)
                throw new ExcepcionCuenta(estado, "No se pudo registrar el resultado. Revisa la configuración del servicio.");
            if (estado < 200 || estado >= 300) throw indisponible();
            return new String(respuesta.body(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (ExcepcionCuenta e) { throw e; }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw indisponible(); }
        catch (Exception e) { throw indisponible(); }
    }

    /** Limita durante la recepción, antes de reservar memoria para un cuerpo remoto completo. */
    private static HttpResponse.BodyHandler<byte[]> cuerpoLimitado() {
        return informacion -> new HttpResponse.BodySubscriber<>() {
            private final HttpResponse.BodySubscriber<byte[]> destino = HttpResponse.BodySubscribers.ofByteArray();
            private java.util.concurrent.Flow.Subscription suscripcion;
            private long bytes;
            private boolean terminada;
            public java.util.concurrent.CompletionStage<byte[]> getBody() { return destino.getBody(); }
            public void onSubscribe(java.util.concurrent.Flow.Subscription s) {
                suscripcion = s; destino.onSubscribe(s);
            }
            public void onNext(List<java.nio.ByteBuffer> fragmentos) {
                if (terminada) return;
                for (var fragmento : fragmentos) bytes += fragmento.remaining();
                if (bytes > 65536) {
                    terminada = true; suscripcion.cancel(); destino.onError(new java.io.IOException("Respuesta demasiado grande."));
                } else destino.onNext(fragmentos);
            }
            public void onError(Throwable error) {
                if (!terminada) { terminada = true; destino.onError(error); }
            }
            public void onComplete() {
                if (!terminada) { terminada = true; destino.onComplete(); }
            }
        };
    }

    @Override public void close() { /* HttpClient Java17 no necesita cierre. */ }
}
