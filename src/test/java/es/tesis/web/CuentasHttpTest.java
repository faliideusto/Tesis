package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import com.google.gson.*;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CuentasHttpTest {
    private final HttpClient cliente = HttpClient.newHttpClient();
    private HttpResponse<String> pedir(String base, String ruta, String cuerpo, String tokenSala, String cuenta) throws Exception {
        var b = HttpRequest.newBuilder(URI.create(base + ruta));
        if (tokenSala != null) b.header("Authorization", "Bearer " + tokenSala);
        if (cuenta != null) b.header("X-Tesis-Account-Authorization", "Bearer " + cuenta);
        if (cuerpo != null) b.header("X-Tesis", "1").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo));
        return cliente.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void contratosHttpSeparanCuentaDeSalaYNoPublicanSecretosNiResultado() throws Exception {
        var clave = new ECKeyGenerator(Curve.P_256).keyID("test").generate();
        var supabase = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var remotos = java.util.concurrent.Executors.newFixedThreadPool(2);
        supabase.setExecutor(remotos);
        String origen = "http://127.0.0.1:" + supabase.getAddress().getPort();
        supabase.createContext("/auth/v1/.well-known/jwks.json", x -> {
            byte[] b = new JWKSet(clave.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            x.sendResponseHeaders(200, b.length); x.getResponseBody().write(b); x.close();
        });
        supabase.createContext("/rest/v1/profiles", x -> {
            byte[] b = "[{\"display_name\":\"Ana\",\"xp\":500,\"games_finished\":4,\"wins\":2}]".getBytes(StandardCharsets.UTF_8);
            x.sendResponseHeaders(200, b.length); x.getResponseBody().write(b); x.close();
        });
        supabase.createContext("/rest/v1/rpc/cosmeticos", x -> {
            byte[] b="{\"inventario\":[],\"equipamiento\":{\"avatar\":null,\"marco\":null,\"titulo\":null,\"insignia\":null,\"reverso\":null,\"placa\":null,\"interaccion\":null}}".getBytes(StandardCharsets.UTF_8);
            x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();
        });
        supabase.start();
        var usuario = UUID.randomUUID();
        var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("test").build(),
                new JWTClaimsSet.Builder().issuer(origen + "/auth/v1").audience("authenticated")
                        .subject(usuario.toString()).claim("role", "authenticated")
                        .expirationTime(Date.from(Instant.now().plusSeconds(300))).build());
        jwt.sign(new ECDSASigner(clave)); String cuenta = jwt.serialize();
        try (var web = new ServidorWeb("127.0.0.1", 0,
                new CuentasSupabase(new CuentasSupabase.Configuracion(origen, "sb_publishable_test", "sb_secret_privado")))) {
            web.iniciar(); String base = "http://127.0.0.1:" + web.puerto();
            var config = pedir(base, "/api/cuentas/config", null, null, null);
            assertEquals(200, config.statusCode()); assertFalse(config.body().contains("sb_secret"));
            var html = pedir(base, "/", null, null, null);
            assertTrue(html.headers().firstValue("Content-Security-Policy").orElseThrow().contains("connect-src 'self' " + origen));
            var acceso = pedir(base, "/api/salas", "{\"nombre\":\"Ana\"}", null, cuenta);
            assertEquals(201, acceso.statusCode());
            var datos = JsonParser.parseString(acceso.body()).getAsJsonObject();
            String codigo = datos.get("codigo").getAsString(), token = datos.get("playerToken").getAsString();
            assertEquals("VINCULADA", datos.getAsJsonObject("sala").getAsJsonObject("progreso").get("estado").getAsString());
            assertFalse(acceso.body().contains(usuario.toString())); assertFalse(acceso.body().contains(cuenta));
            assertEquals(409, pedir(base, "/api/salas/" + codigo + "/unirse", "{\"nombre\":\"Otra\"}", null, cuenta).statusCode());
            assertEquals(401, pedir(base, "/api/salas/" + codigo + "/estado", null, cuenta, null).statusCode());
            assertEquals(401, pedir(base, "/api/perfil", null, token, null).statusCode());
            var perfil = pedir(base, "/api/perfil", null, cuenta, null);
            assertEquals(200, perfil.statusCode()); assertTrue(perfil.body().contains("\"nivel\":2"));
            assertEquals(400, pedir(base, "/api/perfil", "{\"nombre\":\"Ataque\",\"xp\":999}", cuenta, null).statusCode());
            assertEquals(400, pedir(base, "/api/salas", "{\"nombre\":\"Ataque\",\"user_id\":\"" + usuario + "\"}", null, null).statusCode());
            assertEquals(404, pedir(base, "/api/recompensas", "{}", cuenta, null).statusCode());
            assertEquals(401, pedir(base, "/api/salas", "{\"nombre\":\"Fake\"}", null, "fake").statusCode());
            assertEquals(200, pedir(base, "/api/salas/" + codigo + "/estado", null, token, "fake").statusCode());
            // Dos consultas lentas de perfil no deben ocupar los cuatro trabajadores del juego.
            var esperando = new java.util.concurrent.CountDownLatch(2);
            var liberar = new java.util.concurrent.CountDownLatch(1);
            supabase.removeContext("/rest/v1/profiles");
            supabase.createContext("/rest/v1/profiles", x -> {
                esperando.countDown();
                try { liberar.await(5, java.util.concurrent.TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                byte[] b = "[{\"display_name\":\"Ana\",\"xp\":500,\"games_finished\":4,\"wins\":2}]".getBytes(StandardCharsets.UTF_8);
                x.sendResponseHeaders(200, b.length); x.getResponseBody().write(b); x.close();
            });
            var solicitudes = java.util.concurrent.Executors.newFixedThreadPool(2);
            try {
                var a = solicitudes.submit(() -> pedir(base, "/api/perfil", null, cuenta, null));
                var b = solicitudes.submit(() -> pedir(base, "/api/perfil", null, cuenta, null));
                assertTrue(esperando.await(3, java.util.concurrent.TimeUnit.SECONDS));
                assertEquals(503, pedir(base, "/api/perfil", null, cuenta, null).statusCode());
                assertEquals(200, pedir(base, "/api/salas/" + codigo + "/estado", null, token, null).statusCode());
                liberar.countDown();
                assertEquals(200, a.get(3, java.util.concurrent.TimeUnit.SECONDS).statusCode());
                assertEquals(200, b.get(3, java.util.concurrent.TimeUnit.SECONDS).statusCode());
            } finally { liberar.countDown(); solicitudes.shutdownNow(); }
        } finally { supabase.stop(0); remotos.shutdownNow(); }
    }

    @Test void sinConfiguracionInvitadosFuncionanYCuentaNoSeAceptaSilenciosamente() throws Exception {
        try (var web = new ServidorWeb("127.0.0.1", 0, new CuentasSupabase(null))) {
            web.iniciar(); String base = "http://127.0.0.1:" + web.puerto();
            var config = JsonParser.parseString(pedir(base, "/api/cuentas/config", null, null, null).body()).getAsJsonObject();
            assertFalse(config.get("habilitado").getAsBoolean());
            assertEquals(201, pedir(base, "/api/salas", "{\"nombre\":\"Guest\"}", null, null).statusCode());
            assertEquals(503, pedir(base, "/api/salas", "{\"nombre\":\"Cuenta\"}", null, "fake").statusCode());
        }
    }
}
