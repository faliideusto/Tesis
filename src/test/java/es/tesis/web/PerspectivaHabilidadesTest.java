package es.tesis.web;

import com.google.gson.Gson;
import es.tesis.dominio.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PerspectivaHabilidadesTest {
    private record Mesa(SesionJuego sesion, Jugador a, Jugador b) {
        Vistas.Estado ver(Jugador j) {return sesion.estado(j);}
        Vistas.Estado actuar(Jugador j,String tipo,Integer indice,String objetivo) {
            return sesion.actuar(j,new Vistas.Peticion(ver(j).revision(),tipo,indice,objetivo,null));
        }
    }
    private Mesa preparar(int orden, int otro) {
        for(int intento=0;intento<1000;intento++) {
            var s=new SesionJuego(); var a=new Jugador("Fali"); var b=new Jugador("Jefe");
            s.crearJugadores(List.of(a,b)); var m=new Mesa(s,a,b);
            var actual=m.ver(a).actual().equals(a.nombre())?a:b;
            var roles=m.ver(actual).seleccion();
            if(roles.stream().noneMatch(r->r.orden()==orden)||roles.stream().noneMatch(r->r.orden()==otro)) continue;
            while(m.ver(a).fase().equals("SELECCION_ROLES")) {
                actual=m.ver(a).actual().equals(a.nombre())?a:b;
                int requerido=actual==a?orden:otro;
                int indice=m.ver(actual).seleccion().stream().filter(r->r.orden()==requerido).findFirst().orElseThrow().indice();
                m.actuar(actual,"SELECCIONAR",indice,null);
            }
            if(!m.ver(a).actual().equals(a.nombre()))m.actuar(b,"FIN_TURNO",null,null);
            return m;
        }
        throw new AssertionError("No se encontró un reparto con los roles requeridos");
    }
    private void estudio(Jugador j,int trabajo) {
        j.iniciarEstudio(new IdeaCarta("Estudio público",1,trabajo,3));
    }
    @Test void jsonNoIncluyeManosAjenasNiRolOcultoInclusoConDatosDistinguibles() {
        var m=preparar(2,7);
        m.a.añadirCartaIdea(new IdeaCarta("SECRETO_DE_FALI",1,1,1));
        m.b.añadirCartaIdea(new IdeaCarta("SECRETO_DE_JEFE",1,1,1));
        var gson=new Gson(); String a=gson.toJson(m.ver(m.a)); String b=gson.toJson(m.ver(m.b));
        assertTrue(a.contains("SECRETO_DE_FALI")); assertFalse(a.contains("SECRETO_DE_JEFE"));
        assertTrue(b.contains("SECRETO_DE_JEFE")); assertFalse(b.contains("SECRETO_DE_FALI"));
        assertFalse(a.contains("Revisor 2")); assertTrue(b.contains("Revisor 2"));
        assertEquals(403,assertThrows(ErrorSala.class,()->m.actuar(m.b,"PENSAR",null,null)).estado);
        assertEquals(403,assertThrows(ErrorSala.class,()->m.sesion.estado(new Jugador("Fali"))).estado);
    }
    @Test void comitePendienteSeRecuperaYObligaAResolverAntesDeActuar() {
        var m=preparar(1,6); assertTrue(m.ver(m.a).habilidadPendiente()); assertFalse(m.ver(m.b).habilidadPendiente());
        assertEquals(m.ver(m.a),m.ver(m.a));
        assertThrows(IllegalStateException.class,()->m.actuar(m.a,"COBRAR",null,null));
        assertThrows(IllegalStateException.class,()->m.actuar(m.a,"FIN_TURNO",null,null));
        m.actuar(m.a,"HABILIDAD",null,"Pre-Doctoral");
        assertFalse(m.ver(m.a).habilidadPendiente());
        m.actuar(m.a,"FIN_TURNO",null,null); assertEquals("FIN_RONDA",m.ver(m.b).fase());
    }
    @Test void estadisticoBonificaSoloSuEstudio() {
        var m=preparar(2,7); estudio(m.a,1); m.a.trabajarEstudio(0,1);
        m.actuar(m.a,"HABILIDAD",0,null); assertEquals(4,m.a.prestigio()); assertEquals(0,m.b.prestigio());
        assertThrows(IllegalStateException.class,()->m.actuar(m.a,"HABILIDAD",0,null));
    }
    @Test void catalogoNuevoTieneSietePersonajesSinPlagiador() {
        var roles=FabricaMazos.crearRoles().cartas();
        assertEquals(7,roles.size());
        assertTrue(roles.stream().noneMatch(r->r.nombre().equals("Plagiador")));
    }
    @Test void investigadorRobaUnaVezAunqueSeConsulteMucho() {
        var m=preparar(3,7); for(int i=0;i<20;i++){assertEquals(3,m.ver(m.a).mano().size()); assertEquals(2,m.ver(m.b).mano().size());}
        assertEquals(8,m.ver(m.a).ideas());
        var evento=m.ver(m.b).eventos().stream().filter(e->e.tipo().equals("habilidad.investigador_principal")).findFirst().orElseThrow();
        assertEquals(m.a.nombre(),evento.actor()); assertNull(evento.objetivo());
    }
    @Test void decanaProtegeAntesDeSuTurnoSinEnviarSuRol() {
        var m=preparar(1,4); assertNull(m.ver(m.a).jugadores().get(1).rol());
        m.actuar(m.a,"HABILIDAD",null,m.b.personaje().nombre());
        m.actuar(m.a,"FIN_TURNO",null,null);
        assertEquals(m.b.nombre(),m.ver(m.b).actual());
        assertEquals("TURNO_JUGADOR",m.ver(m.b).fase());
    }
    @Test void editorialEsAutomaticaYNoOfreceCompraDeTrabajo() {
        var m=preparar(5,7); estudio(m.a,2); m.a.sumarMonedas(4);
        var habilidad=m.ver(m.a).acciones().stream().filter(a->a.id().equals("HABILIDAD")).findFirst().orElseThrow();
        assertFalse(habilidad.disponible()); assertTrue(habilidad.opciones().isEmpty());
        assertTrue(m.ver(m.a).jugadores().get(0).rol().automatica());
        assertThrows(IllegalArgumentException.class,()->m.actuar(m.a,"HABILIDAD",0,null));
        assertEquals(0,m.a.estudios().get(0).trabajoAcumulado());
        assertEquals(6,m.a.monedas());
    }
    @Test void revisorReabrePublicacionesDesdeLasOpcionesWeb() {
        var m=preparar(7,6); estudio(m.b,3); m.b.trabajarEstudio(0,3);
        var habilidad=m.ver(m.a).acciones().stream().filter(a->a.id().equals("HABILIDAD")).findFirst().orElseThrow();
        assertTrue(habilidad.disponible());
        assertTrue(habilidad.opciones().stream().anyMatch(o->m.b.nombre().equals(o.objetivo()) && o.indice()==0));
        m.actuar(m.a,"HABILIDAD",0,m.b.nombre());
        assertEquals(1,m.b.estudios().get(0).trabajoAcumulado());
        assertEquals(0,m.b.cantidadPublicados()); assertEquals(0,m.b.prestigio());
        assertFalse(m.ver(m.b).jugadores().get(1).estudios().get(0).publicado());
    }
    @Test void preDoctoralAportaDosPuntos() {
        var m=preparar(6,7); estudio(m.a,2); m.actuar(m.a,"TRABAJAR",0,null);
        assertEquals(2,m.a.estudios().get(0).trabajoAcumulado()); assertEquals(1,m.a.cantidadPublicados());
    }
    @Test void revisorValidaObjetivoYQuitaTrabajoPublico() {
        var m=preparar(7,6); estudio(m.b,3); m.b.trabajarEstudio(0,1);
        assertThrows(IllegalArgumentException.class,()->m.actuar(m.a,"HABILIDAD",0,"Intruso"));
        m.actuar(m.a,"HABILIDAD",0,m.b.nombre()); assertEquals(0,m.b.estudios().get(0).trabajoAcumulado());
        assertEquals(1,m.a.monedas()); assertEquals(0,m.ver(m.b).jugadores().get(1).estudios().get(0).trabajo());
    }
}
