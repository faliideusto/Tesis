package es.ciudadela.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Mazo<T extends Carta> {

    private final List<T> cartas;

    public Mazo(List<T> cartas) {
        this.cartas = new ArrayList<>(cartas);
    }

    public boolean estaVacio() {
        return cartas.isEmpty();
    }

    public List<T> cartas() {
        return Collections.unmodifiableList(cartas);
    }

    public T robar() {
        if (cartas.isEmpty()) {
            throw new IllegalStateException("El mazo está vacío");
        }
        return cartas.remove(0);
    }

    public T robarAleatoria() {
        if (cartas.isEmpty()) {
            throw new IllegalStateException("El mazo está vacío");
        }

        int indice = java.util.concurrent.ThreadLocalRandom.current().nextInt(cartas.size());
        return cartas.remove(indice);
    }

    public void añadir(T carta) {
        cartas.add(carta);
    }

    public void añadirTodas(List<T> nuevasCartas) {
        cartas.addAll(nuevasCartas);
    }
}