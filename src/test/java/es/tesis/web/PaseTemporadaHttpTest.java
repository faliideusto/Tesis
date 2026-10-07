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

class PaseTemporadaHttpTest {
    private static final String PASE = """
      {"temporada":{"id":"temporada:2026-10","inicio":"2026-10-01T00:00:00+02:00","fin":"2026-11-01T00:00:00+01:00","zonaHoraria":"Europe/Madrid","activa":true,"nombre":"Crónicas del Archivo","gratuita":true},"progreso":{"puntos":500,"nivel":2,"puntosSiguienteNivel":1000,"maxNivel":10,"puntosPorNivel":500},"recompensas":[{"id":"premio_avatar","nombre":"Avatar del Archivo","nivel":2,"cosmeticos":[{"id":"academia_avatar","tipo":"avatar","nombre":"Avatar de academia","asset":"/assets/Tesis-assets/profile-v250/user-icon.svg","user_id":"privado","rareza":"comun"}],"reclamada":false,"desbloqueada":true}],"email":"privado"}
      """;
    private static final String COSMETICOS = """
      {"inventario":[{"id":"academia_avatar","tipo":"avatar","nombre":"Avatar de academia","asset":"/assets/Tesis-assets/profile-v250/user-icon.svg","rareza":"comun"}],"equipamiento":{"avatar":null,"marco":null,"titulo":null,"insignia":null,"reverso":null,"placa":null,"interaccion":null},"token":"privado"}
      """;
    private static final class Entorno implements AutoCloseable {
        final HttpServer remoto;
        final ServidorWeb web;
        final String jwt, base;
        final ECKey signingKey;
        final String issuer;
        final List<String> peticiones = new CopyOnWriteArrayList<>();
        volatile String respuesta = PASE;
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
                            .expirationTime(Date.from(Instant.parse("2027-01-01T00:00:00Z"))).build());
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
            web = new ServidorWeb("127.0.0.1", 0, new CuentasSupabase(new CuentasSupabase.Configuracion(origen, "sb_publishable_test", "sb_secret_privado"), HttpClient.newHttpClient(), java.time.Clock.fixed(Instant.parse("2026-10-07T12:00:00Z"),java.time.ZoneOffset.UTC)));
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
                            .claim("role","authenticated").expirationTime(Date.from(Instant.parse("2027-01-01T00:00:00Z"))).build());
            token.sign(new ECDSASigner(signingKey));return token.serialize();
        }
        public void close() { web.close(); remoto.stop(0); }
    }

    @Test void autenticaYProyectaSoloElPasePublicable() throws Exception {
        try(var e=new Entorno()) {
            assertEquals(401,e.pedir("/api/pase","GET",null,null).statusCode());
            assertEquals(401,e.pedir("/api/cosmeticos","GET",null,"token-sala").statusCode());assertTrue(e.peticiones.isEmpty());
            var pase=e.pedir("/api/pase","GET",null,e.jwt);assertEquals(200,pase.statusCode());assertFalse(pase.body().contains("privado"));assertFalse(pase.body().contains("user_id"));
            assertTrue(e.peticiones.get(0).contains("/pase_temporada"));assertTrue(e.peticiones.get(0).contains("\"p_temporada\":null"));
            assertEquals(200,e.pedir("/api/pase?temporada=temporada%3A2026-10","GET",null,e.jwt).statusCode());
            e.respuesta=COSMETICOS;var inventario=e.pedir("/api/cosmeticos","GET",null,e.jwt);assertEquals(200,inventario.statusCode());assertFalse(inventario.body().contains("privado"));assertTrue(inventario.body().contains("\"avatar\":null"));
        }
    }
    @Test void reclamaDosVecesYEquipaOQuitaSinActorDeCliente() throws Exception {
        try(var e=new Entorno()) {
            e.respuesta=PASE.replace("\"reclamada\":false","\"reclamada\":true");
            String claim="{\"temporada\":\"temporada:2026-10\",\"id\":\"premio_avatar\"}";
            var first=e.pedir("/api/pase/reclamar","POST",claim,e.jwt);var second=e.pedir("/api/pase/reclamar","POST",claim,e.jwt);assertEquals(200,first.statusCode());assertEquals(first.body(),second.body());
            assertTrue(e.peticiones.get(0).contains("/reclamar_recompensa_temporada"));assertFalse(e.peticiones.get(0).contains("p_actor"));
            e.respuesta=COSMETICOS.replace("\"avatar\":null","\"avatar\":\"academia_avatar\"");assertEquals(200,e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"avatar\",\"id\":\"academia_avatar\"}",e.jwt).statusCode());
            e.respuesta=COSMETICOS;assertEquals(200,e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"avatar\",\"id\":null}",e.jwt).statusCode());assertTrue(e.peticiones.get(3).contains("\"p_id\":null"));
        }
    }
    @Test void rechazaMetodosConsultasCamposYTiposAntesDeRpc() throws Exception {
        try(var e=new Entorno()) {
            assertEquals(405,e.pedir("/api/pase","POST","{}",e.jwt).statusCode());assertEquals(405,e.pedir("/api/pase/reclamar","GET",null,e.jwt).statusCode());
            for(String query:List.of("temporada=temporada:2026-13","temporada=temporada:0000-01","temporada=temporada:2026-10&actor=A","temporada=temporada:2026-10&temporada=temporada:2026-10","actor=A"))assertEquals(400,e.pedir("/api/pase?"+query,"GET",null,e.jwt).statusCode(),query);
            for(String body:List.of("{}","{\"temporada\":\"temporada:2026-10\",\"id\":5}","{\"temporada\":\"temporada:2026-10\",\"id\":\"premio_avatar\",\"actor\":\"otro\"}"))assertEquals(400,e.pedir("/api/pase/reclamar","POST",body,e.jwt).statusCode());
            for(String body:List.of("{\"tipo\":\"avatar\"}","{\"tipo\":\"desconocido\",\"id\":null}","{\"tipo\":\"avatar\",\"id\":false}","{\"tipo\":\"avatar\",\"id\":\"../secret\"}"))assertEquals(400,e.pedir("/api/cosmeticos/equipar","POST",body,e.jwt).statusCode());
            assertEquals(400,e.pedir("/api/cosmeticos?actor=A","GET",null,e.jwt).statusCode());assertTrue(e.peticiones.isEmpty());
            var request=HttpRequest.newBuilder(URI.create(e.base+"/api/pase/reclamar")).header("Authorization","Bearer "+e.jwt).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString("{}")).build();assertEquals(403,HttpClient.newHttpClient().send(request,HttpResponse.BodyHandlers.ofString()).statusCode());
        }
    }
    @Test void ocultaErroresRemotosYTraduceSoloNegocioConocido() throws Exception {
        try(var e=new Entorno()) {
            e.estado=400;
            for(String message:List.of("No posees este cosmético","El cosmético no corresponde a ese tipo","La recompensa todavía no está desbloqueada","La temporada todavía no ha comenzado")) {
                e.respuesta=new Gson().toJson(Map.of("code","22023","message",message,"details","privado"));var result=e.pedir("/api/cosmeticos","GET",null,e.jwt);assertEquals(400,result.statusCode());assertFalse(result.body().contains("privado"));
            }
            e.respuesta="{\"code\":\"22023\",\"message\":\"secreto remoto no reconocido\"}";var unknown=e.pedir("/api/pase","GET",null,e.jwt);assertEquals(503,unknown.statusCode());assertFalse(unknown.body().contains("secreto"));
        }
    }
    @Test void rechazaProgresoPeriodoYAssetsMalformadosSinFiltrarlos() throws Exception {
        try(var e=new Entorno()) {
            for(String bad:List.of(PASE.replace("\"puntosSiguienteNivel\":1000","\"puntosSiguienteNivel\":500"),PASE.replace("\"nivel\":2","\"nivel\":3"),PASE.replace("2026-11-01T00:00:00+01:00","2026-11-02T00:00:00+01:00"),PASE.replace("user-icon.svg","../secret.svg"),PASE.replace("/assets/Tesis-assets/profile-v250/user-icon.svg","https://evil.test/a.svg"),PASE.replace("\"desbloqueada\":true","\"desbloqueada\":false"))) {e.respuesta=bad;assertEquals(503,e.pedir("/api/pase","GET",null,e.jwt).statusCode());}
            e.respuesta=COSMETICOS.replace("\"avatar\":null","\"avatar\":\"not_owned\"");assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
            e.respuesta=COSMETICOS.replace("\"marco\":null","\"marco\":\"academia_avatar\"");assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
        }
    }
    @Test void canalHttpAutenticaAmbasIdentidadesYVerificaEquipamientoActualSinRevision() throws Exception {
        try(var e=new Entorno()) {
            JsonObject dato=JsonParser.parseString(COSMETICOS).getAsJsonObject();JsonObject libro=dato.getAsJsonArray("inventario").get(0).getAsJsonObject().deepCopy();
            libro.addProperty("id",InteraccionesTest.ID);libro.addProperty("tipo","interaccion");dato.getAsJsonArray("inventario").add(libro);dato.getAsJsonObject("equipamiento").addProperty("interaccion",InteraccionesTest.ID);e.respuesta=dato.toString();
            var acceso=JsonParser.parseString(e.pedir("/api/salas","POST","{\"nombre\":\"Ada\"}",null,e.jwt).body()).getAsJsonObject();
            String codigo=acceso.get("codigo").getAsString(),token=acceso.get("playerToken").getAsString();String ruta="/api/salas/"+codigo+"/interacciones";
            assertEquals(200,e.pedir("/api/salas/"+codigo+"/unirse","POST","{\"nombre\":\"Lin\"}",null).statusCode());
            assertEquals(200,e.pedir("/api/salas/"+codigo+"/unirse","POST","{\"nombre\":\"Sol\"}",null).statusCode());
            String body="{\"interactionId\":\"archivo_lanzamiento_libro\",\"objetivo\":\"Lin\"}";
            assertEquals(409,e.pedir(ruta,"POST",body,token,e.jwt).statusCode());
            var iniciado=e.pedir("/api/salas/"+codigo+"/iniciar","POST","{\"revision\":3}",token);assertEquals(200,iniciado.statusCode());
            assertEquals(401,e.pedir(ruta,"GET",null,null).statusCode());assertEquals(401,e.pedir(ruta,"GET",null,e.jwt).statusCode());
            var baseline=e.pedir(ruta,"GET",null,token);assertEquals(200,baseline.statusCode());assertTrue(baseline.body().contains("\"eventos\":[]"));
            assertEquals(401,e.pedir(ruta,"POST",body,token).statusCode());
            assertEquals(403,e.pedir(ruta,"POST",body,token,e.tokenPara(UUID.randomUUID())).statusCode());
            int previas=e.peticiones.size();assertEquals(400,e.pedir(ruta,"POST",body.replace("Lin","Ada"),token,e.jwt).statusCode());
            assertEquals(400,e.pedir(ruta,"POST",body.replace("archivo_lanzamiento_libro","id_arbitrario"),token,e.jwt).statusCode());assertEquals(previas,e.peticiones.size());
            for(String invalido:List.of(body.replace("}",",\"actor\":\"Sol\"}"),body.replace("}",",\"revision\":3}")))assertEquals(400,e.pedir(ruta,"POST",invalido,token,e.jwt).statusCode());
            e.respuesta=COSMETICOS;assertEquals(403,e.pedir(ruta,"POST",body,token,e.jwt).statusCode());
            e.respuesta=dato.toString();var envio=e.pedir(ruta,"POST",body,token,e.jwt);assertEquals(200,envio.statusCode());assertFalse(envio.body().contains(e.jwt));assertFalse(envio.body().contains("inventario"));
            assertEquals(429,e.pedir(ruta,"POST",body,token,e.jwt).statusCode());
            for(String consulta:List.of("?desde=-1","?desde=999","?desde=0&actor=A","?desde=%30","?desde=01","?otro=1"))assertEquals(400,e.pedir(ruta+consulta,"GET",null,token).statusCode());
            var eventos=e.pedir(ruta+"?desde=0","GET",null,token);assertEquals(200,eventos.statusCode());assertTrue(eventos.body().contains("\"emisor\":\"Ada\""));
            assertEquals(iniciado.body(),e.pedir("/api/salas/"+codigo+"/estado","GET",null,token).body());
            assertEquals(405,e.pedir(ruta,"PUT",null,token).statusCode());assertEquals(400,e.pedir(ruta+"?desde=0","POST",body,token,e.jwt).statusCode());
        }
    }
    @Test void admiteAssetsDefinitivosTitulosSinImagenYPiezasSeguras() throws Exception {
        try(var e=new Entorno()) {
            JsonObject dato=JsonParser.parseString(COSMETICOS).getAsJsonObject();JsonObject titulo=new JsonObject();
            titulo.addProperty("id","academia_titulo");titulo.addProperty("tipo","titulo");titulo.addProperty("nombre","Custodio de Manuscritos");titulo.add("asset",JsonNull.INSTANCE);titulo.addProperty("rareza","comun");dato.getAsJsonArray("inventario").add(titulo);
            JsonObject avatar=dato.getAsJsonArray("inventario").get(0).getAsJsonObject();avatar.addProperty("asset","/assets/seasons/cronicas-del-archivo/avatares/avatar-aprendiz-del-archivo.png");
            JsonObject interaccion=avatar.deepCopy();interaccion.addProperty("id","archivo_lanzamiento_libro");interaccion.addProperty("tipo","interaccion");
            JsonObject assets=new JsonObject();assets.addProperty("libro","/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png");assets.addProperty("hoja-01","/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-01.png");interaccion.add("assets",assets);dato.getAsJsonArray("inventario").add(interaccion);
            e.respuesta=dato.toString();var ok=e.pedir("/api/cosmeticos","GET",null,e.jwt);assertEquals(200,ok.statusCode());assertTrue(ok.body().contains("hoja-01"));assertTrue(ok.body().contains("\"asset\":null"));
            for(String malo:List.of("/assets/seasons/../private.png","/assets/seasons/a%2Fb.png","https://evil.test/libro.png","/assets/seasons/libro.png?q=1","/assets/seasons/libro.png#fragmento")) {
                assets.addProperty("libro",malo);e.respuesta=dato.toString();assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
            }
            interaccion.remove("assets");avatar.add("asset",JsonNull.INSTANCE);e.respuesta=dato.toString();assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
        }
    }
    @Test void entradaAutenticadaResuelveEquipamientoYNoAceptaCosmeticosEnJson() throws Exception {
        try(var e=new Entorno()) {
            e.respuesta=COSMETICOS.replace("\"avatar\":null","\"avatar\":\"academia_avatar\"");
            var creado=e.pedir("/api/salas","POST","{\"nombre\":\"Ada\"}",null,e.jwt);assertEquals(201,creado.statusCode());
            JsonObject acceso=JsonParser.parseString(creado.body()).getAsJsonObject();String codigo=acceso.get("codigo").getAsString(),token=acceso.get("playerToken").getAsString();
            assertEquals(200,e.pedir("/api/salas/"+codigo+"/unirse","POST","{\"nombre\":\"Lin\"}",null).statusCode());
            assertEquals(200,e.pedir("/api/salas/"+codigo+"/unirse","POST","{\"nombre\":\"Sol\"}",null).statusCode());
            var iniciar=e.pedir("/api/salas/"+codigo+"/iniciar","POST","{\"revision\":3}",token);assertEquals(200,iniciar.statusCode());
            JsonObject dto=JsonParser.parseString(iniciar.body()).getAsJsonObject();JsonObject jugador=dto.getAsJsonObject("partida").getAsJsonArray("jugadores").get(0).getAsJsonObject();
            assertEquals("academia_avatar",jugador.getAsJsonObject("cosmeticos").getAsJsonObject("avatar").get("id").getAsString());
            assertEquals(Set.of("avatar"),jugador.getAsJsonObject("cosmeticos").keySet());assertFalse(iniciar.body().contains("inventario"));assertFalse(iniciar.body().contains(e.jwt));
            assertEquals(400,e.pedir("/api/salas","POST","{\"nombre\":\"Fake\",\"cosmeticos\":{}}",null).statusCode());
            var guest=e.pedir("/api/salas","POST","{\"nombre\":\"Host\"}",null);JsonObject g=JsonParser.parseString(guest.body()).getAsJsonObject();String code=g.get("codigo").getAsString();
            assertEquals(200,e.pedir("/api/salas/"+code+"/unirse","POST","{\"nombre\":\"Ada\"}",null,e.jwt).statusCode());
            assertEquals(2,e.peticiones.stream().filter(p->p.contains("/cosmeticos")).count());
        }
    }
    @Test void admiteInteraccionCosmeticaYValidaPropiedadYTipo() throws Exception {
        try(var e=new Entorno()) {
            JsonObject dato=JsonParser.parseString(COSMETICOS).getAsJsonObject();JsonObject item=dato.getAsJsonArray("inventario").get(0).getAsJsonObject().deepCopy();
            item.addProperty("id","test_interaccion");item.addProperty("tipo","interaccion");dato.getAsJsonArray("inventario").add(item);
            dato.getAsJsonObject("equipamiento").addProperty("interaccion","test_interaccion");e.respuesta=dato.toString();
            var equipado=e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"interaccion\",\"id\":\"test_interaccion\"}",e.jwt);
            assertEquals(200,equipado.statusCode());assertTrue(e.peticiones.get(0).contains("\"p_tipo\":\"interaccion\""));
            dato.getAsJsonObject("equipamiento").add("interaccion",JsonNull.INSTANCE);e.respuesta=dato.toString();
            assertEquals(200,e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"interaccion\",\"id\":null}",e.jwt).statusCode());
            dato.getAsJsonObject("equipamiento").addProperty("interaccion","academia_avatar");e.respuesta=dato.toString();assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
            dato.getAsJsonObject("equipamiento").addProperty("interaccion","not_owned");e.respuesta=dato.toString();assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
            assertEquals(400,e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"animacion\",\"id\":null}",e.jwt).statusCode());
        }
    }
    @Test void proyectaCatalogoBloqueadoArchivoYRespuestaDeEquipamiento() throws Exception {
        try(var e=new Entorno()) {
            JsonObject dato=JsonParser.parseString(COSMETICOS).getAsJsonObject();
            JsonObject temporada=JsonParser.parseString("""
                {"id":"temporada:2026-10","nombre":"Crónicas del Archivo","inicio":"2026-10-01T00:00:00+02:00","fin":"2026-11-01T00:00:00+01:00","nivel":2,"maxNivel":10,"recompensasObtenidas":1,"totalRecompensas":10,"user_id":"privado"}
                """).getAsJsonObject();
            JsonArray temporadas=new JsonArray();temporadas.add(temporada);dato.add("temporadas",temporadas);
            JsonObject origen=new JsonObject();origen.addProperty("id","temporada:2026-10");origen.addProperty("nombre","Crónicas del Archivo");
            JsonObject item=new JsonObject();JsonObject cosmetico=dato.getAsJsonArray("inventario").get(0).getAsJsonObject().deepCopy();
            cosmetico.addProperty("id","avatar_bloqueado");item.add("cosmetico",cosmetico);item.add("temporada",origen);item.addProperty("nivel",6);
            JsonArray catalogo=new JsonArray();catalogo.add(item);dato.add("catalogo",catalogo);e.respuesta=dato.toString();
            var get=e.pedir("/api/cosmeticos","GET",null,e.jwt);assertEquals(200,get.statusCode());assertFalse(get.body().contains("privado"));
            JsonObject proyectado=JsonParser.parseString(get.body()).getAsJsonObject();assertEquals(6,proyectado.getAsJsonArray("catalogo").get(0).getAsJsonObject().get("nivel").getAsInt());
            assertEquals(1,proyectado.getAsJsonArray("temporadas").size());assertEquals(1,proyectado.getAsJsonArray("inventario").size());
            var post=e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"avatar\",\"id\":null}",e.jwt);assertEquals(200,post.statusCode());assertEquals(get.body(),post.body());
            for(String bad:List.of(dato.toString().replace("\"nivel\":6","\"nivel\":11"),dato.toString().replace("\"recompensasObtenidas\":1","\"recompensasObtenidas\":11"),dato.toString().replace("2026-11-01T00:00:00+01:00","2026-11-02T00:00:00+01:00"),dato.toString().replace("user-icon.svg","../secret.svg"))) {
                e.respuesta=bad;assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
            }
            dato.getAsJsonArray("catalogo").add(item.deepCopy());e.respuesta=dato.toString();assertEquals(503,e.pedir("/api/cosmeticos","GET",null,e.jwt).statusCode());
        }
    }
    @Test void permitePuntosConfigurablesBundleDeNivelDiezYSieteSlots() throws Exception {
        try(var e=new Entorno()) {
            JsonObject dato=JsonParser.parseString(PASE).getAsJsonObject();JsonObject progreso=dato.getAsJsonObject("progreso");
            progreso.addProperty("puntosPorNivel",100);progreso.addProperty("puntos",900);progreso.addProperty("nivel",10);progreso.add("puntosSiguienteNivel",JsonNull.INSTANCE);
            JsonArray recompensas=new JsonArray();
            for(int nivel=1;nivel<=10;nivel++) {
                JsonObject r=new JsonObject();r.addProperty("id","premio_"+nivel);r.addProperty("nombre","Recompensa "+nivel);r.addProperty("nivel",nivel);r.addProperty("desbloqueada",true);r.addProperty("reclamada",false);
                JsonArray cosmeticos=new JsonArray();JsonObject premio=dato.getAsJsonArray("recompensas").get(0).getAsJsonObject().getAsJsonArray("cosmeticos").get(0).deepCopy().getAsJsonObject();
                premio.addProperty("id","cosmetico_"+nivel);premio.addProperty("tipo",nivel==10?"marco":"avatar");premio.addProperty("asset","/assets/Tesis-assets/avatars-futuros/archivo_01.webp");cosmeticos.add(premio);
                if(nivel==10){JsonObject segundo=premio.deepCopy();segundo.addProperty("id","insignia_final");segundo.addProperty("tipo","insignia");segundo.addProperty("rareza","legendario");cosmeticos.add(segundo);}
                r.add("cosmeticos",cosmeticos);recompensas.add(r);
            }
            dato.add("recompensas",recompensas);e.respuesta=dato.toString();var result=e.pedir("/api/pase","GET",null,e.jwt);assertEquals(200,result.statusCode());
            JsonObject proyectado=JsonParser.parseString(result.body()).getAsJsonObject();assertEquals(10,proyectado.getAsJsonArray("recompensas").size());assertEquals(2,proyectado.getAsJsonArray("recompensas").get(9).getAsJsonObject().getAsJsonArray("cosmeticos").size());assertTrue(proyectado.getAsJsonObject("progreso").get("puntosSiguienteNivel").isJsonNull());
            e.respuesta=COSMETICOS;JsonObject equipamiento=JsonParser.parseString(e.pedir("/api/cosmeticos","GET",null,e.jwt).body()).getAsJsonObject().getAsJsonObject("equipamiento");assertEquals(7,equipamiento.size());assertTrue(equipamiento.get("placa").isJsonNull());assertTrue(equipamiento.get("interaccion").isJsonNull());
            assertEquals(200,e.pedir("/api/cosmeticos/equipar","POST","{\"tipo\":\"placa\",\"id\":null}",e.jwt).statusCode());
        }
    }
}
