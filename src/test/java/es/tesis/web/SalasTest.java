package es.tesis.web;

import com.google.gson.Gson;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class SalasTest {
    private final GestorSalas gestor = new GestorSalas();
    private record Mesa(SalaJuego sala, Map<String,String> tokens, String host) {
        Vistas.Sala ver(String nombre) { return sala.estado(tokens.get(nombre)); }
        Vistas.Sala ver() { return ver(host); }
        Vistas.Sala actuar(String nombre, String tipo, Integer indice, String objetivo) {
            return sala.actuar(tokens.get(nombre),new Vistas.Peticion(ver().revision(),tipo,indice,objetivo,null));
        }
        Vistas.Sala actual() { return ver(ver().partida().actual()); }
    }
    private Mesa mesa(int cantidad) {
        var acceso=gestor.crear("Fali"); var sala=gestor.buscar(acceso.codigo());
        var tokens=new LinkedHashMap<String,String>(); tokens.put("Fali",acceso.playerToken());
        for(int i=1;i<cantidad;i++) { var a=sala.unirse("Jugador "+i); tokens.put(a.sala().yo(),a.playerToken()); }
        return new Mesa(sala,tokens,"Fali");
    }
    private void iniciar(Mesa m) { m.sala.iniciar(m.tokens.get(m.host),m.ver().revision()); }
    private void seleccionar(Mesa m) {
        while(m.ver().partida().fase().equals("SELECCION_ROLES")) {
            var s=m.actual(); var rol=s.partida().seleccion().stream().filter(r->r.orden()!=1).findFirst()
                    .orElse(s.partida().seleccion().get(0));
            m.actuar(s.yo(),"SELECCIONAR",rol.indice(),null);
        }
    }
    @Test void codigosTokensNormalizacionEIdentidadesIndependientes() {
        var a=gestor.crear(" Fali "); var b=gestor.crear("Fali");
        assertTrue(a.codigo().matches("[A-HJ-NP-Z2-9]{5}")); assertNotEquals(a.codigo(),b.codigo());
        assertEquals(43,a.playerToken().length()); assertNotEquals(a.playerToken(),b.playerToken());
        assertSame(gestor.buscar(a.codigo()),gestor.buscar(" "+a.codigo().toLowerCase(Locale.ROOT)+" "));
        assertEquals("Fali",a.sala().yo()); assertTrue(a.sala().soyAnfitrion());
        var invitado=gestor.buscar(a.codigo()).unirse("Jefe"); assertFalse(invitado.sala().soyAnfitrion());
        assertNotEquals(a.playerToken(),invitado.playerToken());
        assertEquals(401,assertThrows(ErrorSala.class,()->gestor.buscar(a.codigo()).estado(b.playerToken())).estado);
        assertEquals(401,assertThrows(ErrorSala.class,()->gestor.buscar(a.codigo()).estado(null)).estado);
        String json=new Gson().toJson(invitado.sala());
        assertFalse(json.contains("playerToken")); assertFalse(json.contains(a.playerToken()));
        assertEquals(1,b.sala().jugadores().size());
    }
    @Test void validaNombresCodigosDuplicadosYLobby() {
        for(String nombre:List.of("", " ", "a".repeat(25), "a\nb")) assertThrows(IllegalArgumentException.class,()->gestor.crear(nombre));
        assertThrows(IllegalArgumentException.class,()->gestor.buscar(""));
        assertEquals(404,assertThrows(ErrorSala.class,()->gestor.buscar("ZZZZZ")).estado);
        var m=mesa(3); assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.unirse(" fALI ")).estado);
        iniciar(m); assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.unirse("Tercero")).estado);
        assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.iniciar(m.tokens.get(m.host),m.ver().revision())).estado);
    }
    @Test void anfitrionYMinimoSonObligatorios() {
        var m=mesa(1);
        assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.iniciar(m.tokens.get(m.host),m.ver().revision())).estado);
        var otro=m.sala.unirse("Jefe");
        assertEquals(403,assertThrows(ErrorSala.class,()->m.sala.iniciar(otro.playerToken(),otro.sala().revision())).estado);
        assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.iniciar(m.tokens.get(m.host),m.ver().revision())).estado);
        m.sala.unirse("Clara");
        iniciar(m); assertEquals("EN_PARTIDA",m.ver().fase());
    }
    @ParameterizedTest @ValueSource(ints={3,4,5})
    void repartoYSeleccionPrivadaParaTodosLosTamanyos(int cantidad) {
        var m=mesa(cantidad); if(cantidad==5) assertThrows(ErrorSala.class,()->m.sala.unirse("Extra"));
        iniciar(m);
        for(String nombre:m.tokens.keySet()) {
            var s=m.ver(nombre); assertEquals(nombre,s.yo()); assertEquals(2,s.partida().mano().size());
            assertEquals(8,s.partida().ideas());
            assertEquals(s.partida().actual().equals(nombre)?(cantidad==3?5:6):0,s.partida().seleccion().size());
            assertTrue(s.partida().jugadores().stream().allMatch(j->j.rol()==null));
        }
        seleccionar(m); assertEquals("TURNO_JUGADOR",m.ver().partida().fase());
    }
    @Test void rolesSecretosYOpcionesNoAparecenEnPerspectivaAjena() {
        var m=mesa(3); iniciar(m); var primero=m.actual(); var rol=primero.partida().seleccion().get(0);
        m.actuar(primero.yo(),"SELECCIONAR",rol.indice(),null);
        var propio=m.ver(primero.yo()); assertNotNull(propio.partida().jugadores().stream().filter(j->j.nombre().equals(primero.yo())).findFirst().orElseThrow().rol());
        for(String nombre:m.tokens.keySet()) if(!nombre.equals(primero.yo())) {
            var ajeno=m.ver(nombre); var j=ajeno.partida().jugadores().stream().filter(p->p.nombre().equals(primero.yo())).findFirst().orElseThrow();
            assertNull(j.rol());
            var json=new Gson().toJsonTree(ajeno).getAsJsonObject().getAsJsonObject("partida");
            for(var rival:json.getAsJsonArray("jugadores")) { assertFalse(rival.getAsJsonObject().has("mano")); assertFalse(rival.getAsJsonObject().has("cartasIdea")); }
            if(!ajeno.partida().actual().equals(nombre)) assertTrue(ajeno.partida().seleccion().isEmpty());
            assertTrue(ajeno.partida().eventos().stream().noneMatch(e->e.texto().contains(rol.nombre())));
        }
    }
    @Test void turnoIndicesVersionYRecursosSiemprePertenecenAlActor() {
        var m=mesa(3); iniciar(m); var primero=m.actual();
        String otro=m.tokens.keySet().stream().filter(n->!n.equals(primero.yo())).findFirst().orElseThrow();
        assertEquals(403,assertThrows(ErrorSala.class,()->m.actuar(otro,"SELECCIONAR",0,null)).estado);
        var previo=m.ver(); assertThrows(IllegalArgumentException.class,()->m.actuar(primero.yo(),"SELECCIONAR",99,null)); assertEquals(previo,m.ver());
        seleccionar(m); var actual=m.actual(); String rival=m.tokens.keySet().stream().filter(n->!n.equals(actual.yo())).findFirst().orElseThrow();
        assertTrue(m.ver(rival).partida().acciones().isEmpty());
        for(String tipo:List.of("COBRAR","PENSAR","INICIAR","TRABAJAR","HABILIDAD","FIN_TURNO"))
            assertEquals(403,assertThrows(ErrorSala.class,()->m.actuar(rival,tipo,0,null)).estado);
        assertThrows(IllegalArgumentException.class,()->m.actuar(actual.yo(),"INICIAR",99,null));
        assertThrows(IllegalArgumentException.class,()->m.actuar(actual.yo(),"TRABAJAR",99,null));
        var manoRival=m.ver(rival).partida().mano();
        var vieja=new Vistas.Peticion(actual.revision(),"COBRAR",null,null,null);
        m.sala.actuar(m.tokens.get(actual.yo()),vieja);
        assertEquals(409,assertThrows(ErrorSala.class,()->m.sala.actuar(m.tokens.get(actual.yo()),vieja)).estado);
        m.actuar(actual.yo(),"PENSAR",null,null);
        assertEquals(manoRival,m.ver(rival).partida().mano());
        assertEquals(actual.partida().mano().size()+1,m.actual().partida().mano().size());
        assertEquals(8,m.actual().partida().ideas());
    }
    @Test void dosSolicitudesSimultaneasNoDuplicanCobro() throws Exception {
        var m=mesa(3); iniciar(m); seleccionar(m); var actual=m.actual();
        var solicitud=new Vistas.Peticion(actual.revision(),"COBRAR",null,null,null);
        var salida=new CountDownLatch(1); var pool=Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> tarea=()->{salida.await(); try { m.sala.actuar(m.tokens.get(actual.yo()),solicitud); return 200; } catch(ErrorSala e) {return e.estado;} };
            var a=pool.submit(tarea); var b=pool.submit(tarea); salida.countDown();
            var codigos=new ArrayList<>(List.of(a.get(5,TimeUnit.SECONDS),b.get(5,TimeUnit.SECONDS))); Collections.sort(codigos);
            assertEquals(List.of(200,409),codigos);
            assertEquals(1,m.actual().partida().accionesRestantes());
        } finally { pool.shutdownNow(); }
    }
    @Test void salasNoCompartenPartidaYConsultasNoMutanRevision() {
        var a=mesa(3); var b=mesa(3); iniciar(a); iniciar(b);
        var antes=b.ver(); seleccionar(a); mCobrar(a);
        assertEquals(antes,b.ver()); assertEquals(a.ver(),a.ver());
    }
    private void mCobrar(Mesa m) {m.actuar(m.actual().yo(),"COBRAR",null,null);}
    @Test void caducidadRespetaConsultasValidasYNoLaProlonganTokensInvalidos() {
        class Reloj extends Clock {
            Instant instante=Instant.parse("2026-01-01T00:00:00Z");
            public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId z){return this;} public Instant instant(){return instante;}
        }
        var reloj=new Reloj(); var registro=new GestorSalas(reloj,Duration.ofHours(24));
        var a=registro.crear("A"); var b=registro.crear("B");
        reloj.instante=reloj.instante.plus(Duration.ofHours(23)); registro.buscar(a.codigo()).estado(a.playerToken());
        assertThrows(ErrorSala.class,()->registro.buscar(b.codigo()).estado("falso"));
        reloj.instante=reloj.instante.plus(Duration.ofHours(2)); registro.limpiar();
        assertNotNull(registro.buscar(a.codigo())); assertEquals(404,assertThrows(ErrorSala.class,()->registro.buscar(b.codigo())).estado);
    }
    @ParameterizedTest @ValueSource(ints={3,5})
    void partidaCompletaConVariasRondasDesdeTodasLasIdentidades(int cantidad) {
        var m=mesa(cantidad); iniciar(m); var usados=new HashSet<String>();
        for(int paso=0;paso<3000&&!m.ver().fase().equals("FINALIZADA");paso++) {
            var sala=m.actual(); var s=sala.partida();
            if(s.fase().equals("SELECCION_ROLES")) { seleccionar(m); continue; }
            String tipo; Integer indice=null; String objetivo=null;
            if(s.fase().equals("FIN_RONDA")) tipo="SIGUIENTE_RONDA";
            else {
                List<String> prioridades=s.habilidadPendiente()?List.of("HABILIDAD"):
                        s.mano().isEmpty()?List.of("TRABAJAR","PENSAR","COBRAR","FIN_TURNO"):List.of("TRABAJAR","INICIAR","COBRAR","FIN_TURNO");
                Vistas.Accion elegida=null;
                for(String id:prioridades) { elegida=s.acciones().stream().filter(a->a.id().equals(id)&&a.disponible()).findFirst().orElse(null); if(elegida!=null)break; }
                if (!usados.contains("PENSAR") && !s.habilidadPendiente()) {
                    elegida=s.acciones().stream().filter(a->a.id().equals("PENSAR")&&a.disponible()).findFirst().orElse(elegida);
                }
                assertNotNull(elegida); tipo=elegida.id();
                if(!elegida.opciones().isEmpty()){var o=elegida.opciones().get(0);indice=o.indice();objetivo=o.objetivo();}
            }
            usados.add(tipo); m.actuar(sala.yo(),tipo,indice,objetivo);
        }
        assertTrue(usados.containsAll(List.of("INICIAR","TRABAJAR","COBRAR","PENSAR","FIN_TURNO","SIGUIENTE_RONDA")));
        assertEquals("FINALIZADA",m.ver().fase()); assertTrue(m.ver().partida().ronda()>1); assertFalse(m.ver().partida().ganadores().isEmpty());
        for(String nombre:m.tokens.keySet()) {
            assertEquals(m.ver().partida().ganadores(),m.ver(nombre).partida().ganadores());
            assertTrue(m.ver(nombre).partida().acciones().isEmpty());
            assertThrows(ErrorSala.class,()->m.actuar(nombre,"COBRAR",null,null));
        }
    }
}
