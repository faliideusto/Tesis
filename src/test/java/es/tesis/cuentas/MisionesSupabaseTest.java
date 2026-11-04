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
    static final String ESPECIALES = ACTUAL.replace("\"reinicioTemporada\"", """
        "especiales":[{"id":"especial:cumlaude","titulo":"Cum Laude","descripcion":"Gana una partida con 20 o más puntos de prestigio.","objetivo":1,"progreso":1,"xp":0,"puntosPase":0,"completada":true,"reclamada":false,"recompensa":{"id":"especial_cum_laude","tipo":"marco","nombre":"Cum Laude","asset":"/assets/seasons/misiones-especiales/marcos/marco-cum-laude.png","assets":null,"rareza":"legendario"}},{"id":"especial:paliza5","titulo":"Victoria aplastante","descripcion":"Gana sacando 5.","objetivo":1,"progreso":0,"xp":500,"puntosPase":500,"completada":false,"reclamada":false,"recompensa":null}],"reinicioTemporada\"""".strip());
    @Test void proyectaMisionesEspecialesConMarcoYReclamaPorId() {
        respuesta.set(ESPECIALES);
        var misiones=cuentas.misiones(jwt);
        assertEquals(2,misiones.especiales().size());
        var cum=misiones.especiales().get(0); var paliza=misiones.especiales().get(1);
        assertEquals("marco",cum.recompensa().tipo());assertEquals("especial_cum_laude",cum.recompensa().id());assertEquals(0,cum.xp());
        assertNull(paliza.recompensa());assertEquals(500,paliza.xp());
        cuentas.reclamarMision(jwt,"especial:cumlaude");assertEquals("{\"p_id\":\"especial:cumlaude\"}",cuerpo.get());
        assertEquals(400,assertThrows(ExcepcionCuenta.class,()->cuentas.reclamarMision(jwt,"especial:Cum Laude")).estado());
        respuesta.set(ESPECIALES.replace("/assets/seasons/misiones-especiales/marcos/marco-cum-laude.png","https://evil.test/m.png"));
        assertEquals(503,assertThrows(ExcepcionCuenta.class,()->cuentas.misiones(jwt)).estado());
    }
    @Test void despliegueAntiguoNoInventaMisionesMensuales() {
        respuesta.set(BASE);var m=cuentas.misiones(jwt);
        assertTrue(m.temporada().isEmpty());assertNull(m.reinicioTemporada());assertTrue(m.especiales().isEmpty());
    }
    @Test void rechazaCantidadIncoherenteYFechaInvalida() {
        respuesta.set(ACTUAL.replace("\"puntosPase\":1000","\"puntosPase\":999"));
        assertEquals(503,assertThrows(ExcepcionCuenta.class,()->cuentas.misiones(jwt)).estado());
        respuesta.set(ACTUAL.replace("2026-12-31T23:00:00Z","mañana"));
        assertEquals(503,assertThrows(ExcepcionCuenta.class,()->cuentas.misiones(jwt)).estado());
    }
}
