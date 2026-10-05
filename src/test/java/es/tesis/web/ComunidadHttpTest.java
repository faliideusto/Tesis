package es.tesis.web;

import com.google.gson.*;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import es.tesis.cuentas.CuentasSupabase;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import static org.junit.jupiter.api.Assertions.*;

class ComunidadHttpTest {
    private static final String CODIGO = "ABCDEF0123456789";
    private static final String COMUNIDAD = """
            {"codigo":"ABCDEF0123456789","amigos":[{"codigo":"0123456789ABCDEF","nombre":"Ana","nivel":2,"user_id":"secreto"}],"recibidas":[],"enviadas":[],"email":"privado"}
            """;
    private static final String MISIONES = """
            {"diarias":[{"id":"diarias:jugar1:2026-10-06","titulo":"Juega una partida","objetivo":1,"progreso":1,"xp":50,"completada":true,"reclamada":false}],"semanales":[],"reinicioDiario":"2026-10-07T00:00:00+00:00","reinicioSemanal":"2026-10-12T00:00:00+00:00"}
            """;

    private static final class Entorno implements AutoCloseable {
        final HttpServer remoto;
        final ServidorWeb web;
        final String jwt, base;
        final List<String> peticiones = new CopyOnWriteArrayList<>();
        volatile String respuesta = COMUNIDAD;
        volatile int estado = 200;
        Entorno() throws Exception {
            var clave = new ECKeyGenerator(Curve.P_256).keyID("test").generate();
            remoto = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            String origen = "http://127.0.0.1:" + remoto.getAddress().getPort();
            var token = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("test").build(),
                    new JWTClaimsSet.Builder().issuer(origen + "/auth/v1").audience("authenticated")
                            .subject(UUID.randomUUID().toString()).claim("role", "authenticated")
                            .expirationTime(Date.from(Instant.now().plusSeconds(300))).build());
            token.sign(new ECDSASigner(clave)); jwt = token.serialize();
            remoto.createContext("/auth/v1/.well-known/jwks.json", x -> {
                byte[] b = new JWKSet(clave.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
                x.sendResponseHeaders(200, b.length); x.getResponseBody().write(b); x.close();
            });
            remoto.createContext("/rest/v1/rpc/", x -> {
                peticiones.add(x.getRequestURI().getPath() + " " + new String(x.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                boolean identidad = ("Bearer " + jwt).equals(x.getRequestHeaders().getFirst("Authorization"))
                        && "sb_publishable_test".equals(x.getRequestHeaders().getFirst("apikey")) && "POST".equals(x.getRequestMethod());
                byte[] b = (identidad ? respuesta : "{}").getBytes(StandardCharsets.UTF_8);
                x.sendResponseHeaders(identidad ? estado : 403, b.length); x.getResponseBody().write(b); x.close();
            });
            remoto.start();
            web = new ServidorWeb("127.0.0.1", 0, new CuentasSupabase(new CuentasSupabase.Configuracion(origen, "sb_publishable_test", "sb_secret_privado")));
            web.iniciar(); base = "http://127.0.0.1:" + web.puerto();
        }
        HttpResponse<String> pedir(String ruta, String metodo, String cuerpo, String token) throws Exception {
            var b = HttpRequest.newBuilder(URI.create(base + ruta));
            if (token != null) b.header("Authorization", "Bearer " + token);
            if (cuerpo != null) b.header("Content-Type", "application/json");
            if (metodo.equals("POST")) b.header("X-Tesis", "1");
            b.method(metodo, cuerpo == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(cuerpo));
            return HttpClient.newHttpClient().send(b.build(), HttpResponse.BodyHandlers.ofString());
        }
        public void close() { web.close(); remoto.stop(0); }
    }

    @Test void verificaJwtUsaCredencialesUsuarioYProyectaDtosSinCamposPrivados() throws Exception {
        try (var e = new Entorno()) {
            assertEquals(401, e.pedir("/api/comunidad", "GET", null, null).statusCode());
            assertEquals(401, e.pedir("/api/comunidad", "GET", null, "token-sala").statusCode());
            assertTrue(e.peticiones.isEmpty());
            var comunidad = e.pedir("/api/comunidad", "GET", null, e.jwt);
            assertEquals(200, comunidad.statusCode());
            assertFalse(comunidad.body().contains("privado")); assertFalse(comunidad.body().contains("user_id"));
            assertTrue(comunidad.body().contains("Ana"));
            assertEquals(200, e.pedir("/api/amigos", "POST", "{\"codigo\":\"abcdef0123456789\",\"accion\":\"solicitar\"}", e.jwt).statusCode());
            assertTrue(e.peticiones.get(1).contains("\"p_codigo\":\"" + CODIGO + "\""));
            e.respuesta = "{\"criterio\":\"victorias\",\"entradas\":[{\"posicion\":1,\"codigo\":\"" + CODIGO + "\",\"nombre\":\"Ana\",\"nivel\":2,\"xp\":500,\"victorias\":2,\"partidas\":4,\"yo\":false,\"email\":\"secreto\"}],\"propia\":null}";
            var ranking = e.pedir("/api/ranking?criterio=victorias", "GET", null, e.jwt);
            assertEquals(200, ranking.statusCode());
            assertTrue(JsonParser.parseString(ranking.body()).getAsJsonObject().get("propia").isJsonNull());
            assertFalse(ranking.body().contains("secreto"));
            e.respuesta = MISIONES;
            assertEquals(200, e.pedir("/api/misiones", "GET", null, e.jwt).statusCode());
            assertEquals(200, e.pedir("/api/misiones/reclamar", "POST", "{\"id\":\"diarias:jugar1:2026-10-06\"}", e.jwt).statusCode());
            assertTrue(e.peticiones.get(4).contains("/reclamar_mision"));
        }
    }

    @Test void rechazaSuplantacionTiposMetodosYConsultasAntesDeRpc() throws Exception {
        try (var e = new Entorno()) {
            for (String cuerpo : List.of("{\"codigo\":\"" + CODIGO + "\",\"accion\":\"solicitar\",\"actor\":\"otro\"}",
                    "{\"codigo\":123,\"accion\":\"solicitar\"}", "{\"codigo\":\"" + CODIGO + "\",\"accion\":false}",
                    "{\"codigo\":\"" + CODIGO + "\",\"accion\":\"inventada\"}", "{}", "[]"))
                assertEquals(400, e.pedir("/api/amigos", "POST", cuerpo, e.jwt).statusCode(), cuerpo);
            assertEquals(400, e.pedir("/api/misiones/reclamar", "POST", "{\"id\":123}", e.jwt).statusCode());
            assertEquals(400, e.pedir("/api/misiones/reclamar", "POST", "{\"id\":\"diarias:jugar1:2026-10-06\",\"xp\":999}", e.jwt).statusCode());
            for (String consulta : List.of("criterio=otro", "criterio=xp&criterio=partidas", "user_id=otro", "criterio=%78p"))
                assertEquals(400, e.pedir("/api/ranking?" + consulta, "GET", null, e.jwt).statusCode());
            assertEquals(400, e.pedir("/api/comunidad?actor=otro", "GET", null, e.jwt).statusCode());
            assertEquals(405, e.pedir("/api/amigos", "GET", null, e.jwt).statusCode());
            assertEquals(405, e.pedir("/api/misiones", "POST", "{}", e.jwt).statusCode());
            assertEquals(405, e.pedir("/api/ranking", "DELETE", null, e.jwt).statusCode());
            assertTrue(e.peticiones.isEmpty());
        }
    }

    @Test void erroresFuncionalesSegurosYRespuestasRemotasInvalidasFallanCerradas() throws Exception {
        try (var e = new Entorno()) {
            e.estado = 400; e.respuesta = "{\"code\":\"22023\",\"message\":\"No puedes agregarte a ti mismo\",\"details\":\"sb_secret_privado\"}";
            var resultado = e.pedir("/api/amigos", "POST", "{\"codigo\":\"" + CODIGO + "\",\"accion\":\"solicitar\"}", e.jwt);
            assertEquals(400, resultado.statusCode()); assertTrue(resultado.body().contains("ti mismo")); assertFalse(resultado.body().contains("sb_secret"));
            e.respuesta = "{\"code\":\"22023\",\"message\":\"sb_secret_privado\"}";
            resultado = e.pedir("/api/comunidad", "GET", null, e.jwt);
            assertEquals(503, resultado.statusCode()); assertFalse(resultado.body().contains("sb_secret"));
            e.estado = 200;
            e.respuesta = COMUNIDAD.replace("\"nivel\":2", "\"nivel\":\"2\"");
            assertEquals(503, e.pedir("/api/comunidad", "GET", null, e.jwt).statusCode());
            e.respuesta = MISIONES.replace("\"progreso\":1", "\"progreso\":0");
            assertEquals(503, e.pedir("/api/misiones", "GET", null, e.jwt).statusCode());
            e.respuesta = "[]";
            assertEquals(503, e.pedir("/api/comunidad", "GET", null, e.jwt).statusCode());
        }
    }
}
