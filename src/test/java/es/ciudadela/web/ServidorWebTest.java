package es.ciudadela.web;

import com.google.gson.*;
import org.junit.jupiter.api.Test;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class ServidorWebTest {
    private HttpClient cliente() { return HttpClient.newBuilder().cookieHandler(new CookieManager(null,CookiePolicy.ACCEPT_ALL)).build(); }
    private HttpResponse<String> get(HttpClient c,String url) throws Exception {
        return c.send(HttpRequest.newBuilder(URI.create(url)).GET().build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
    private HttpResponse<String> post(HttpClient c,String url,String body) throws Exception {
        return c.send(HttpRequest.newBuilder(URI.create(url)).header("Content-Type","application/json").header("X-Ciudadela","1")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @Test void sirveFrontendAssetsApiYSesionesAisladas() throws Exception {
        try(var web=new ServidorWeb(0)) {
            web.iniciar(); String base="http://localhost:"+web.puerto(); var c=cliente();
            var index=get(c,base+"/"); assertEquals(200,index.statusCode()); assertTrue(index.body().contains("Ciudadela Académica"));
            assertEquals(200,get(c,base+"/js/app.js").statusCode());
            assertTrue(get(c,base+"/css/game.css").headers().firstValue("Content-Type").orElseThrow().contains("text/css"));
            var png=get(c,base+"/assets/Ciudadelas-assets/cartas/reverso_idea.png");
            assertEquals(200,png.statusCode()); assertEquals("image/png",png.headers().firstValue("Content-Type").orElseThrow());
            assertEquals(404,get(c,base+"/no-existe").statusCode());
            assertEquals(404,get(c,base+"/../pom.xml").statusCode());
            var creacion=post(c,base+"/api/game","{\"nombres\":[\"Ángela\",\"Bruno\"]}");
            assertEquals(200,creacion.statusCode()); assertTrue(creacion.body().contains("Ángela"));
            assertEquals("no-store",creacion.headers().firstValue("Cache-Control").orElseThrow());
            assertEquals("null",get(cliente(),base+"/api/game/state").body());
            var estado=JsonParser.parseString(creacion.body()).getAsJsonObject(); long version=estado.get("revision").getAsLong();
            var revelar=post(c,base+"/api/game/reveal","{\"revision\":"+version+"}");
            assertEquals(200,revelar.statusCode());
            estado=JsonParser.parseString(revelar.body()).getAsJsonObject();
            assertEquals(2,estado.getAsJsonArray("mano").size());
            var stale=post(c,base+"/api/game/reveal","{\"revision\":"+version+"}"); assertEquals(409,stale.statusCode());
            var elegir=post(c,base+"/api/game/select-role","{\"revision\":"+estado.get("revision")+",\"tipo\":\"SELECCIONAR\",\"indice\":0}");
            assertEquals(200,elegir.statusCode());
            assertTrue(JsonParser.parseString(elegir.body()).getAsJsonObject().getAsJsonArray("mano").isEmpty());
        }
    }

    @Test void rechazaSolicitudesInvalidasYDeOtroOrigen() throws Exception {
        try(var web=new ServidorWeb(0)) {
            web.iniciar(); var c=cliente(); String base="http://localhost:"+web.puerto();
            assertEquals(400,post(c,base+"/api/game","{").statusCode());
            assertEquals(400,post(c,base+"/api/game","{}").statusCode());
            assertEquals(413,post(c,base+"/api/game"," ".repeat(8193)).statusCode());
            assertEquals(404,post(c,base+"/api/desconocida","{}").statusCode());
            var sinCabecera=HttpRequest.newBuilder(URI.create(base+"/api/game")).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertEquals(403,c.send(sinCabecera,HttpResponse.BodyHandlers.ofString()).statusCode());
            var otroOrigen=HttpRequest.newBuilder(URI.create(base+"/api/game")).header("X-Ciudadela","1").header("Origin","https://example.org")
                    .POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertEquals(403,c.send(otroOrigen,HttpResponse.BodyHandlers.ofString()).statusCode());
        }
    }
}
