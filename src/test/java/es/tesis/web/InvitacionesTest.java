package es.tesis.web;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class InvitacionesTest {
    static class Reloj extends Clock {
        Instant ahora = Instant.parse("2026-10-07T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return ahora; }
    }
    private final UUID host = UUID.randomUUID(), amigo = UUID.randomUUID(), otro = UUID.randomUUID();
    private final Reloj reloj = new Reloj();
    private final GestorSalas salas = new GestorSalas(reloj,Duration.ofHours(24));
    private final GestorInvitaciones invitaciones = new GestorInvitaciones(salas,reloj);

    @Test void anfitrionVinculadoDestinatarioYConsumoUnicoSinTokensEnBandeja() {
        var acceso = salas.crear("Ada",host); var sala = salas.buscar(acceso.codigo());
        var invitado = sala.unirse("Otro",otro);
        assertEquals(403,assertThrows(ErrorSala.class,()->invitaciones.enviar(acceso.codigo(),invitado.playerToken(),otro,amigo)).estado);
        assertEquals(403,assertThrows(ErrorSala.class,()->invitaciones.enviar(acceso.codigo(),acceso.playerToken(),otro,amigo)).estado);
        assertEquals(401,assertThrows(ErrorSala.class,()->invitaciones.enviar(acceso.codigo(),"perdido",host,amigo)).estado);
        var envio = invitaciones.enviar(acceso.codigo(),acceso.playerToken(),host,amigo);
        assertEquals(envio,invitaciones.enviar(acceso.codigo(),acceso.playerToken(),host,amigo));
        assertEquals(1,invitaciones.listar(amigo).invitaciones().size());
        assertTrue(invitaciones.listar(otro).invitaciones().isEmpty());
        String json = new com.google.gson.Gson().toJson(invitaciones.listar(amigo));
        assertFalse(json.contains(host.toString())); assertFalse(json.contains(acceso.playerToken()));
        assertEquals(404,assertThrows(ErrorSala.class,()->invitaciones.aceptar(envio.id(),otro,"Falso")).estado);
        assertEquals(404,assertThrows(ErrorSala.class,()->invitaciones.rechazar(envio.id(),otro)).estado);
        var unido = invitaciones.aceptar(envio.id(),amigo,"Lin");
        assertEquals("Lin",unido.sala().yo()); assertFalse(unido.sala().soyAnfitrion());
        assertEquals(404,assertThrows(ErrorSala.class,()->invitaciones.aceptar(envio.id(),amigo,"Lin")).estado);
        assertTrue(invitaciones.listar(amigo).invitaciones().isEmpty());
    }
    @Test void caducidadInicioLlenaYEntradaManualInvalidanInvitacion() {
        for (String cambio : List.of("tiempo","inicio","llena","manual","salaCaducada")) {
            var acceso = salas.crear("Ada",host); var sala = salas.buscar(acceso.codigo());
            var envio = invitaciones.enviar(acceso.codigo(),acceso.playerToken(),host,amigo);
            switch(cambio) {
                case "tiempo" -> reloj.ahora = reloj.ahora.plusSeconds(300);
                case "inicio" -> { sala.unirse("A");sala.unirse("B");sala.iniciar(acceso.playerToken(),sala.estado(acceso.playerToken()).revision()); }
                case "llena" -> {for(int i=0;i<4;i++)sala.unirse("Invitado"+i);}
                case "manual" -> sala.unirse("Lin",amigo);
                case "salaCaducada" -> reloj.ahora = reloj.ahora.plus(Duration.ofHours(25));
            }
            assertTrue(invitaciones.listar(amigo).invitaciones().isEmpty(),cambio);
            assertEquals(404,assertThrows(ErrorSala.class,()->invitaciones.aceptar(envio.id(),amigo,"Lin")).estado,cambio);
        }
    }
    @Test void concurrenciaSoloEntregaUnaIdentidadYCruceDeSalasNoAceptaTokenAjeno() throws Exception {
        var a=salas.crear("Ada",host);var b=salas.crear("Sol",otro);
        assertEquals(401,assertThrows(ErrorSala.class,()->invitaciones.enviar(b.codigo(),a.playerToken(),host,amigo)).estado);
        var envio=invitaciones.enviar(a.codigo(),a.playerToken(),host,amigo);
        var pool=Executors.newFixedThreadPool(2);
        try {
            var tareas=pool.invokeAll(List.of((Callable<Integer>)()->{try{invitaciones.aceptar(envio.id(),amigo,"Lin");return 200;}catch(ErrorSala e){return e.estado;}},
                    ()->{try{invitaciones.aceptar(envio.id(),amigo,"Lin");return 200;}catch(ErrorSala e){return e.estado;}}));
            assertEquals(Set.of(200,404),Set.of(tareas.get(0).get(),tareas.get(1).get()));
            assertEquals(2,salas.buscar(a.codigo()).estado(a.playerToken()).jugadores().size());
        } finally {pool.shutdownNow();}
    }
    @Test void limitePorDestinatarioYRechazoLiberanMemoria() {
        var envios=new ArrayList<GestorInvitaciones.Envio>();
        for(int i=0;i<20;i++) {var a=salas.crear("Ada",host);envios.add(invitaciones.enviar(a.codigo(),a.playerToken(),host,amigo));}
        var extra=salas.crear("Ada",host);
        assertEquals(409,assertThrows(ErrorSala.class,()->invitaciones.enviar(extra.codigo(),extra.playerToken(),host,amigo)).estado);
        invitaciones.rechazar(envios.get(0).id(),amigo);
        invitaciones.enviar(extra.codigo(),extra.playerToken(),host,amigo);
        assertEquals(20,invitaciones.listar(amigo).invitaciones().size());
    }

    @Test void rechazoNoPermiteReenviarEnBucleYCooldownCaduca() {
        var a=salas.crear("Ada",host);
        var envio=invitaciones.enviar(a.codigo(),a.playerToken(),host,amigo);
        invitaciones.rechazar(envio.id(),amigo);
        assertEquals(409,assertThrows(ErrorSala.class,()->invitaciones.enviar(a.codigo(),a.playerToken(),host,amigo)).estado);
        reloj.ahora=reloj.ahora.plusSeconds(60);
        assertNotEquals(envio.id(),invitaciones.enviar(a.codigo(),a.playerToken(),host,amigo).id());
    }
}
