package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import com.google.gson.Gson;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CosmeticosPartidaTest {
    private final CuentasSupabase.Cosmetico avatar=new CuentasSupabase.Cosmetico("academia_avatar","avatar","Archivo",
            "/assets/seasons/cronicas-del-archivo/avatares/avatar-aprendiz-del-archivo.png","comun");
    private final CosmeticosPartida equipo=new CosmeticosPartida(avatar,null,null,null);

    @Test void desdeProyectaSoloEquipadosPoseidosYDelTipoCorrecto() {
        var titulo=new CuentasSupabase.Cosmetico("titulo","titulo","Custodio",null,"comun");
        var datos=new CuentasSupabase.Cosmeticos(List.of(avatar,titulo),Map.of("avatar",avatar.id(),"marco",avatar.id(),"titulo",titulo.id(),"reverso","no_poseido"),List.of(),List.of());
        var vista=CosmeticosPartida.desde(datos);assertEquals(avatar,vista.avatar());assertNull(vista.marco());assertNull(vista.reverso());assertNull(vista.interaccion());
        assertFalse(new Gson().toJson(vista).contains("Custodio"));
    }
    @Test void desdeSinInventarioOEquipamientoUsaOriginales() {
        assertEquals(CosmeticosPartida.originales(),CosmeticosPartida.desde(null));
        assertEquals(CosmeticosPartida.originales(),CosmeticosPartida.desde(new CuentasSupabase.Cosmeticos(null,null,List.of(),List.of())));
        assertEquals(CosmeticosPartida.originales(),CosmeticosPartida.desde(new CuentasSupabase.Cosmeticos(List.of(avatar),Map.of(),List.of(),List.of())));
    }

    @Test void salaProyectaSoloCuatroEquipadosYOriginalesDeInvitados() {
        var gestor=new GestorSalas();UUID cuenta=UUID.randomUUID();
        var host=gestor.crear("Ada",cuenta,equipo);var sala=gestor.buscar(host.codigo());
        var invitado=sala.unirse("Lin",null,equipo);sala.unirse("Sol");
        sala.iniciar(host.playerToken(),sala.estado(host.playerToken()).revision());
        for(String token:List.of(host.playerToken(),invitado.playerToken())) {
            var vista=sala.estado(token);var ada=vista.partida().jugadores().stream().filter(j->j.nombre().equals("Ada")).findFirst().orElseThrow();
            assertEquals(equipo,ada.cosmeticos());
            assertEquals(CosmeticosPartida.originales(),vista.partida().jugadores().stream().filter(j->j.nombre().equals("Lin")).findFirst().orElseThrow().cosmeticos());
            String json=new Gson().toJson(vista);assertFalse(json.contains(cuenta.toString()));assertFalse(json.contains("inventario"));assertFalse(json.contains("equipamiento"));
            assertFalse(json.contains("titulo"));assertFalse(json.contains("placa"));assertFalse(json.contains(host.playerToken()));
        }
    }
    @Test void matchmakingConservaSnapshotAutenticadoHastaAsignarMesa() {
        var gestor=new GestorMatchmaking(new GestorSalas());List<String> tokens=new ArrayList<>();
        for(int i=0;i<3;i++) {String token=UUID.randomUUID().toString();tokens.add(token);gestor.buscar(token,"Jugador "+i,3,UUID.randomUUID(),i==0?equipo:CosmeticosPartida.originales());}
        for(String token:tokens)gestor.confirmar(token,gestor.estado(token).grupo());
        for(String token:tokens) {
            var jugadores=gestor.estado(token).acceso().sala().partida().jugadores();
            assertEquals(equipo,jugadores.stream().filter(j->j.nombre().equals("Jugador 0")).findFirst().orElseThrow().cosmeticos());
        }
    }
    @Test void invitacionAplicaEquipoDelDestinatarioAlAceptar() {
        var salas=new GestorSalas();UUID anfitrion=UUID.randomUUID(),destino=UUID.randomUUID();
        var host=salas.crear("Host",anfitrion);var invitaciones=new GestorInvitaciones(salas);
        var enviada=invitaciones.enviar(host.codigo(),host.playerToken(),anfitrion,destino);
        var unido=invitaciones.aceptar(enviada.id(),destino,"Ada",equipo);var sala=salas.buscar(host.codigo());sala.unirse("Lin");
        sala.iniciar(host.playerToken(),sala.estado(host.playerToken()).revision());
        assertEquals(equipo,sala.estado(unido.playerToken()).partida().jugadores().stream().filter(j->j.nombre().equals("Ada")).findFirst().orElseThrow().cosmeticos());
    }
}
