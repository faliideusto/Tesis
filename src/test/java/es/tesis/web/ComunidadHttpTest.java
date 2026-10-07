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
        final ECKey signingKey;
        final String issuer;
        final List<String> peticiones = new CopyOnWriteArrayList<>();
        volatile String respuesta = COMUNIDAD;
        volatile int estado = 200;
        Entorno() throws Exception {
            var clave = new ECKeyGenerator(Curve.P_256).keyID("test").generate();
            signingKey = clave;
            remoto = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            String origen = "http://127.0.0.1:" + remoto.getAddress().getPort();
            issuer = origen + "/auth/v1";
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
                if (x.getRequestURI().getPath().endsWith("/resolver_amigo_en_linea"))
                    identidad = "sb_secret_privado".equals(x.getRequestHeaders().getFirst("apikey")) && "POST".equals(x.getRequestMethod());
                byte[] b = (identidad ? respuesta : "{}").getBytes(StandardCharsets.UTF_8);
                x.sendResponseHeaders(identidad ? estado : 403, b.length); x.getResponseBody().write(b); x.close();
            });
            remoto.createContext("/rest/v1/profiles", x -> {
                byte[] b = "[{\"display_name\":\"Lin\",\"xp\":0,\"games_finished\":0,\"wins\":0}]".getBytes(StandardCharsets.UTF_8);
                x.sendResponseHeaders(200,b.length);x.getResponseBody().write(b);x.close();
            });
            remoto.start();
            web = new ServidorWeb("127.0.0.1", 0, new CuentasSupabase(new CuentasSupabase.Configuracion(origen, "sb_publishable_test", "sb_secret_privado")));
            web.iniciar(); base = "http://127.0.0.1:" + web.puerto();
        }
        HttpResponse<String> pedir(String ruta, String metodo, String cuerpo, String token) throws Exception {
            return pedir(ruta,metodo,cuerpo,token,null);
        }
        HttpResponse<String> pedir(String ruta, String metodo, String cuerpo, String token, String cuentaToken) throws Exception {
            var b = HttpRequest.newBuilder(URI.create(base + ruta));
            if (token != null) b.header("Authorization", "Bearer " + token);
            if (cuentaToken != null) b.header("X-Tesis-Account-Authorization","Bearer " + cuentaToken);
            if (cuerpo != null) b.header("Content-Type", "application/json");
            if (metodo.equals("POST")) b.header("X-Tesis", "1");
            b.method(metodo, cuerpo == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(cuerpo));
            return HttpClient.newHttpClient().send(b.build(), HttpResponse.BodyHandlers.ofString());
        }
        String tokenPara(UUID actor) throws Exception {
            var token = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("test").build(),
                    new JWTClaimsSet.Builder().issuer(issuer).audience("authenticated").subject(actor.toString())
                            .claim("role","authenticated").expirationTime(Date.from(Instant.now().plusSeconds(300))).build());
            token.sign(new ECDSASigner(signingKey));return token.serialize();
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

    @Test void presenciaExigeCuentaYBodyVacioYComunidadProyectaSoloAmigosEnLinea() throws Exception {
        try (var e = new Entorno()) {
            assertEquals(401, e.pedir("/api/presencia", "POST", "{}", null).statusCode());
            assertEquals(401, e.pedir("/api/presencia", "POST", "{}", "token-sala").statusCode());
            assertEquals(405, e.pedir("/api/presencia", "GET", null, e.jwt).statusCode());
            for (String cuerpo : List.of("{\"actor\":\"otra-cuenta\"}", "{\"activa\":false}", "[]", "null"))
                assertEquals(400, e.pedir("/api/presencia", "POST", cuerpo, e.jwt).statusCode());
            assertEquals(400, e.pedir("/api/presencia?actor=otro", "POST", "{}", e.jwt).statusCode());
            assertTrue(e.peticiones.isEmpty());
            e.respuesta = "{\"activa\":true,\"user_id\":\"secreto\",\"last_seen_at\":\"privado\"}";
            var respuesta = e.pedir("/api/presencia", "POST", "{}", e.jwt);
            assertEquals(200, respuesta.statusCode());
            assertEquals("{\"activa\":true}", respuesta.body());
            assertEquals("/rest/v1/rpc/presencia {}", e.peticiones.get(0));
            e.respuesta = COMUNIDAD.strip().replace("\"nivel\":2", "\"nivel\":2,\"enLinea\":true")
                    .replace("\"recibidas\":[]", "\"recibidas\":[{\"codigo\":\"1111111111111111\",\"nombre\":\"Sol\",\"nivel\":3,\"enLinea\":true}]")
                    .replace("\"email\":\"privado\"", "\"presenciaDisponible\":true,\"sugerencias\":[{\"codigo\":\"2222222222222222\",\"nombre\":\"Lin\",\"nivel\":4,\"enLinea\":true,\"email\":\"secreto\"}]");
            var comunidad = e.pedir("/api/comunidad", "GET", null, e.jwt);
            assertEquals(200, comunidad.statusCode());
            var dato = JsonParser.parseString(comunidad.body()).getAsJsonObject();
            assertTrue(dato.get("presenciaDisponible").getAsBoolean());
            assertTrue(dato.getAsJsonArray("amigos").get(0).getAsJsonObject().get("enLinea").getAsBoolean());
            assertFalse(dato.getAsJsonArray("recibidas").get(0).getAsJsonObject().get("enLinea").getAsBoolean());
            assertFalse(dato.getAsJsonArray("sugerencias").get(0).getAsJsonObject().get("enLinea").getAsBoolean());
            assertFalse(comunidad.body().contains("secreto"));
            e.respuesta = COMUNIDAD;
            dato = JsonParser.parseString(e.pedir("/api/comunidad", "GET", null, e.jwt).body()).getAsJsonObject();
            assertFalse(dato.get("presenciaDisponible").getAsBoolean());
            assertEquals(0, dato.getAsJsonArray("sugerencias").size());
            e.respuesta = "{\"activa\":false}";
            assertEquals(503, e.pedir("/api/presencia", "POST", "{}", e.jwt).statusCode());
            e.respuesta = "{\"activa\":\"true\"}";
            assertEquals(503, e.pedir("/api/presencia", "POST", "{}", e.jwt).statusCode());
        }
    }

    @Test void perfilPublicoAutenticadoValidaConsultaProyectaYTraduceNoEncontrado() throws Exception {
        try (var e = new Entorno()) {
            String ruta = "/api/perfil-publico?codigo=" + CODIGO;
            assertEquals(401, e.pedir(ruta, "GET", null, null).statusCode());
            assertEquals(401, e.pedir(ruta, "GET", null, "token-sala").statusCode());
            assertEquals(405, e.pedir(ruta, "POST", "{}", e.jwt).statusCode());
            for (String consulta : List.of("", "?codigo=ABC", "?codigo=" + CODIGO + "&actor=otro",
                    "?codigo=" + CODIGO + "&codigo=" + CODIGO, "?codigo=%41BCDEF0123456789", "?user_id=otro"))
                assertEquals(400, e.pedir("/api/perfil-publico" + consulta, "GET", null, e.jwt).statusCode());
            assertTrue(e.peticiones.isEmpty());
            String perfil = "{\"codigo\":\"" + CODIGO + "\",\"nombre\":\"Ana\",\"xp\":1000,\"nivel\":3,\"partidasTerminadas\":8,\"victorias\":2,\"enLinea\":true,\"presenciaDisponible\":true,\"email\":\"secreto\",\"user_id\":\"privado\"}";
            e.respuesta = perfil;
            var respuesta = e.pedir("/api/perfil-publico?codigo=" + CODIGO.toLowerCase(Locale.ROOT), "GET", null, e.jwt);
            assertEquals(200, respuesta.statusCode());
            assertFalse(respuesta.body().contains("secreto")); assertFalse(respuesta.body().contains("user_id"));
            var dto = JsonParser.parseString(respuesta.body()).getAsJsonObject();
            assertEquals(8, dto.size()); assertEquals(3, dto.get("nivel").getAsInt());
            assertTrue(dto.get("enLinea").getAsBoolean());
            assertEquals("/rest/v1/rpc/perfil_publico {\"p_codigo\":\"" + CODIGO + "\"}", e.peticiones.get(0));
            for (String invalido : List.of(perfil.replace("\"nivel\":3", "\"nivel\":4"),
                    perfil.replace("\"presenciaDisponible\":true", "\"presenciaDisponible\":false"),
                    perfil.replace("\"victorias\":2", "\"victorias\":9"),
                    perfil.replace(CODIGO, "0000000000000000"))) {
                e.respuesta = invalido;
                assertEquals(503, e.pedir(ruta, "GET", null, e.jwt).statusCode());
            }
            e.estado = 400; e.respuesta = "{\"code\":\"P0002\",\"message\":\"Perfil público no encontrado\",\"details\":\"secreto\"}";
            respuesta = e.pedir(ruta, "GET", null, e.jwt);
            assertEquals(404, respuesta.statusCode()); assertFalse(respuesta.body().contains("secreto"));
            e.estado = 404;
            assertEquals(404, e.pedir(ruta, "GET", null, e.jwt).statusCode());
            e.respuesta = "{\"code\":\"P0002\",\"message\":\"secreto\"}";
            assertEquals(503, e.pedir(ruta, "GET", null, e.jwt).statusCode());
        }
    }

    @Test void invitacionHttpRequiereAmbasIdentidadesPrivadasYSoloDestinatarioPuedeConsumir() throws Exception {
        try (var e=new Entorno()) {
            UUID amigo=UUID.randomUUID();String amigoJwt=e.tokenPara(amigo);
            var creado=e.pedir("/api/salas","POST","{\"nombre\":\"Ada\"}",null,e.jwt);
            assertEquals(201,creado.statusCode());
            var acceso=JsonParser.parseString(creado.body()).getAsJsonObject();
            String room=acceso.get("codigo").getAsString(),token=acceso.get("playerToken").getAsString();
            String ruta="/api/salas/"+room+"/invitar",cuerpo="{\"codigo\":\""+CODIGO+"\"}";
            assertEquals(401,e.pedir(ruta,"POST",cuerpo,token).statusCode());
            assertEquals(403,e.pedir(ruta,"POST",cuerpo,token,amigoJwt).statusCode());
            assertEquals(401,e.pedir(ruta,"POST",cuerpo,"otro-token",e.jwt).statusCode());
            assertEquals(400,e.pedir(ruta,"POST","{\"codigo\":\""+CODIGO+"\",\"actor\":\"otro\"}",token,e.jwt).statusCode());
            assertTrue(e.peticiones.isEmpty());
            e.respuesta="{\"destino\":null}";
            assertEquals(400,e.pedir(ruta,"POST",cuerpo,token,e.jwt).statusCode());
            e.respuesta="{\"destino\":\""+amigo+"\"}";
            var envio=e.pedir(ruta,"POST",cuerpo,token,e.jwt);assertEquals(200,envio.statusCode());
            String id=JsonParser.parseString(envio.body()).getAsJsonObject().get("id").getAsString();
            assertFalse(envio.body().contains(amigo.toString()));assertFalse(envio.body().contains(token));
            assertEquals(200,e.pedir(ruta,"POST",cuerpo,token,e.jwt).statusCode());
            var bandeja=e.pedir("/api/invitaciones","GET",null,amigoJwt);assertEquals(200,bandeja.statusCode());
            assertTrue(bandeja.body().contains(id));assertTrue(bandeja.body().contains("Ada"));
            assertFalse(bandeja.body().contains("playerToken"));assertFalse(bandeja.body().contains(amigo.toString()));
            assertFalse(e.pedir("/api/invitaciones","GET",null,e.jwt).body().contains(id));
            assertEquals(401,e.pedir("/api/invitaciones","GET",null,null).statusCode());
            assertEquals(400,e.pedir("/api/invitaciones?actor=otro","GET",null,amigoJwt).statusCode());
            String aceptar="/api/invitaciones/"+id+"/aceptar";
            assertEquals(404,e.pedir(aceptar,"POST","{}",e.jwt).statusCode());
            assertEquals(400,e.pedir(aceptar,"POST","{\"nombre\":\"falso\"}",amigoJwt).statusCode());
            var unido=e.pedir(aceptar,"POST","{}",amigoJwt);assertEquals(200,unido.statusCode());
            assertTrue(unido.body().contains("Lin"));assertTrue(unido.body().contains("playerToken"));
            assertEquals(404,e.pedir(aceptar,"POST","{}",amigoJwt).statusCode());
            assertFalse(e.pedir("/api/invitaciones","GET",null,amigoJwt).body().contains(id));
            assertTrue(e.peticiones.stream().allMatch(p->p.contains("resolver_amigo_en_linea")));
        }
    }

    @Test void rankingAmbitosValidanConsultaPeriodoProyeccionYRespuestaCoincidente() throws Exception {
        try (var e = new Entorno()) {
            for (String consulta : List.of("ambito=inventado", "ambito=global&ambito=amigos", "criterio=xp&ambito=global&criterio=partidas",
                    "criterio=xp&extra=otro", "ambito=%67lobal", "ambito=", "criterio=xp&"))
                assertEquals(400,e.pedir("/api/ranking?"+consulta,"GET",null,e.jwt).statusCode(),consulta);
            assertEquals(401,e.pedir("/api/ranking?ambito=amigos","GET",null,null).statusCode());
            assertTrue(e.peticiones.isEmpty());
            String entrada="{\"posicion\":1,\"codigo\":\""+CODIGO+"\",\"nombre\":\"Ana\",\"nivel\":201,\"xp\":225,\"victorias\":1,\"partidas\":1,\"yo\":true,\"email\":\"secreto\"}";
            String periodo="{\"id\":\"semanal:2026-10-05\",\"inicio\":\"2026-10-04T22:00:00+00:00\",\"fin\":\"2026-10-11T22:00:00+00:00\",\"zonaHoraria\":\"Europe/Madrid\"}";
            String semanal="{\"criterio\":\"xp\",\"ambito\":\"semanal\",\"periodo\":"+periodo+",\"entradas\":["+entrada+"],\"propia\":"+entrada+"}";
            e.respuesta=semanal;
            var respuesta=e.pedir("/api/ranking?ambito=semanal&criterio=xp","GET",null,e.jwt);
            assertEquals(200,respuesta.statusCode()); assertFalse(respuesta.body().contains("secreto"));
            assertTrue(respuesta.body().contains("Europe/Madrid"));assertTrue(respuesta.body().contains("\"nivel\":201"));
            assertEquals("/rest/v1/rpc/ranking_periodo {\"p_criterio\":\"xp\",\"p_ambito\":\"semanal\"}",e.peticiones.get(0));
            for (String invalido : List.of(semanal.replace("Europe/Madrid","UTC"),semanal.replace("semanal:2026-10-05","temporada:2026-10"),
                    semanal.replace("2026-10-11T22:00:00+00:00","2026-10-04T22:00:00+00:00"),
                    semanal.replace("\"ambito\":\"semanal\"","\"ambito\":\"amigos\""))) {
                e.respuesta=invalido;assertEquals(503,e.pedir("/api/ranking?ambito=semanal","GET",null,e.jwt).statusCode());
            }
            e.respuesta=semanal.replace("\"ambito\":\"semanal\"","\"ambito\":\"amigos\"").replace(periodo,"null");
            assertEquals(200,e.pedir("/api/ranking?criterio=xp&ambito=amigos","GET",null,e.jwt).statusCode());
            e.respuesta=semanal.replace("\"ambito\":\"semanal\"","\"ambito\":\"global\"").replace(periodo,"null");
            assertEquals(200,e.pedir("/api/ranking?criterio=xp","GET",null,e.jwt).statusCode());
            assertEquals(200,e.pedir("/api/ranking","GET",null,e.jwt).statusCode());
            assertTrue(e.peticiones.get(e.peticiones.size()-1).contains("\"p_ambito\":\"global\""));
            e.respuesta=semanal.replace("\"ambito\":\"semanal\"","\"ambito\":\"temporada\"").replace("semanal:2026-10-05","temporada:2026-10")
                    .replace("2026-10-04T22:00:00+00:00","2026-09-30T22:00:00+00:00").replace("2026-10-11T22:00:00+00:00","2026-10-31T23:00:00+00:00");
            assertEquals(200,e.pedir("/api/ranking?ambito=temporada","GET",null,e.jwt).statusCode());
        }
    }
}
