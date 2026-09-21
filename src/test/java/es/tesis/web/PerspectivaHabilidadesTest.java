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
    @Test void vetoPrivadoUsaCatalogoYRevelaSoloJugadorAlResolver() {
        var m=preparar(1,6);
        var opciones=m.ver(m.a).acciones().stream().filter(a->a.id().equals("HABILIDAD")).findFirst().orElseThrow().opciones();
        assertEquals(6,opciones.size());
        for(var opcion:opciones) {
            var original=FabricaMazos.crearRoles().cartas().stream().filter(r->r.nombre().equals(opcion.objetivo())).findFirst().orElseThrow();
            assertEquals(CatalogoVisual.rol(original,-1),opcion.rol());
        }
        assertTrue(m.ver(m.b).acciones().isEmpty());
        m.actuar(m.a,"HABILIDAD",null,"Pre-Doctoral");
        var antes=m.ver(m.b).eventos();
        assertFalse(new Gson().toJson(antes).contains("Pre-Doctoral"));
        assertFalse(antes.stream().anyMatch(e->e.tipo().equals("turno.vetado")));
        assertNull(m.ver(m.a).jugadores().get(1).rol());
        m.actuar(m.a,"FIN_TURNO",null,null);
        var despues=m.ver(m.b).eventos();
        assertEquals(despues,m.ver(m.a).eventos());
        var veto=despues.stream().filter(e->e.tipo().equals("turno.vetado")).toList();
        assertEquals(1,veto.size()); assertEquals(m.b.nombre(),veto.get(0).actor());
        assertTrue(veto.get(0).numero()>antes.get(antes.size()-1).numero());
        assertNull(veto.get(0).rolPublico());
        assertNull(m.ver(m.a).jugadores().get(1).rol());
        for(int i=0;i<10;i++) assertEquals(despues,m.ver(m.b).eventos());
        assertEquals("FIN_RONDA",m.ver(m.a).fase());
    }
    @Test void eventoDeTurnoConservaSuCartaPublicaAunqueCambieLaRonda() {
        var m=preparar(2,7);
        var inicio=m.ver(m.a).eventos().stream().filter(e->e.tipo().equals("fase.turno")).findFirst().orElseThrow();
        assertEquals(CatalogoVisual.rol(m.a.personaje(),-1),inicio.rolPublico());
        assertNull(m.ver(m.a).jugadores().get(1).rol());
        assertTrue(m.ver(m.a).eventos().stream().filter(e->!e.tipo().equals("fase.turno")).allMatch(e->e.rolPublico()==null));
        m.actuar(m.a,"FIN_TURNO",null,null);
        var siguiente=m.ver(m.b).eventos().stream().filter(e->e.tipo().equals("fase.turno")).reduce((a,b)->b).orElseThrow();
        assertEquals(CatalogoVisual.rol(m.b.personaje(),-1),siguiente.rolPublico());
        m.actuar(m.b,"FIN_TURNO",null,null);
        m.actuar(m.b,"SIGUIENTE_RONDA",null,null);
        assertTrue(m.ver(m.a).eventos().contains(inicio));
        assertTrue(m.ver(m.a).eventos().contains(siguiente));
        assertEquals(m.ver(m.a).eventos(),m.ver(m.b).eventos());
    }
    @Test void eventosVisualesSonPublicosEstablesYPrecisosConArticulosDuplicados() {
        var m=preparar(6,7);
        estudio(m.a,2); estudio(m.a,2);
        m.actuar(m.a,"TRABAJAR",1,null);
        var a=m.ver(m.a); var b=m.ver(m.b);
        var e=a.eventos().get(a.eventos().size()-1);
        assertEquals("accion.trabajar",e.tipo()); assertEquals(1,e.estudio());
        assertEquals(2,e.cantidad()); assertTrue(e.publicacion()); assertFalse(e.robo());
        assertEquals(a.eventos(),b.eventos());
        for(int i=0;i<10;i++) assertEquals(b.eventos(),m.ver(m.b).eventos());
        assertThrows(IllegalArgumentException.class,()->m.actuar(m.a,"TRABAJAR",99,null));
        assertEquals(a.eventos(),m.ver(m.a).eventos());
    }
    @Test void cobrarPensarEIniciarNoIncluyenIndiceDeManoNiCartaRobada() {
        var m=preparar(2,7);
        m.actuar(m.a,"COBRAR",null,null);
        var eventos=m.ver(m.b).eventos(); var cobrar=eventos.get(eventos.size()-1);
        assertEquals(2,cobrar.cantidad()); assertNull(cobrar.estudio());
        m.actuar(m.a,"PENSAR",null,null);
        eventos=m.ver(m.b).eventos(); var pensar=eventos.get(eventos.size()-1);
        assertTrue(pensar.robo()); assertNull(pensar.estudio()); assertNull(pensar.objetivo());
        assertEquals(cobrar.numero()+1,pensar.numero());
        assertEquals(m.ver(m.a).eventos(),eventos);
        var nueva=preparar(6,7);
        nueva.a.sumarMonedas(20);
        nueva.actuar(nueva.a,"INICIAR",1,null);
        var inicio=nueva.ver(nueva.b).eventos();
        assertEquals(0,inicio.get(inicio.size()-1).estudio());
        assertFalse(new Gson().toJson(inicio).contains("mano"));
    }
    @Test void revisionIdentificaPropietarioYComiteNuncaResuelveRolAJugador() {
        var m=preparar(7,6); estudio(m.b,3); estudio(m.b,3); m.b.trabajarEstudio(1,3);
        m.actuar(m.a,"HABILIDAD",1,m.b.nombre());
        var eventos=m.ver(m.b).eventos(); var revision=eventos.get(eventos.size()-1);
        assertEquals(m.b.nombre(),revision.objetivo()); assertEquals(1,revision.estudio());
        var comite=preparar(1,6);
        comite.actuar(comite.a,"HABILIDAD",null,"Pre-Doctoral");
        eventos=comite.ver(comite.b).eventos(); var veto=eventos.get(eventos.size()-1);
        assertNull(veto.objetivo()); assertNull(veto.estudio()); assertFalse(veto.robo());
        assertEquals(comite.ver(comite.a).eventos(),eventos);
    }
    @Test void revisorValidaObjetivoYQuitaTrabajoPublico() {
        var m=preparar(7,6); estudio(m.b,3); m.b.trabajarEstudio(0,1);
        assertThrows(IllegalArgumentException.class,()->m.actuar(m.a,"HABILIDAD",0,"Intruso"));
        m.actuar(m.a,"HABILIDAD",0,m.b.nombre()); assertEquals(0,m.b.estudios().get(0).trabajoAcumulado());
        assertEquals(1,m.a.monedas()); assertEquals(0,m.ver(m.b).jugadores().get(1).estudios().get(0).trabajo());
    }
}
