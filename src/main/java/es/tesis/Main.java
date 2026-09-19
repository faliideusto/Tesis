package es.tesis;

import es.tesis.consola.ConsolaJuego;
import es.tesis.eventos.BusEventosSimple;
import es.tesis.motor.MotorJuegoImpl;
import es.tesis.reglas.ReglasAcademicas;
import java.util.Scanner;

public final class Main {
    private Main() {}

    public static void main(String[] args) {
        var motor = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        try {
            if (args.length == 0) {
                motor.iniciarPartida(PartidaInicial.crear());
            } else if (args.length == 2 && args[0].equals("--cargar")) {
                var json = new es.tesis.persistencia.SerializadorPartidaJson();
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
