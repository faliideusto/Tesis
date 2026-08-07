package es.ciudadela.eventos;

import java.util.ArrayList;
import java.util.List;

public class BusEventosSimple {

    private final List<ObservadorJuego> observadores;

    public BusEventosSimple() {
        this.observadores = new ArrayList<>();
    }

    public void registrar(ObservadorJuego observador) {
        observadores.add(observador);
    }

    public void publicar(EventoJuego evento) {
        for (ObservadorJuego observador : observadores) {
            observador.alRecibir(evento);
        }
    }
}