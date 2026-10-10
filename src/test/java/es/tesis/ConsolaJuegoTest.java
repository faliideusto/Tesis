package es.tesis;

import es.tesis.acciones.*;
import es.tesis.consola.ConsolaJuego;
import es.tesis.dominio.*;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.habilidades.*;
import es.tesis.motor.*;
import es.tesis.persistencia.SerializadorPartidaJson;
import es.tesis.reglas.ReglasAcademicas;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ConsolaJuegoTest {
    @TempDir Path temporal;

    private MotorJuego preparar(boolean seleccionar, HabilidadPersonaje... habilidades) {
        var roles = new ArrayList<Personaje>();
        var jugadores = new ArrayList<Jugador>();
        var ideas = new ArrayList<IdeaCarta>();
        for (int i = 0; i < Math.max(3, habilidades.length); i++) {
            roles.add(new Personaje("Personaje " + i, i + 1, i < habilidades.length ? habilidades[i] : new PreDoctoralHabilidad()));
            jugadores.add(new Jugador("Persona " + i));
        }
        roles.add(new Personaje("Otro descarte", 98, new PreDoctoralHabilidad()));
        roles.add(new Personaje("Descartado", 99, new PreDoctoralHabilidad()));
        for (int i = 0; i < 8; i++) ideas.add(new IdeaCarta("Artículo " + i, 1, 2, 5));
        var mazo = new Mazo<Personaje>(roles) {
            @Override public Personaje robarAleatoria() { return retirar(cartas().size() - 1); }
        };
        MotorJuego motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        motor.iniciarPartida(new Partida(jugadores, mazo, new Mazo<>(ideas)));
        if (seleccionar) for (int i = 0; i < Math.max(3, habilidades.length); i++) motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));
        return motor;
    }

    private String ejecutar(MotorJuego motor, String entradas) {
        var buffer = new ByteArrayOutputStream();
        new ConsolaJuego(motor, new Scanner(entradas), new PrintStream(buffer, true, StandardCharsets.UTF_8)).ejecutar();
        return buffer.toString(StandardCharsets.UTF_8);
    }

    private Jugador actor(MotorJuego motor) { return motor.contexto().jugadorActual(); }

    private void estudio(Jugador jugador, String nombre, int trabajo, int requerido) {
        jugador.iniciarEstudio(new IdeaCarta(nombre, 1, requerido, 5));
        if (trabajo > 0) jugador.trabajarEstudio(jugador.estudios().size() - 1, trabajo);
    }

    @Test void seleccionValidaEntradaCancelacionYLimiteDeAcciones() {
        var motor = preparar(false, new PreDoctoralHabilidad());
        String salida = ejecutar(motor, "abc\n-1\n99\n1\n1\n1\n3\n0\n1\n2\n1\nsalir\n");
        assertTrue(salida.contains("Introduce un número entre 1 y 3"));
        assertTrue(salida.contains("Selección cancelada"));
        assertTrue(salida.contains("ha elegido personaje"));
        assertTrue(salida.contains("roba una carta de idea"));
        assertTrue(salida.contains("Acciones base agotadas"));
        assertEquals(4, actor(motor).monedas());
        assertEquals(3, actor(motor).cartasIdea().size());
        assertEquals(2, motor.partida().accionesBaseRealizadas());
        assertTrue(actor(motor).estudios().isEmpty());
    }

    @Test void muestraEstadoDeTodosYManoSoloDelJugadorActual() {
        var motor = preparar(true, new PreDoctoralHabilidad(), new PreDoctoralHabilidad());
        Jugador rival = motor.partida().jugadores().stream().filter(j -> j != actor(motor)).findFirst().orElseThrow();
        rival.añadirCartaIdea(new IdeaCarta("Carta secreta rival", 1, 1, 1));
        estudio(rival, "Estudio público rival", 1, 3);
        String salida = ejecutar(motor, "ayuda\nestado\nmano\nestudios\nsalir\n");
        assertTrue(salida.contains("Persona 0:"));
        assertTrue(salida.contains("Persona 1:"));
        assertTrue(salida.contains("Estudio público rival | trabajo: 1/3"));
        assertTrue(salida.contains("Ideas en el mazo:"));
        assertTrue(salida.contains("guardar [nombre]"));
        assertFalse(salida.contains("Carta secreta rival"));
        assertEquals(0, motor.partida().accionesBaseRealizadas());
    }

    @Test void iniciarYTrabajarMuestranLaPublicacionYElPrestigio() {
        var motor = preparar(true, new PreDoctoralHabilidad());
        String salida = ejecutar(motor, "3\n1\n4\n1\n5\n1\n6\nsalir\n");
        assertTrue(salida.contains("pagando su coste"));
        assertTrue(salida.contains("¡Artículo publicado! Gana 5 de prestigio"));
        assertTrue(salida.contains("trabajo: 2/2 | prestigio: 5 | Publicado"));
        assertEquals(1, actor(motor).cantidadPublicados());
        assertEquals(5, actor(motor).prestigio());
    }

    @Test void filtraEstudiosPeroConservaElIndiceReal() {
        var motor = preparar(true, new PreDoctoralHabilidad());
        estudio(actor(motor), "Ya publicado", 1, 1);
        estudio(actor(motor), "Pendiente", 1, 2);
        String salida = ejecutar(motor, "4\n1\n2\nsalir\n");
        assertTrue(salida.contains("Elige uno de los estudios que aparecen en la lista"));
        assertTrue(salida.contains("«Pendiente»"));
        assertEquals(2, actor(motor).cantidadPublicados());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
    }

    @Test void editorialYEstadisticoSeleccionanSusEstudiosYNotificanResultados() {
        var editorial = preparar(true, new EditorialHabilidad());
        actor(editorial).sumarMonedas(1);
        estudio(actor(editorial), "Editorial", 1, 2);
        String avisoEditorial = ejecutar(editorial, "5\nsalir\n");
        assertTrue(avisoEditorial.contains("autom"));
        assertEquals(3, actor(editorial).monedas());
        assertEquals(1, actor(editorial).estudios().get(0).trabajoAcumulado());
        var estadistico = preparar(true, new EstadisticoHabilidad());
        estudio(actor(estadistico), "Publicado", 1, 1);
        String avisoEstadistico = ejecutar(estadistico, "5\n1\nsalir\n");
        assertTrue(avisoEstadistico.contains("añade 1 de prestigio"));
        assertTrue(avisoEstadistico.contains("Habilidad activa ya utilizada"));
        assertEquals(6, actor(estadistico).prestigio());
    }

    @Test void revisorPermiteElegirJugadorPorNumero() {
        var revisor = preparar(true, new Revisor2Habilidad(), new PreDoctoralHabilidad());
        Jugador objetivo = revisor.partida().jugadores().stream().filter(j -> j != actor(revisor)).findFirst().orElseThrow();
        estudio(objetivo, "Estudio revisable", 1, 3);
        int numero = revisor.partida().jugadores().stream().filter(j -> j != actor(revisor)).toList().indexOf(objetivo) + 1;
        String avisoRevision = ejecutar(revisor, "5\n" + numero + "\n1\nsalir\n");
        assertTrue(avisoRevision.contains("paga 1 moneda y retira 1 punto de trabajo"));
        assertEquals(0, objetivo.estudios().get(0).trabajoAcumulado());
        assertEquals(1, actor(revisor).monedas());
    }

    @Test void comiteNotificaVetoYTransicionDeRonda() {
        var motor = preparar(true, new ComiteEticaHabilidad(), new PreDoctoralHabilidad());
        String salida = ejecutar(motor, "cancelar\nguardar\ncargar\n2\n7\n7\nsalir\n");
        assertTrue(salida.contains("Primero debes nombrar un rol"));
        assertTrue(salida.indexOf("Rol que pierde el turno") < salida.indexOf("1. Cobrar"));
        assertTrue(salida.contains("nombra el rol «Personaje 1»"));
        assertTrue(salida.contains("pierde su turno por el veto"));
        assertTrue(salida.contains("Termina la ronda 1"));
        assertTrue(salida.contains("Ronda 2: comienza la selección"));
        assertEquals(2, motor.partida().ronda());
    }

    @Test void finDePartidaPermiteVerHistorialYExportarResultado() throws Exception {
        var motor = preparar(true, new PreDoctoralHabilidad());
        for (int i = 0; i < 3; i++) estudio(actor(motor), "Publicación " + i, 1, 1);
        Path archivo = temporal.resolve("resultado.json");
        String salida = ejecutar(motor, "7\n7\n7\nhistorial\nexportar " + archivo + "\nsalir\n");
        assertTrue(salida.contains("RESULTADO FINAL"));
        assertTrue(salida.contains("Ganador(es):"));
        assertTrue(salida.contains("partida.fin"));
        assertEquals(FaseDeTurno.FIN_PARTIDA, new SerializadorPartidaJson().leer(archivo).partida().fase());
    }

    @Test void sinObjetivosOFinDeEntradaNoConsumeAccionesNiDejaObservadores() {
        var motor = preparar(true, new PreDoctoralHabilidad());
        var buffer = new ByteArrayOutputStream();
        var salida = new PrintStream(buffer, true, StandardCharsets.UTF_8);
        new ConsolaJuego(motor, new Scanner("4\n5\n3\n"), salida).ejecutar();
        String texto = buffer.toString(StandardCharsets.UTF_8);
        assertTrue(texto.contains("No hay estudios válidos"));
        assertFalse(texto.contains("Esta habilidad se aplica automáticamente"));
        assertEquals(0, motor.partida().accionesBaseRealizadas());
        int longitud = buffer.size();
        motor.ejecutarAccion(new CobrarAccion());
        assertEquals(longitud, buffer.size());
    }

    @Test void importarDesdeUnSubmenuAbandonaElObjetivoAnterior() throws Exception {
        var motor = preparar(true, new PreDoctoralHabilidad());
        Path archivo = temporal.resolve("punto.json");
        new SerializadorPartidaJson().escribir(archivo, motor.guardarPartida());
        String salida = ejecutar(motor, "1\n3\nimportar " + archivo + "\n3\n1\nsalir\n");
        assertTrue(salida.contains("Partida importada"));
        assertEquals(1, actor(motor).monedas());
        assertEquals(1, actor(motor).estudios().size());
        assertEquals(1, motor.partida().accionesBaseRealizadas());
    }
}
