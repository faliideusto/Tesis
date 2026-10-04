package es.tesis.cuentas;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.*;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.CountDownLatch;
import static org.junit.jupiter.api.Assertions.*;

class CuentasSupabaseTest {
    HttpServer servidor;
    CuentasSupabase cuentas;
    ECKey clave;
    String origen;
    Instant ahora = Instant.parse("2026-10-05T12:00:00Z");
    UUID usuario = UUID.randomUUID();
    AtomicInteger consultas = new AtomicInteger();
    AtomicReference<String> ultimaClave = new AtomicReference<>(), ultimaAuth = new AtomicReference<>(), ultimoCuerpo = new AtomicReference<>();
    AtomicReference<String> perfil = new AtomicReference<>("[{\"display_name\":\"Ada\",\"xp\":650,\"games_finished\":5,\"wins\":3}]");
    AtomicInteger estadoRest = new AtomicInteger(200);

    @BeforeEach void iniciar() throws Exception {
        clave = new ECKeyGenerator(Curve.P_256).keyID("prueba").generate();
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        origen = "http://127.0.0.1:" + servidor.getAddress().getPort();
        servidor.createContext("/auth/v1/.well-known/jwks.json", e -> {
            consultas.incrementAndGet();
            byte[] b = new JWKSet(clave.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            e.sendResponseHeaders(200, b.length); e.getResponseBody().write(b); e.close();
        });
        servidor.createContext("/rest/v1/", e -> {
            ultimaClave.set(e.getRequestHeaders().getFirst("apikey"));
            ultimaAuth.set(e.getRequestHeaders().getFirst("Authorization"));
            ultimoCuerpo.set(new String(e.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] b = (e.getRequestURI().getPath().contains("rpc") ? "[]" : perfil.get()).getBytes(StandardCharsets.UTF_8);
            e.sendResponseHeaders(estadoRest.get(), b.length); e.getResponseBody().write(b); e.close();
        });
        servidor.start();
        cuentas = new CuentasSupabase(new CuentasSupabase.Configuracion(origen, "sb_publishable_prueba", "sb_secret_prueba"),
                HttpClient.newHttpClient(), Clock.fixed(ahora, ZoneOffset.UTC));
    }
    @AfterEach void parar() { if (servidor != null) servidor.stop(0); }

    String token(String issuer, String aud, Instant caduca, Instant desde, String sub) throws Exception {
        var c = new JWTClaimsSet.Builder().issuer(issuer).audience(aud).subject(sub)
                .claim("role", "authenticated").expirationTime(Date.from(caduca));
        if (desde != null) c.notBeforeTime(Date.from(desde));
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("prueba").build(), c.build());
        jwt.sign(new ECDSASigner(clave));
        return jwt.serialize();
    }
    String valido() throws Exception { return token(origen + "/auth/v1", "authenticated", ahora.plusSeconds(300), null, usuario.toString()); }
    void rechazado(String jwt) { assertEquals(401, assertThrows(ExcepcionCuenta.class, () -> cuentas.autenticar(jwt)).estado()); }

    @Test void validaFirmaClaimsYCache() throws Exception {
        String jwt = valido();
        assertEquals(usuario, cuentas.autenticar(jwt));
        assertEquals(usuario, cuentas.autenticar(jwt));
        assertEquals(1, consultas.get());
        rechazado(token("https://otro/auth/v1", "authenticated", ahora.plusSeconds(30), null, usuario.toString()));
        rechazado(token(origen + "/auth/v1", "anon", ahora.plusSeconds(30), null, usuario.toString()));
        rechazado(token(origen + "/auth/v1", "authenticated", ahora.minusSeconds(1), null, usuario.toString()));
        rechazado(token(origen + "/auth/v1", "authenticated", ahora.plusSeconds(30), ahora.plusSeconds(1), usuario.toString()));
        rechazado(token(origen + "/auth/v1", "authenticated", ahora.plusSeconds(30), null, "no-uuid"));
        String[] partes = jwt.split("\\.");
        rechazado(partes[0] + "." + partes[1] + "." + (partes[2].startsWith("A") ? "B" : "A") + partes[2].substring(1));
    }

    @Test void algoritmoNingunoYClavesDesconocidasNoProvocanPeticionIlimitada() throws Exception {
        rechazado(new PlainJWT(new JWTClaimsSet.Builder().subject(usuario.toString()).build()).serialize());
        cuentas.autenticar(valido());
        for (int i = 0; i < 20; i++) {
            SignedJWT desconocido = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("otro" + i).build(),
                    new JWTClaimsSet.Builder().subject(usuario.toString()).build());
            desconocido.sign(new ECDSASigner(clave));
            rechazado(desconocido.serialize());
        }
        assertEquals(1, consultas.get());
    }

