package es.ciudadela;

import es.ciudadela.acciones.SeleccionarPersonajeAccion;
import es.ciudadela.dominio.IdeaCarta;
import es.ciudadela.dominio.Jugador;
import es.ciudadela.dominio.Mazo;
import es.ciudadela.dominio.Partida;
import es.ciudadela.dominio.Personaje;
import es.ciudadela.eventos.BusEventosSimple;
import es.ciudadela.eventos.EventoJuego;
import es.ciudadela.eventos.ObservadorJuego;
import es.ciudadela.habilidades.ComiteEticaHabilidad;
import es.ciudadela.habilidades.DecanaHabilidad;
import es.ciudadela.habilidades.EstadisticoHabilidad;
import es.ciudadela.habilidades.EditorialHabilidad;
import es.ciudadela.habilidades.InvestigadorPrincipalHabilidad;
import es.ciudadela.habilidades.PlagiadorHabilidad;
import es.ciudadela.habilidades.PreDoctoralHabilidad;
import es.ciudadela.habilidades.Revisor2Habilidad;
import es.ciudadela.motor.MotorJuego;
import es.ciudadela.motor.MotorJuegoImpl;
import es.ciudadela.reglas.ReglasAcademicas;

import java.util.List;

public final class Main {

    private Main() {
    }

    public static void main(String[] args) {

        var jugadores = List.of(
                new Jugador("Ana"),
                new Jugador("Bruno")
        );

        var mazoIdeas = new Mazo<>(List.of(
                new IdeaCarta("Artículo Ecológico", 1, 1, 1),
                new IdeaCarta("Artículo Transversal", 2, 1, 2),
                new IdeaCarta("Casos y Controles", 2, 2, 3),
                new IdeaCarta("Cohortes", 3, 3, 5),
                new IdeaCarta("Ensayo Clínico Aleatorizado", 4, 4, 7),
                new IdeaCarta("Ensayo Comunitario", 8, 4, 9),
                new IdeaCarta("Revisión Sistemática", 2, 5, 6),
                new IdeaCarta("Serie de Casos", 1, 2, 2),
                new IdeaCarta("Metaanálisis", 4, 4, 8),
                new IdeaCarta("Estudio Piloto", 1, 1, 1)
        ));

        var mazoRoles = new Mazo<>(List.of(
                new Personaje("Comité de Ética", 1, new ComiteEticaHabilidad()),
                new Personaje("Estadístico", 2, new EstadisticoHabilidad()),
                new Personaje("Plagiador", 3, new PlagiadorHabilidad()),
                new Personaje("Investigador Principal", 4, new InvestigadorPrincipalHabilidad()),
                new Personaje("Decana", 5, new DecanaHabilidad()),
                new Personaje("Editorial", 6, new EditorialHabilidad()),
                new Personaje("Pre-Doctoral", 7, new PreDoctoralHabilidad()),
                new Personaje("Revisor 2", 8, new Revisor2Habilidad())
        ));

        var partida = new Partida(jugadores, mazoRoles, mazoIdeas);

        var busEventos = new BusEventosSimple();

        busEventos.registrar(new ObservadorJuego() {
            @Override
            public void alRecibir(EventoJuego evento) {
                System.out.println(
                        "[EVENTO] " + evento.tipo() + " -> " + evento.datos()
                );
            }
        });

        MotorJuego motor = new MotorJuegoImpl(
                new ReglasAcademicas(),
                busEventos
        );

        motor.iniciarPartida(partida);

        System.out.println();
        System.out.println("=== SELECCIÓN DE PERSONAJES ===");
        System.out.println();

        System.out.println("Jugador actual: "
                + motor.contexto().jugadorActual().nombre());

        System.out.println("Personajes disponibles:");

        for (int i = 0; i < motor.partida().mazoRoles().cartas().size(); i++) {
            System.out.println(
                    (i + 1) + ". "
                            + motor.partida().mazoRoles().cartas().get(i).nombre()
            );
        }

        System.out.println();
        System.out.println("Ana elige el personaje número 2.");

        motor.ejecutarAccion(new SeleccionarPersonajeAccion(1));

        System.out.println();
        System.out.println("Ana tiene: "
                + jugadores.get(0).personaje().nombre());

        System.out.println("Ahora le toca a: "
                + motor.contexto().jugadorActual().nombre());

        System.out.println();
        System.out.println("Personajes restantes:");

        for (int i = 0; i < motor.partida().mazoRoles().cartas().size(); i++) {
            System.out.println(
                    (i + 1) + ". "
                            + motor.partida().mazoRoles().cartas().get(i).nombre()
            );
        }

        System.out.println();
        System.out.println("Bruno elige el personaje número 1.");

        motor.ejecutarAccion(new SeleccionarPersonajeAccion(0));

        System.out.println();
        System.out.println("Bruno tiene: "
                + jugadores.get(1).personaje().nombre());

        System.out.println("Ahora le toca a: "
                + motor.contexto().jugadorActual().nombre());

        System.out.println();
        System.out.println("=== ORDEN DE TURNOS ===");
        System.out.println();

        System.out.println("Jugador actual: "
                + motor.contexto().jugadorActual().nombre());

        motor.avanzarFase();

        System.out.println("Después de avanzar: "
                + motor.contexto().jugadorActual().nombre());

        motor.avanzarFase();

        System.out.println("Fase actual: "
                + motor.partida().faseActual());
    }
}