package es.ciudadela.web;

import com.google.gson.Gson;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SesionJuegoTest {
    private record Mesa(SesionJuego juego, Vistas.Estado estado) {}

    private Mesa conRol(int orden) {
        for (int intento=0; intento<100; intento++) {
            var juego = new SesionJuego();
            var s = juego.crear(List.of("Ana")); s = juego.revelar(s.revision());
            var elegido = s.seleccion().stream().filter(r -> r.orden()==orden).findFirst();
            if(elegido.isPresent()) {
                s=action(juego,s,"SELECCIONAR",elegido.get().indice(),null);
                return new Mesa(juego,juego.revelar(s.revision()));
            }
        }
        throw new AssertionError("El descarte aleatorio no conservó el rol solicitado en 100 mesas.");
    }
    private Vistas.Estado action(SesionJuego juego, Vistas.Estado s, String tipo, Integer indice, String objetivo) {
        return juego.actuar(new Vistas.Peticion(s.revision(), tipo, indice, objetivo, null));
    }
    private Vistas.Estado turnos(SesionJuego juego, Vistas.Estado s) {
        while (s.fase().equals("SELECCION_ROLES")) {
            if (s.bloqueada()) s = juego.revelar(s.revision());
            var elegido = s.seleccion().stream().filter(r -> r.orden() != 1).findFirst().orElseThrow();
            s = action(juego, s, "SELECCIONAR", elegido.indice(), null);
        }
        return s.bloqueada() ? juego.revelar(s.revision()) : s;
    }

    @ParameterizedTest @ValueSource(ints={1,2,3,4,5})
    void creaTodosLosTamanyosValidosSinAlterarElMazo(int cantidad) {
        var juego = new SesionJuego();
        var nombres = java.util.stream.IntStream.range(0,cantidad).mapToObj(i -> "Persona " + i).toList();
        var s = juego.crear(nombres);
        assertEquals(cantidad,s.jugadores().size());
        assertEquals(10-2*cantidad,s.ideas());
        assertEquals(7,s.roles());
        assertTrue(s.bloqueada()); assertTrue(s.mano().isEmpty()); assertTrue(s.seleccion().isEmpty());
        assertTrue(s.jugadores().stream().allMatch(j -> j.monedas()==2 && j.cartas()==2 && j.rol()==null));
    }

    @Test void rechazaConfiguracionesInvalidasSinSustituirLaMesa() {
        var juego = new SesionJuego(); var original = juego.crear(List.of("Ana","Bruno"));
        for (var nombres : List.of(List.<String>of(),List.of("Ana","ANA"),List.of(" ","B"),List.of("A","B","C","D","E","F")))
            assertThrows(IllegalArgumentException.class,() -> juego.crear(nombres));
        assertEquals(original,juego.estado());
    }

    @Test void cambioDeSelectorNoEntregaLaManoNiElRolDelSiguiente() {
        var juego = new SesionJuego(); var s = juego.crear(List.of("Ana","Bruno"));
        final var bloqueado = s;
        assertThrows(IllegalStateException.class,() -> action(juego,bloqueado,"SELECCIONAR",0,null));
        s = juego.revelar(s.revision());
        assertEquals(2,s.mano().size()); assertEquals(7,s.seleccion().size());
        String primero = s.actual(); String secreto = s.seleccion().get(0).nombre();
        s = action(juego,s,"SELECCIONAR",0,null);
        assertNotEquals(primero,s.actual()); assertTrue(s.bloqueada());
        assertTrue(s.mano().isEmpty()); assertTrue(s.seleccion().isEmpty()); assertTrue(s.acciones().isEmpty());
        assertTrue(s.jugadores().stream().allMatch(j -> j.rol()==null));
        assertFalse(new Gson().toJson(s).contains(secreto));
        s = juego.revelar(s.revision());
        assertEquals(2,s.mano().size()); assertEquals(6,s.seleccion().size());
    }

    @Test void limiteDeAccionesYVersionEvitanDobleEnvio() {
        var juego = new SesionJuego(); var s = turnos(juego,juego.crear(List.of("Ana","Bruno")));
        var anterior = s;
        s = action(juego,s,"COBRAR",null,null);
        assertThrows(SesionJuego.Conflicto.class,() -> action(juego,anterior,"COBRAR",null,null));
        assertEquals(1,s.accionesRestantes());
        s = action(juego,s,"COBRAR",null,null);
        final var agotado = s;
        assertFalse(s.acciones().stream().filter(a -> a.id().equals("COBRAR")).findFirst().orElseThrow().disponible());
        assertThrows(IllegalStateException.class,() -> action(juego,agotado,"COBRAR",null,null));
        assertEquals(agotado,juego.estado());
        s = action(juego,s,"FIN_TURNO",null,null);
        assertTrue(s.bloqueada()); assertEquals(2,s.accionesRestantes()); assertTrue(s.mano().isEmpty());
    }

    @Test void indicesInvalidosNoConsumenRecursosYNoPublicanSecretos() {
        var juego = new SesionJuego(); var s = turnos(juego,juego.crear(List.of("Ana","Bruno")));
        assertThrows(IllegalArgumentException.class,() -> action(juego,s,"INICIAR",-1,null));
        assertThrows(IllegalArgumentException.class,() -> action(juego,s,"TRABAJAR",99,null));
        assertEquals(s,juego.estado());
        var dto = new Gson().toJsonTree(s).getAsJsonObject();
        for (var jugador : dto.getAsJsonArray("jugadores")) {
            assertFalse(jugador.getAsJsonObject().has("mano"));
            assertFalse(jugador.getAsJsonObject().has("cartasIdea"));
        }
        assertFalse(dto.has("rolesDisponibles")); assertFalse(dto.has("ideasDisponibles"));
    }

    @Test void comiteObligatorioSeConectaAntesDeAcciones() {
        // El descarte es aleatorio: buscar una mesa que conserve el Comité, sin cambiar reglas.
        SesionJuego juego = null; Vistas.Estado s = null;
        for (int intento=0;intento<100;intento++) {
            juego = new SesionJuego(); s = juego.crear(List.of("Ana")); s = juego.revelar(s.revision());
            if(s.seleccion().stream().anyMatch(r -> r.orden()==1)) break;
        }
        assertNotNull(juego);
        int indice = s.seleccion().stream().filter(r -> r.orden()==1).findFirst().orElseThrow().indice();
        s = action(juego,s,"SELECCIONAR",indice,null); s = juego.revelar(s.revision());
        assertTrue(s.habilidadPendiente());
        assertTrue(s.acciones().stream().filter(a -> !a.id().equals("HABILIDAD")).noneMatch(Vistas.Accion::disponible));
        s = action(juego,s,"HABILIDAD",null,"Decana");
        assertFalse(s.habilidadPendiente()); assertEquals(2,s.accionesRestantes());
        assertTrue(s.acciones().stream().filter(a -> a.id().equals("COBRAR")).findFirst().orElseThrow().disponible());
    }

    @Test void partidaRealCompletaPublicaAvanzaRondasYObtieneGanadores() {
        var juego = new SesionJuego(); var s = juego.crear(List.of("Ana","Bruno"));
        boolean publicado = false; boolean finRonda = false;
        for (int paso=0;paso<1200 && !s.fase().equals("FIN_PARTIDA");paso++) {
            if (s.bloqueada()) { s=juego.revelar(s.revision()); continue; }
            if (s.fase().equals("SELECCION_ROLES")) {
                var rol = s.seleccion().stream().filter(r -> r.orden()!=1 && r.orden()!=3)
                        .min(Comparator.comparingInt(r -> r.orden()==7 ? 0 : r.orden()==4 ? 1 : r.orden()+10)).orElseThrow();
                s=action(juego,s,"SELECCIONAR",rol.indice(),null); continue;
            }
            if (s.fase().equals("FIN_RONDA")) { finRonda=true; s=action(juego,s,"SIGUIENTE_RONDA",null,null); continue; }
            var acciones = s.acciones();
            Vistas.Accion elegida = null;
            for(String id:List.of("TRABAJAR","INICIAR","PENSAR","COBRAR","FIN_TURNO")) {
                elegida=acciones.stream().filter(a -> a.id().equals(id) && a.disponible()).findFirst().orElse(null);
                if(elegida!=null) break;
            }
            assertNotNull(elegida);
            var opcion = elegida.opciones().isEmpty() ? new Vistas.Opcion("",null,null) : elegida.opciones().get(0);
            s=action(juego,s,elegida.id(),opcion.indice(),opcion.objetivo());
            publicado |= s.jugadores().stream().anyMatch(j -> j.publicados()>0);
        }
        assertTrue(publicado); assertTrue(finRonda); assertTrue(s.ronda()>1);
        assertEquals("FIN_PARTIDA",s.fase()); assertFalse(s.ganadores().isEmpty());
        int maximo=s.jugadores().stream().mapToInt(Vistas.Jugador::prestigio).max().orElseThrow();
        final var resultado=s;
        assertTrue(s.jugadores().stream().filter(j -> resultado.ganadores().contains(j.nombre())).allMatch(j -> j.prestigio()==maximo));
        assertThrows(IllegalStateException.class,() -> action(juego,resultado,"COBRAR",null,null));
    }

    @Test void editorialPublicaConHabilidadDespuesDeConsumirAcciones() {
        var mesa=conRol(6); var juego=mesa.juego(); var s=mesa.estado();
        s=action(juego,s,"INICIAR",0,null); s=action(juego,s,"COBRAR",null,null);
        assertEquals(0,s.accionesRestantes());
        var habilidad=s.acciones().stream().filter(a -> a.id().equals("HABILIDAD")).findFirst().orElseThrow();
        assertTrue(habilidad.disponible()); assertEquals(0,habilidad.opciones().get(0).indice());
        s=action(juego,s,"HABILIDAD",0,null);
        assertEquals(0,s.jugadores().get(0).monedas()); assertEquals(1,s.jugadores().get(0).publicados());
        assertTrue(s.eventos().stream().anyMatch(Vistas.Evento::publicacion));
        assertEquals(0,s.accionesRestantes());
    }

    @Test void estadisticoBonificaPublicacionDesdeLasOpcionesWeb() {
        var mesa=conRol(2); var juego=mesa.juego(); var s=mesa.estado();
        assertFalse(s.acciones().stream().filter(a -> a.id().equals("HABILIDAD")).findFirst().orElseThrow().disponible());
        s=action(juego,s,"INICIAR",0,null); s=action(juego,s,"TRABAJAR",0,null);
        s=action(juego,s,"HABILIDAD",0,null);
        assertEquals(2,s.jugadores().get(0).prestigio());
        assertEquals(1,s.jugadores().get(0).estudios().get(0).prestigioExtra());
        assertFalse(s.acciones().stream().filter(a -> a.id().equals("HABILIDAD")).findFirst().orElseThrow().disponible());
    }

    @Test void automaticasConservanRoboTrabajoEInmunidad() {
        var investigador=conRol(4);
        assertEquals(3,investigador.estado().mano().size()); assertEquals(7,investigador.estado().ideas());
        var pre=conRol(7); var s=action(pre.juego(),pre.estado(),"INICIAR",0,null);
        s=action(pre.juego(),s,"TRABAJAR",0,null);
        assertEquals(2,s.jugadores().get(0).estudios().get(0).trabajo());
        assertEquals(1,s.jugadores().get(0).publicados());
        for(var estado:List.of(investigador.estado(),pre.estado(),conRol(5).estado())) {
            assertTrue(estado.jugadores().get(0).rol().automatica());
            assertFalse(estado.acciones().stream().filter(a -> a.id().equals("HABILIDAD")).findFirst().orElseThrow().disponible());
        }
    }

    @Test void revisorMantieneObjetivoEIndiceYRechazaTrabajoInexistente() {
        var mesa=conRol(8); var juego=mesa.juego(); var s=mesa.estado();
        s=action(juego,s,"PENSAR",null,null); // Casos y Controles requiere dos puntos.
        s=action(juego,s,"INICIAR",2,null);
        s=action(juego,s,"FIN_TURNO",null,null); s=action(juego,s,"SIGUIENTE_RONDA",null,null);
        // Esperar una ronda en la que el Revisor no se descarte, sin alterar el mazo.
        for(int ronda=0;ronda<100;ronda++) {
            s=juego.revelar(s.revision());
            var revisor=s.seleccion().stream().filter(r -> r.orden()==8).findFirst();
            if(revisor.isPresent()) { s=action(juego,s,"SELECCIONAR",revisor.get().indice(),null); s=juego.revelar(s.revision()); break; }
            var otro=s.seleccion().stream().filter(r -> r.orden()!=1).findFirst().orElseThrow();
            s=action(juego,s,"SELECCIONAR",otro.indice(),null); s=juego.revelar(s.revision());
            s=action(juego,s,"FIN_TURNO",null,null); s=action(juego,s,"SIGUIENTE_RONDA",null,null);
        }
        s=action(juego,s,"COBRAR",null,null); s=action(juego,s,"TRABAJAR",0,null);
        var habilidad=s.acciones().stream().filter(a -> a.id().equals("HABILIDAD")).findFirst().orElseThrow();
        assertTrue(habilidad.disponible()); assertEquals("Ana",habilidad.opciones().get(0).objetivo());
        s=action(juego,s,"HABILIDAD",0,"Ana");
        assertEquals(0,s.jugadores().get(0).estudios().get(0).trabajo());
        assertEquals(1,s.jugadores().get(0).monedas());
    }

    @Test void catalogoUsaDatosRealesYTodosSusAssetsExisten() {
        for(var c:es.ciudadela.dominio.FabricaMazos.crearIdeas().cartas()) {
            var dto=CatalogoVisual.carta(c,0);
            assertNotNull(getClass().getResource("/static/assets/Ciudadelas-assets/"+dto.arte()));
            assertNotNull(getClass().getResource("/static/assets/Ciudadelas-assets/"+dto.marco()));
            assertEquals(c.costeMonedas(),dto.coste()); assertEquals(c.trabajoRequerido(),dto.trabajo());
            if(c.nombre().equals("Ensayo Comunitario")) { assertEquals(8,dto.coste()); assertEquals(4,dto.trabajo()); }
        }
        for(var r:es.ciudadela.dominio.FabricaMazos.crearRoles().cartas()) {
            var dto=CatalogoVisual.rol(r,0);
            assertNotNull(getClass().getResource("/static/assets/Ciudadelas-assets/"+dto.arte()));
            assertEquals(r.ordenTurno(),dto.orden());
        }
    }
}
