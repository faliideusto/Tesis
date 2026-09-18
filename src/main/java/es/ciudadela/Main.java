package es.ciudadela;

import es.ciudadela.consola.ConsolaJuego;
import es.ciudadela.eventos.BusEventosSimple;
import es.ciudadela.motor.MotorJuegoImpl;
import es.ciudadela.reglas.ReglasAcademicas;
import java.util.Scanner;

public final class Main {
    private Main() {}

    public static void main(String[] args) {
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        try {
            if (args.length == 0) {
                motor.iniciarPartida(PartidaInicial.crear());
            } else if (args.length == 2 && args[0].equals("--cargar")) {
                var json = new es.ciudadela.persistencia.SerializadorPartidaJson();
                motor.recuperarPartida(json.leer(java.nio.file.Path.of(args[1])));
            } else {
                System.out.println("Uso: Main [--cargar archivo.json]");
                return;
            }
        } catch (java.io.IOException | IllegalArgumentException error) {
            System.out.println("No se pudo abrir la partida: " + error.getMessage());
            return;
        }
        try (Scanner entrada = new Scanner(System.in)) {
            new ConsolaJuego(motor, entrada).ejecutar();
        }
    }
}
