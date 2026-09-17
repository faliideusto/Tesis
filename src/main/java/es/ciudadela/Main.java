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
        motor.iniciarPartida(PartidaInicial.crear());
        try (Scanner entrada = new Scanner(System.in)) {
            new ConsolaJuego(motor, entrada).ejecutar();
        }
    }
}
