package es.tesis.cuentas;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class MisionesSupabaseTest {
    HttpServer remoto;
    CuentasSupabase cuentas;
    String jwt;
    AtomicReference<String> respuesta = new AtomicReference<>(), cuerpo = new AtomicReference<>();
    static final String BASE = """
        {"diarias":[],"semanales":[],"reinicioDiario":"2026-10-08T00:00:00Z","reinicioSemanal":"2026-10-12T00:00:00Z"}
        """;
    static final String ACTUAL = """
        {"diarias":[],"semanales":[],"temporada":[{"id":"temporada:jugar10:2026-10","titulo":"Diez partidas","descripcion":"Completa diez partidas.","objetivo":10,"progreso":10,"xp":1000,"puntosPase":1000,"completada":true,"reclamada":true}],"reinicioDiario":"2026-10-08T00:00:00Z","reinicioSemanal":"2026-10-12T00:00:00Z","reinicioTemporada":"2026-12-31T23:00:00Z"}
        """;
    @BeforeEach void iniciar() throws Exception {
        var clave = new ECKeyGenerator(Curve.P_256).keyID("test").generate();
        remoto=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        String origen="http://127.0.0.1:"+remoto.getAddress().getPort();
        remoto.createContext("/auth/v1/.well-known/jwks.json",x->{
            byte[] b=new JWKSet(clave.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();
        });
        remoto.createContext("/rest/v1/rpc/",x->{
            assertEquals("Bearer "+jwt,x.getRequestHeaders().getFirst("Authorization"));
            assertEquals("sb_publishable_test",x.getRequestHeaders().getFirst("apikey"));
            cuerpo.set(new String(x.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            byte[] b=respuesta.get().getBytes(StandardCharsets.UTF_8);
            x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();
        });
        remoto.start();
        var token=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("test").build(),
            new JWTClaimsSet.Builder().issuer(origen+"/auth/v1").audience("authenticated").subject(UUID.randomUUID().toString())
                .claim("role","authenticated").expirationTime(Date.from(Instant.now().plusSeconds(300))).build());
        token.sign(new ECDSASigner(clave));jwt=token.serialize();
        cuentas=new CuentasSupabase(new CuentasSupabase.Configuracion(origen,"sb_publishable_test","sb_secret_test"));
    }
    @AfterEach void cerrar() { if(cuentas!=null)cuentas.close(); if(remoto!=null)remoto.stop(0); }
    @Test void proyectaTemporadaYReclamaSoloIdSinCantidadDelCliente() {
        respuesta.set(ACTUAL);
        var misiones=cuentas.misiones(jwt);
        assertEquals("2026-12-31T23:00:00Z",misiones.reinicioTemporada());
        var m=misiones.temporada().get(0);
        assertEquals(1000,m.puntosPase());assertEquals("Completa diez partidas.",m.descripcion());assertTrue(m.reclamada());
        cuentas.reclamarMision(jwt,m.id());assertEquals("{\"p_id\":\"temporada:jugar10:2026-10\"}",cuerpo.get());
        assertEquals(400,assertThrows(ExcepcionCuenta.class,()->cuentas.reclamarMision(jwt,"temporada:jugar10:2026-13")).estado());
    }
    @Test void despliegueAntiguoNoInventaMisionesMensuales() {
        respuesta.set(BASE);var m=cuentas.misiones(jwt);
        assertTrue(m.temporada().isEmpty());assertNull(m.reinicioTemporada());
    }
    @Test void rechazaCantidadIncoherenteYFechaInvalida() {
        respuesta.set(ACTUAL.replace("\"puntosPase\":1000","\"puntosPase\":999"));
        assertEquals(503,assertThrows(ExcepcionCuenta.class,()->cuentas.misiones(jwt)).estado());
        respuesta.set(ACTUAL.replace("2026-12-31T23:00:00Z","mañana"));
        assertEquals(503,assertThrows(ExcepcionCuenta.class,()->cuentas.misiones(jwt)).estado());
    }
}
