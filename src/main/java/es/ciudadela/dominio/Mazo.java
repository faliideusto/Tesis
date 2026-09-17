package es.ciudadela.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Mazo<T extends Carta> {

    private final List<T> cartas;
    private final List<T> cartasIniciales;

    public Mazo(List<T> cartas) {
        this.cartas = new ArrayList<>(cartas);
        this.cartasIniciales = new ArrayList<>(cartas);
    }

    public boolean estaVacio() {
        return cartas.isEmpty();
    }

    public List<T> cartasIniciales() {
        return Collections.unmodifiableList(new ArrayList<>(cartasIniciales));
    }

    public List<T> cartas() {
        return Collections.unmodifiableList(new ArrayList<>(cartas));
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

        int indice = java.util.concurrent.ThreadLocalRandom.current()
                .nextInt(cartas.size());

        return cartas.remove(indice);
    }

    public T retirar(int indice) {
        if (indice < 0 || indice >= cartas.size()) {
            throw new IllegalArgumentException("Índice de carta no válido");
        }

        return cartas.remove(indice);
    }

    public void añadir(T carta) {
        cartas.add(carta);
    }

    public void añadirTodas(List<T> nuevasCartas) {
        cartas.addAll(nuevasCartas);
    }

    public void reiniciar() {
        cartas.clear();
        cartas.addAll(cartasIniciales);
    }
}
