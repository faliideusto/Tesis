package es.tesis.eventos;

import java.util.ArrayList;
import java.util.List;

public class BusEventosSimple {

    private final List<ObservadorJuego> observadores;

    public BusEventosSimple() {
        this.observadores = new ArrayList<>();
    }

    public void registrar(ObservadorJuego observador) {
        java.util.Objects.requireNonNull(observador);
        if (!observadores.contains(observador)) observadores.add(observador);
    }

    public void retirar(ObservadorJuego observador) { observadores.remove(observador); }

    public void publicar(EventoJuego evento) {
        for (ObservadorJuego observador : List.copyOf(observadores)) {
            observador.alRecibir(evento);
        }
    }
}
