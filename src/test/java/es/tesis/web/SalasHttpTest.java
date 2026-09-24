package es.tesis.web;

import com.google.gson.*;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SalasHttpTest {
    private final Gson gson=new Gson();
    private record Cliente(HttpClient http, String token, String nombre) {}
    private HttpResponse<String> enviar(HttpClient cliente,String url,String token,Object body) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create(url));
        if(token!=null)builder.header("Authorization","Bearer "+token);
        if(body==null)builder.GET(); else builder.header("X-Tesis","1").header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)));
        return cliente.send(builder.build(),HttpResponse.BodyHandlers.ofString());
    }
    private Vistas.Sala estado(Cliente c,String base) throws Exception {
        var r=enviar(c.http,base+"/estado",c.token,null); assertEquals(200,r.statusCode(),r.body());
        assertFalse(r.body().contains(c.token)); assertFalse(r.body().contains("playerToken"));
        return gson.fromJson(r.body(),Vistas.Sala.class);
    }
    private Vistas.Sala actuar(Cliente c,String base,Vistas.Sala sala,String tipo,Integer indice,String objetivo) throws Exception {
        var r=enviar(c.http,base+"/accion",c.token,new Vistas.Peticion(sala.revision(),tipo,indice,objetivo,null));
        assertEquals(200,r.statusCode(),r.body()); return gson.fromJson(r.body(),Vistas.Sala.class);
    }

    @Test void apiAutenticaRechazaSuplantacionesYNoPublicaRutasLocales() throws Exception {
        try(var servidor=new ServidorWeb("127.0.0.1",0)) {
            servidor.iniciar(); String base="http://localhost:"+servidor.puerto(); var cliente=HttpClient.newHttpClient();
            var configuracion=gson.fromJson(enviar(cliente,base+"/api/config",null,null).body(),Vistas.Configuracion.class);
            assertEquals(3,configuracion.minimo()); assertEquals(5,configuracion.maximo());
            for(String ruta:List.of("state","reveal","lock","action","select-role"))
                assertEquals(404,enviar(cliente,base+"/api/game/"+ruta,null,ruta.equals("state")?null:Map.of()).statusCode());
            assertEquals(404,enviar(cliente,base+"/api/game",null,Map.of("nombres",List.of("A","B"))).statusCode());
            var creacion=enviar(cliente,base+"/api/salas",null,Map.of("nombre","Fali")); assertEquals(201,creacion.statusCode());
            assertEquals("no-store",creacion.headers().firstValue("Cache-Control").orElseThrow());
            var acceso=gson.fromJson(creacion.body(),Vistas.AccesoSala.class); String sala=base+"/api/salas/"+acceso.codigo();
            assertEquals(401,enviar(cliente,sala+"/estado",null,null).statusCode());
            assertEquals(401,enviar(cliente,sala+"/accion","Fali",Map.of("tipo","COBRAR")).statusCode());
            assertEquals(400,enviar(cliente,sala+"/accion",acceso.playerToken(),Map.of("jugador","Fali","revision",1,"tipo","COBRAR")).statusCode());
            assertEquals(413,enviar(cliente,sala+"/accion",acceso.playerToken(),Map.of("tipo","x".repeat(8200))).statusCode());
            assertEquals(405,enviar(cliente,sala+"/iniciar",acceso.playerToken(),null).statusCode());
            var malOrigen=HttpRequest.newBuilder(URI.create(sala+"/iniciar")).header("X-Tesis","1")
                    .header("Origin","https://ajeno.example").header("Authorization","Bearer "+acceso.playerToken())
                    .POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            assertEquals(403,cliente.send(malOrigen,HttpResponse.BodyHandlers.ofString()).statusCode());
            var reunion=enviar(cliente,sala+"/unirse",null,Map.of("nombre","Jefe"));
            var jefe=gson.fromJson(reunion.body(),Vistas.AccesoSala.class);
            assertEquals(403,enviar(cliente,sala+"/iniciar",jefe.playerToken(),Map.of("revision",jefe.sala().revision())).statusCode());
            assertEquals(409,enviar(cliente,sala+"/iniciar",acceso.playerToken(),Map.of("revision",jefe.sala().revision())).statusCode());
            var tercera=gson.fromJson(enviar(cliente,sala+"/unirse",null,Map.of("nombre","Clara")).body(),Vistas.AccesoSala.class);
            var inicio=enviar(cliente,sala+"/iniciar",acceso.playerToken(),Map.of("revision",tercera.sala().revision())); assertEquals(200,inicio.statusCode());
            assertEquals(409,enviar(cliente,sala+"/unirse",null,Map.of("nombre","Tercero")).statusCode());
        }
    }

    @Test void tresClientesIndependientesJueganPartidaEnteraPorHttpYReconectan() throws Exception {
        try(var servidor=new ServidorWeb("127.0.0.1",0)) {
            servidor.iniciar(); String base="http://localhost:"+servidor.puerto()+"/api/salas";
            var httpA=HttpClient.newHttpClient(); var httpB=HttpClient.newHttpClient();
            var acceso=gson.fromJson(enviar(httpA,base,null,Map.of("nombre","Fali")).body(),Vistas.AccesoSala.class);
            base+="/"+acceso.codigo();
            var union=gson.fromJson(enviar(httpB,base+"/unirse",null,Map.of("nombre","Jefe")).body(),Vistas.AccesoSala.class);
            var a=new Cliente(httpA,acceso.playerToken(),"Fali"); var b=new Cliente(httpB,union.playerToken(),"Jefe");
            var httpC=HttpClient.newHttpClient();
            var tercera=gson.fromJson(enviar(httpC,base+"/unirse",null,Map.of("nombre","Clara")).body(),Vistas.AccesoSala.class);
            var c=new Cliente(httpC,tercera.playerToken(),"Clara");
            assertEquals(List.of("Fali","Jefe","Clara"),estado(a,base).jugadores()); assertFalse(estado(b,base).soyAnfitrion());
            assertEquals(200,enviar(httpA,base+"/iniciar",a.token,Map.of("revision",estado(a,base).revision())).statusCode());
            var usados=new HashSet<String>();
            for(int paso=0;paso<1500;paso++) {
                var vistaA=estado(a,base); var vistaB=estado(b,base);
                assertEquals(vistaA.revision(),vistaB.revision()); assertEquals(vistaA.partida().actual(),vistaB.partida().actual());
                if(vistaA.fase().equals("FINALIZADA")) break;
                var actor=vistaA.partida().actual().equals("Fali")?a:vistaA.partida().actual().equals("Jefe")?b:c;
                var inactivo=actor==a?b:a; var s=estado(actor,base);
                assertTrue((actor==a?vistaB:vistaA).partida().seleccion().isEmpty());
                assertTrue((actor==a?vistaB:vistaA).partida().acciones().isEmpty());
                assertEquals(403,enviar(inactivo.http,base+"/accion",inactivo.token,new Vistas.Peticion(s.revision(),"COBRAR",null,null,null)).statusCode());
                var p=s.partida(); String tipo; Integer indice=null; String objetivo=null;
                if(p.fase().equals("SELECCION_ROLES")) {
                    tipo="SELECCIONAR"; indice=p.seleccion().stream().filter(r->r.orden()!=1&&r.orden()!=3).findFirst().orElseThrow().indice();
                } else if(p.fase().equals("FIN_RONDA")) tipo="SIGUIENTE_RONDA";
                else {
                    var prioridad=p.mano().isEmpty()?List.of("TRABAJAR","PENSAR","COBRAR","FIN_TURNO"):List.of("TRABAJAR","INICIAR","COBRAR","FIN_TURNO");
                    Vistas.Accion elegida=null;
                    for(String id:prioridad){elegida=p.acciones().stream().filter(x->x.id().equals(id)&&x.disponible()).findFirst().orElse(null);if(elegida!=null)break;}
                    if(!usados.contains("PENSAR")) elegida=p.acciones().stream().filter(x->x.id().equals("PENSAR")&&x.disponible()).findFirst().orElse(elegida);
                    assertNotNull(elegida); tipo=elegida.id();
                    if(!elegida.opciones().isEmpty()){var o=elegida.opciones().get(0);indice=o.indice();objetivo=o.objetivo();}
                }
                var despues=actuar(actor,base,s,tipo,indice,objetivo); usados.add(tipo);
                assertEquals(409,enviar(actor.http,base+"/accion",actor.token,new Vistas.Peticion(s.revision(),tipo,indice,objetivo,null)).statusCode());
                // Cliente HTTP nuevo, sin cookies: el token recupera exactamente la perspectiva.
                if(paso%20==0) assertEquals(despues,estado(new Cliente(HttpClient.newHttpClient(),actor.token,actor.nombre),base));
            }
            assertTrue(usados.containsAll(List.of("COBRAR","PENSAR","INICIAR","TRABAJAR","FIN_TURNO","SIGUIENTE_RONDA")));
            var fin=estado(a,base); assertEquals("FINALIZADA",fin.fase()); assertTrue(fin.partida().ronda()>1);
            assertEquals(fin.partida().ganadores(),estado(b,base).partida().ganadores());
            assertEquals(409,enviar(a.http,base+"/accion",a.token,new Vistas.Peticion(fin.revision(),"COBRAR",null,null,null)).statusCode());
        }
    }
}