    @Test void perfilSoloUsaClavePublicaYRenombrarSoloEscribeNombre() throws Exception {
        String jwt = valido();
        var p = cuentas.perfil(jwt);
        assertEquals(new CuentasSupabase.Perfil("Ada", 650, 2, 5, 3), p);
        assertEquals("sb_publishable_prueba", ultimaClave.get());
        assertEquals("Bearer " + jwt, ultimaAuth.get());
        cuentas.renombrar(jwt, " Berta ");
        assertEquals("{\"display_name\":\"Berta\"}", ultimoCuerpo.get());
        assertEquals(400, assertThrows(ExcepcionCuenta.class, () -> cuentas.renombrar(jwt, "\n")).estado());
    }

    @Test void registrarResultadoUsaSecretoSoloComoApiKeyYUnIdEstable() {
        UUID partida = UUID.randomUUID();
        cuentas.registrarResultado(partida, "a".repeat(64), ahora,
                List.of(new CuentasSupabase.Participante(0, usuario, "Ada", 5, true)));
        assertEquals("sb_secret_prueba", ultimaClave.get());
        assertNull(ultimaAuth.get());
        assertTrue(ultimoCuerpo.get().contains(partida.toString()));
        assertTrue(ultimoCuerpo.get().contains("\"p_version\":1"));
        assertFalse(ultimoCuerpo.get().contains("xp"));
    }

    @Test void configuracionNoExponeSecretosYFallaSiParcialOOrigenInseguro() {
        assertFalse(CuentasSupabase.desdeVariables(Map.of()).habilitado());
        assertThrows(IllegalStateException.class, () -> CuentasSupabase.desdeVariables(Map.of("SUPABASE_URL", "https://ejemplo.supabase.co")));
        assertThrows(IllegalArgumentException.class, () -> CuentasSupabase.desdeVariables(Map.of(
                "SUPABASE_URL", origen, "SUPABASE_PUBLISHABLE_KEY", "public", "SUPABASE_SECRET_KEY", "private")));
        assertThrows(IllegalArgumentException.class, () -> new CuentasSupabase(new CuentasSupabase.Configuracion("https://host/ruta", "public", "private")));
        assertFalse(new CuentasSupabase.Configuracion("https://host", "public", "private").toString().contains("private"));
    }

    @Test void falloJwksEs503SinTokenEnError() throws Exception {
        servidor.stop(0);
        var e = assertThrows(ExcepcionCuenta.class, () -> cuentas.autenticar(valido()));
        assertEquals(503, e.estado());
        assertFalse(e.getMessage().contains("prueba"));
    }

    @Test void rsa256TambienSeVerificaContraJwks() throws Exception {
        RSAKey rsa = new RSAKeyGenerator(2048).keyID("rsa").generate();
        servidor.removeContext("/auth/v1/.well-known/jwks.json");
        servidor.createContext("/auth/v1/.well-known/jwks.json", e -> {
            byte[] b = new JWKSet(rsa.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            e.sendResponseHeaders(200, b.length); e.getResponseBody().write(b); e.close();
        });
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("rsa").build(),
                new JWTClaimsSet.Builder().issuer(origen + "/auth/v1").audience("authenticated")
                        .subject(usuario.toString()).claim("role", "authenticated").expirationTime(Date.from(ahora.plusSeconds(60))).build());
        jwt.sign(new RSASSASigner(rsa));
        assertEquals(usuario, cuentas.autenticar(jwt.serialize()));
    }

    @Test void erroresPrivilegiadosPermanentesYTemporalesSeDistinguenSinCuerpoRemoto() {
        estadoRest.set(400);
        perfil.set("sb_secret_prueba token privado");
        var error = assertThrows(ExcepcionCuenta.class, () -> cuentas.registrarResultado(UUID.randomUUID(), "a".repeat(64), ahora, List.of()));
        assertEquals(400, error.estado());
        assertFalse(error.getMessage().contains("sb_secret"));
        estadoRest.set(429);
        assertEquals(503, assertThrows(ExcepcionCuenta.class, () -> cuentas.registrarResultado(UUID.randomUUID(), "a".repeat(64), ahora, List.of())).estado());
    }

    @Test void cuerpoRemotoColgadoTieneUnLimiteDeTiempo() throws Exception {
        CountDownLatch liberar = new CountDownLatch(1);
        servidor.removeContext("/rest/v1/");
        servidor.createContext("/rest/v1/", e -> {
            e.sendResponseHeaders(200, 1);
            e.getResponseBody().flush();
            try { liberar.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            e.close();
        });
        long inicio = System.nanoTime();
        try {
            assertEquals(503, assertThrows(ExcepcionCuenta.class, () -> cuentas.registrarResultado(UUID.randomUUID(), "a".repeat(64), ahora, List.of())).estado());
            assertTrue(Duration.ofNanos(System.nanoTime() - inicio).toSeconds() <= 12);
        } finally { liberar.countDown(); }
    }

    @Test void cuerpoRemotoExcesivoSeRechazaSinMostrarSuContenido() throws Exception {
        perfil.set("dato-privado".repeat(7000));
        var error = assertThrows(ExcepcionCuenta.class, () -> cuentas.perfil(valido()));
        assertEquals(503, error.estado());
        assertFalse(error.getMessage().contains("dato-privado"));
    }
}
