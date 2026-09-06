package es.ciudadela;

import es.ciudadela.acciones.SeleccionarPersonajeAccion;
import es.ciudadela.acciones.TrabajarAccion;
import es.ciudadela.dominio.FaseDeTurno;
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

        /*
         * ============================================================
         * INICIO DE LA PARTIDA
         * ============================================================
         */

        motor.iniciarPartida(partida);

        System.out.println();
        System.out.println("==========================================");
        System.out.println(" PRUEBA PUNTO 1 - FLUJO REAL DE PARTIDA");
        System.out.println("==========================================");
        System.out.println();

        /*
         * ============================================================
         * 1 Y 2 - SELECCIÓN DE ROLES + DESCARTE AUTOMÁTICO
         * ============================================================
         */

        System.out.println("=== SELECCIÓN DE ROLES ===");

        Jugador primerSelector = motor.contexto().jugadorActual();

        System.out.println("Jugador inicial: "
                + primerSelector.nombre());

        System.out.println("Roles disponibles después del descarte: "
                + motor.partida().mazoRoles().cartas().size());

        boolean descarteAutomatico =
                motor.partida().mazoRoles().cartas().size() == 7;

        // El primer jugador elige el primer personaje disponible
        Personaje personajePrimerJugador =
                motor.partida().mazoRoles().cartas().get(0);

        System.out.println();
        System.out.println(primerSelector.nombre()
                + " elige: "
                + personajePrimerJugador.nombre());

        motor.ejecutarAccion(
                new SeleccionarPersonajeAccion(0)
        );

        // Ahora debe tocarle al siguiente jugador
        Jugador segundoSelector = motor.contexto().jugadorActual();

        boolean seleccionPorOrden =
                segundoSelector != primerSelector;

        System.out.println("Ahora elige: "
                + segundoSelector.nombre());

        Personaje personajeSegundoJugador =
                motor.partida().mazoRoles().cartas().get(0);

        System.out.println(segundoSelector.nombre()
                + " elige: "
                + personajeSegundoJugador.nombre());

        motor.ejecutarAccion(
                new SeleccionarPersonajeAccion(0)
        );

        /*
         * ============================================================
         * 3 - PERSONAJES ASIGNADOS
         * ============================================================
         */

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

        boolean personajesAsignados =
                jugadores.stream()
                        .allMatch(jugador -> jugador.personaje() != null);

        boolean seleccionCompleta =
                seleccionPorOrden
                        && personajesAsignados
                        && motor.partida().faseActual()
                        == FaseDeTurno.TURNO_JUGADOR;

        /*
         * ============================================================
         * 4 - ORDEN DE TURNO SEGÚN EL PERSONAJE
         * ============================================================
         */

        System.out.println();
        System.out.println("=== ORDEN DE TURNO ===");

        int menorOrden = jugadores.stream()
                .mapToInt(jugador -> jugador.personaje().ordenTurno())
                .min()
                .orElseThrow();

        Jugador primerJugadorTurno =
                motor.contexto().jugadorActual();

        System.out.println("Primer jugador del turno: "
                + primerJugadorTurno.nombre());

        System.out.println("Personaje: "
                + primerJugadorTurno.personaje().nombre());

        System.out.println("Orden del personaje: "
                + primerJugadorTurno.personaje().ordenTurno());

        boolean ordenTurnoCorrecto =
                primerJugadorTurno.personaje().ordenTurno()
                        == menorOrden;

        /*
         * ============================================================
         * 5 - PUBLICAR TERCER ARTÍCULO
         * ============================================================
         */

        System.out.println();
        System.out.println("=== PRUEBA DEL TERCER ARTÍCULO ===");

        Jugador jugadorPrueba =
                motor.contexto().jugadorActual();

        System.out.println("Jugador de prueba: "
                + jugadorPrueba.nombre());

        // Primer artículo ya publicado
        jugadorPrueba.iniciarEstudio(
                new IdeaCarta(
                        "Artículo prueba 1",
                        0,
                        1,
                        1
                )
        );

        int indicePrimerEstudio =
                jugadorPrueba.estudios().size() - 1;

        jugadorPrueba.estudios()
                .get(indicePrimerEstudio)
                .agregarTrabajo(1);

        // Segundo artículo ya publicado
        jugadorPrueba.iniciarEstudio(
                new IdeaCarta(
                        "Artículo prueba 2",
                        0,
                        1,
                        1
                )
        );

        int indiceSegundoEstudio =
                jugadorPrueba.estudios().size() - 1;

        jugadorPrueba.estudios()
                .get(indiceSegundoEstudio)
                .agregarTrabajo(1);

        // Tercer artículo todavía en desarrollo
        jugadorPrueba.iniciarEstudio(
                new IdeaCarta(
                        "Artículo prueba 3",
                        0,
                        1,
                        1
                )
        );

        int indiceTercerEstudio =
                jugadorPrueba.estudios().size() - 1;

        System.out.println("Artículos publicados antes: "
                + jugadorPrueba.cantidadPublicados());

        /*
         * Trabajar una vez publica el tercer artículo.
         */
        motor.ejecutarAccion(
                new TrabajarAccion(indiceTercerEstudio)
        );

        System.out.println("Artículos publicados después: "
                + jugadorPrueba.cantidadPublicados());

        System.out.println("Fase justo después de publicar el tercero: "
                + motor.partida().faseActual());

        /*
         * La partida NO debe terminar todavía.
         */
        boolean noFinalizaInmediatamente =
                jugadorPrueba.cantidadPublicados() >= 3
                        && motor.partida().faseActual()
                        == FaseDeTurno.TURNO_JUGADOR;

        /*
         * Avanzamos al jugador que todavía no ha jugado.
         */
        motor.avanzarFase();

        System.out.println();
        System.out.println("Después de publicar el tercero todavía juega: "
                + motor.contexto().jugadorActual().nombre());

        System.out.println("Fase: "
                + motor.partida().faseActual());

        boolean rondaContinua =
                motor.partida().faseActual()
                        == FaseDeTurno.TURNO_JUGADOR;

        /*
         * Terminamos el último turno.
         */
        motor.avanzarFase();

        System.out.println();
        System.out.println("Fase después de jugar todos: "
                + motor.partida().faseActual());

        boolean rondaTerminada =
                motor.partida().faseActual()
                        == FaseDeTurno.FIN_RONDA;

        /*
         * Ahora sí se comprueba si alguien tiene 3 artículos.
         */
        motor.avanzarFase();

        System.out.println("Fase final: "
                + motor.partida().faseActual());

        boolean partidaTerminadaCorrectamente =
                motor.partida().faseActual()
                        == FaseDeTurno.FIN_PARTIDA;

        boolean cierreRondaCompleta =
                noFinalizaInmediatamente
                        && rondaContinua
                        && rondaTerminada
                        && partidaTerminadaCorrectamente;

        /*
         * ============================================================
         * RESULTADO FINAL
         * ============================================================
         */

        System.out.println();
        System.out.println("==========================================");
        System.out.println(" RESULTADO PUNTO 1");
        System.out.println("==========================================");

        comprobar(
                "1. Selección de roles completa por orden",
                seleccionCompleta
        );

        comprobar(
                "2. Descarte automático de una carta de rol",
                descarteAutomatico
        );

        comprobar(
                "3. Personaje asignado a cada jugador",
                personajesAsignados
        );

        comprobar(
                "4. Orden de turno según personaje",
                ordenTurnoCorrecto
        );

        comprobar(
                "5. Completar ronda tras publicar tercer artículo",
                cierreRondaCompleta
        );

        boolean punto1Completo =
                seleccionCompleta
                        && descarteAutomatico
                        && personajesAsignados
                        && ordenTurnoCorrecto
                        && cierreRondaCompleta;

        System.out.println();

        if (punto1Completo) {
            System.out.println(
                    "PUNTO 1 COMPLETADO: 5/5"
            );
        } else {
            System.out.println(
                    "PUNTO 1 TODAVÍA NO ESTÁ COMPLETO"
            );
        }
    }

    private static void comprobar(
            String descripcion,
            boolean correcto
    ) {
        if (correcto) {
            System.out.println("[OK] " + descripcion);
        } else {
            System.out.println("[ERROR] " + descripcion);
        }
    }
}