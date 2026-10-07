package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import com.google.gson.Gson;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class InteraccionesTest {
    static final String ID="archivo_lanzamiento_libro";
    static final CosmeticosPartida EQUIPO=new CosmeticosPartida(null,null,null,new CuentasSupabase.Cosmetico(ID,"interaccion","Lanzamiento de libro",
            "/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png","legendario"));
    static class Reloj extends Clock {
        Instant instante=Instant.parse("2026-10-07T00:00:00Z");
        public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId z){return this;}public Instant instant(){return instante;}
        void avanzar(long ms){instante=instante.plusMillis(ms);}
    }
    static class Mesa {
        final Reloj reloj=new Reloj();final SalaJuego sala=new SalaJuego("ABCDE",reloj,new SecureRandom());
        final UUID cuenta=UUID.randomUUID();final String host=sala.unirse("Ada",cuenta,EQUIPO).playerToken();
        final String lin=sala.unirse("Lin").playerToken(),sol=sala.unirse("Sol").playerToken();
        void iniciar(){sala.iniciar(host,sala.estado(host).revision());}
        Vistas.Interacciones enviar(){return sala.interactuar(host,cuenta,ID,"Lin",EQUIPO);}
    }
    @Test void canalIndependienteConCursorYCooldownSobreviveRecarga() {
        var m=new Mesa();m.iniciar();var antes=m.sala.estado(m.host);
        var baseline=m.sala.interacciones(m.host,null);assertEquals(0,baseline.ultimo());assertTrue(baseline.eventos().isEmpty());assertEquals(ID,baseline.propia().interactionId());
        var enviado=m.enviar();assertEquals(1,enviado.ultimo());assertEquals(1,enviado.eventos().size());assertEquals("Ada",enviado.eventos().get(0).emisor());assertEquals("Lin",enviado.eventos().get(0).objetivo());
        assertEquals(antes,m.sala.estado(m.host));
        var recibido=m.sala.interacciones(m.sol,0L);assertEquals(enviado.eventos(),recibido.eventos());assertNull(recibido.propia().interactionId());
        var reload=m.sala.interacciones(m.host,null);assertTrue(reload.eventos().isEmpty());assertEquals(enviado.propia().disponibleEn(),reload.propia().disponibleEn());
        assertTrue(m.sala.interacciones(m.sol,1L).eventos().isEmpty());
        assertEquals(429,assertThrows(ErrorSala.class,m::enviar).estado);m.reloj.avanzar(14_999);assertEquals(429,assertThrows(ErrorSala.class,m::enviar).estado);
        m.reloj.avanzar(1);assertEquals(2,m.enviar().ultimo());
        String json=new Gson().toJson(recibido);assertFalse(json.contains(m.cuenta.toString()));assertFalse(json.contains(m.host));assertFalse(json.contains("inventario"));
    }
    @Test void validaCuentaSalaFaseOwnershipEquipamientoYCatalogo() {
        var m=new Mesa();assertEquals(409,assertThrows(ErrorSala.class,m::enviar).estado);m.iniciar();
        assertEquals(401,assertThrows(ErrorSala.class,()->m.sala.interacciones("falso",null)).estado);
        assertEquals(403,assertThrows(ErrorSala.class,()->m.sala.interactuar(m.host,UUID.randomUUID(),ID,"Lin",EQUIPO)).estado);
        assertEquals(403,assertThrows(ErrorSala.class,()->m.sala.interactuar(m.lin,m.cuenta,ID,"Ada",EQUIPO)).estado);
        for(String objetivo:List.of("Ada","Fuera"))assertEquals(400,assertThrows(ErrorSala.class,()->m.sala.interactuar(m.host,m.cuenta,ID,objetivo,EQUIPO)).estado);
        assertEquals(400,assertThrows(ErrorSala.class,()->m.sala.interactuar(m.host,m.cuenta,"arbitraria","Lin",EQUIPO)).estado);
        assertEquals(403,assertThrows(ErrorSala.class,()->m.sala.interactuar(m.host,m.cuenta,ID,"Lin",CosmeticosPartida.originales())).estado);
        for(long cursor:List.of(-1L,1L))assertEquals(400,assertThrows(ErrorSala.class,()->m.sala.interacciones(m.host,cursor)).estado);
        assertEquals(0,m.sala.interacciones(m.host,null).ultimo());
    }
    @Test void postIncluyeEventosDeOtrosEmisoresOcurridosDesdeElUltimoGet() {
        var reloj=new Reloj();var sala=new SalaJuego("ABCDE",reloj,new SecureRandom());UUID a=UUID.randomUUID(),b=UUID.randomUUID();
        String ada=sala.unirse("Ada",a,EQUIPO).playerToken(),lin=sala.unirse("Lin",b,EQUIPO).playerToken();sala.unirse("Sol");
        sala.iniciar(ada,sala.estado(ada).revision());assertEquals(0,sala.interacciones(ada,null).ultimo());
        sala.interactuar(lin,b,ID,"Ada",EQUIPO);
        var respuesta=sala.interactuar(ada,a,ID,"Lin",EQUIPO);
        assertEquals(2,respuesta.ultimo());assertEquals(List.of("Lin","Ada"),respuesta.eventos().stream().map(Vistas.EventoInteraccion::emisor).toList());
        assertEquals(List.of(1L,2L),respuesta.eventos().stream().map(Vistas.EventoInteraccion::numero).toList());
        assertTrue(sala.interacciones(ada,respuesta.ultimo()).eventos().isEmpty());
    }
    @Test void concurrenciaProduceUnEventoYSpamSeRechazaSinDuplicar() throws Exception {
        var m=new Mesa();m.iniciar();var ejecutor=Executors.newFixedThreadPool(8);var inicio=new CountDownLatch(1);
        try {
            List<Future<Integer>> solicitudes=new ArrayList<>();
            for(int i=0;i<16;i++)solicitudes.add(ejecutor.submit(()->{inicio.await();try {m.enviar();return 200;}catch(ErrorSala e){return e.estado;}}));
            inicio.countDown();int exitos=0;for(var f:solicitudes){int estado=f.get(3,TimeUnit.SECONDS);if(estado==200)exitos++;else assertEquals(429,estado);}
            assertEquals(1,exitos);assertEquals(1,m.sala.interacciones(m.sol,0L).eventos().size());
        }finally{ejecutor.shutdownNow();}
    }
    @Test void historialCaducaSinResetearCursor() {
        var m=new Mesa();m.iniciar();for(int i=0;i<80;i++){m.enviar();m.reloj.avanzar(15_000);}
        var reciente=m.sala.interacciones(m.sol,0L);assertEquals(80,reciente.ultimo());assertTrue(reciente.eventos().size()<=5);
        m.reloj.avanzar(60_001);var vacio=m.sala.interacciones(m.sol,0L);assertEquals(80,vacio.ultimo());assertTrue(vacio.eventos().isEmpty());
    }
    @Test void finalizadaRechazaInteraccionSinAlterarResultado() {
        var m=new Mesa();m.iniciar();Map<String,String> tokens=Map.of("Ada",m.host,"Lin",m.lin,"Sol",m.sol);
        for(int paso=0;paso<3000&&!m.sala.estado(m.host).fase().equals("FINALIZADA");paso++) {
            var general=m.sala.estado(m.host);String token=tokens.get(general.partida().actual());var estado=m.sala.estado(token);var s=estado.partida();
            String tipo;Integer indice=null;String objetivo=null;
            if(s.fase().equals("SELECCION_ROLES")) {
                var rol=s.seleccion().stream().filter(r->r.orden()!=1).findFirst().orElse(s.seleccion().get(0));tipo="SELECCIONAR";indice=rol.indice();
            }else if(s.fase().equals("FIN_RONDA"))tipo="SIGUIENTE_RONDA";
            else {
                List<String> prioridades=s.habilidadPendiente()?List.of("HABILIDAD"):
                        s.mano().isEmpty()?List.of("TRABAJAR","PENSAR","COBRAR","FIN_TURNO"):List.of("TRABAJAR","INICIAR","COBRAR","FIN_TURNO");
                Vistas.Accion elegida=null;for(String id:prioridades){elegida=s.acciones().stream().filter(a->a.id().equals(id)&&a.disponible()).findFirst().orElse(null);if(elegida!=null)break;}
                assertNotNull(elegida);tipo=elegida.id();if(!elegida.opciones().isEmpty()){var o=elegida.opciones().get(0);indice=o.indice();objetivo=o.objetivo();}
            }
            m.sala.actuar(token,new Vistas.Peticion(estado.revision(),tipo,indice,objetivo,null));
        }
        var finalizada=m.sala.estado(m.host);assertEquals("FINALIZADA",finalizada.fase());
        assertEquals(409,assertThrows(ErrorSala.class,m::enviar).estado);m.sala.interacciones(m.host,0L);
        assertEquals(finalizada,m.sala.estado(m.host));
    }
    @Test void canalNoAvanzaFinRondaNiTocaRevisionFuncional() throws Exception {
        var m=new Mesa();m.iniciar();Map<String,String> tokens=Map.of("Ada",m.host,"Lin",m.lin,"Sol",m.sol);
        while(m.sala.estado(m.host).partida().fase().equals("SELECCION_ROLES")) {
            var estado=m.sala.estado(m.host);String actor=estado.partida().actual();var perspectiva=m.sala.estado(tokens.get(actor));
            var rol=perspectiva.partida().seleccion().stream().filter(r->r.orden()!=1).findFirst().orElse(perspectiva.partida().seleccion().get(0));
            m.sala.actuar(tokens.get(actor),new Vistas.Peticion(estado.revision(),"SELECCIONAR",rol.indice(),null,null));
        }
        while(m.sala.estado(m.host).partida().fase().equals("TURNO_JUGADOR")) {
            var estado=m.sala.estado(m.host);m.sala.actuar(tokens.get(estado.partida().actual()),new Vistas.Peticion(estado.revision(),"FIN_TURNO",null,null,null));
        }
        var cierre=m.sala.estado(m.host);assertEquals("FIN_RONDA",cierre.partida().fase());m.reloj.avanzar(5_001);
        var revision=SalaJuego.class.getDeclaredField("revision");revision.setAccessible(true);
        var juego=SalaJuego.class.getDeclaredField("juego");juego.setAccessible(true);var adaptador=(SesionJuego)juego.get(m.sala);
        var funcional=adaptador.estado();m.sala.interacciones(m.host,null);m.enviar();m.sala.interacciones(m.sol,0L);
        assertEquals(cierre.revision(),revision.getLong(m.sala));assertEquals(funcional,adaptador.estado());
        assertEquals(cierre.revision()+1,m.sala.estado(m.host).revision());
    }
}
