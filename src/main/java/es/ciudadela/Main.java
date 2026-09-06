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

        Jugador primerSelector = motor.contexto().jugadorActual();

        System.out.println("Jugador inicial aleatorio: "
                + primerSelector.nombre());

        System.out.println();
        System.out.println("Personajes disponibles:");

        for (int i = 0; i < motor.partida().mazoRoles().cartas().size(); i++) {
            System.out.println(
                    (i + 1) + ". "
                            + motor.partida().mazoRoles().cartas().get(i).nombre()
            );
        }

        // Buscamos Investigador Principal
        int indiceInvestigador = -1;

        for (int i = 0; i < motor.partida().mazoRoles().cartas().size(); i++) {
            if (motor.partida().mazoRoles().cartas().get(i).nombre()
                    .equals("Investigador Principal")) {

                indiceInvestigador = i;
                break;
            }
        }

        // Si ha sido el personaje descartado, no podemos hacer esta prueba
        if (indiceInvestigador == -1) {
            System.out.println();
            System.out.println("Investigador Principal ha sido descartado.");
            System.out.println("Ejecuta el programa otra vez para repetir la prueba.");
            return;
        }

        System.out.println();
        System.out.println(primerSelector.nombre()
                + " elige Investigador Principal.");

        motor.ejecutarAccion(
                new SeleccionarPersonajeAccion(indiceInvestigador)
        );

        System.out.println();
        System.out.println(primerSelector.nombre() + " tiene: "
                + primerSelector.personaje().nombre());

        Jugador segundoSelector = motor.contexto().jugadorActual();

        System.out.println("Ahora le toca elegir a: "
                + segundoSelector.nombre());

        System.out.println();
        System.out.println("Personajes restantes:");

        for (int i = 0; i < motor.partida().mazoRoles().cartas().size(); i++) {
            System.out.println(
                    (i + 1) + ". "
                            + motor.partida().mazoRoles().cartas().get(i).nombre()
            );
        }

        System.out.println();
        System.out.println(segundoSelector.nombre()
                + " elige el personaje número 1.");

        motor.ejecutarAccion(
                new SeleccionarPersonajeAccion(0)
        );

        System.out.println();
        System.out.println(segundoSelector.nombre() + " tiene: "
                + segundoSelector.personaje().nombre());

        System.out.println();
        System.out.println("=== PERSONAJES ASIGNADOS ===");

        for (Jugador jugador : jugadores) {
            System.out.println(
                    jugador.nombre()
                            + " -> "
                            + jugador.personaje().nombre()
                            + " (orden "
                            + jugador.personaje().ordenTurno()
                            + ")"
            );
        }

        System.out.println();
        System.out.println("=== ORDEN DE TURNOS ===");
        System.out.println();

        System.out.println("Primer turno: "
                + motor.contexto().jugadorActual().nombre()
                + " - "
                + motor.contexto().jugadorActual().personaje().nombre());

        motor.avanzarFase();

        System.out.println("Siguiente turno: "
                + motor.contexto().jugadorActual().nombre()
                + " - "
                + motor.contexto().jugadorActual().personaje().nombre());

        motor.avanzarFase();

        System.out.println("Fase actual: "
                + motor.partida().faseActual());

        System.out.println();
        System.out.println("=== NUEVA RONDA ===");

        motor.avanzarFase();

        System.out.println("Ronda actual: "
                + motor.partida().ronda());

        System.out.println("Fase actual: "
                + motor.partida().faseActual());

        System.out.println("Jugador que empieza la selección: "
                + motor.contexto().jugadorActual().nombre());

        System.out.println("Personajes disponibles: "
                + motor.partida().mazoRoles().cartas().size());

        System.out.println("Personaje de Ana: "
                + jugadores.get(0).personaje());

        System.out.println("Personaje de Bruno: "
                + jugadores.get(1).personaje());

        System.out.println();
        System.out.println("El Investigador Principal era: "
                + primerSelector.nombre());

        System.out.println("El jugador que empieza la nueva ronda es: "
                + motor.contexto().jugadorActual().nombre());
    }
}