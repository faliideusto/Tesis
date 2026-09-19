package es.tesis.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Mazo<T extends Carta> {

    private final List<T> cartas;
    private final List<T> cartasIniciales;
    private final boolean inagotable;

    public Mazo(List<T> cartas) {
        this(cartas, false);
    }

    Mazo(List<T> cartas, boolean inagotable) {
        if (inagotable && cartas.isEmpty()) throw new IllegalArgumentException("El catálogo no puede estar vacío");
        this.cartas = new ArrayList<>(cartas);
        this.cartasIniciales = new ArrayList<>(cartas);
        this.inagotable = inagotable;
    }

    public boolean esInagotable() { return inagotable; }

    static <T extends Carta> Mazo<T> restaurar(List<T> iniciales, List<T> disponibles) {
        Mazo<T> mazo = new Mazo<>(iniciales);
        mazo.cartas.clear();
        mazo.cartas.addAll(disponibles);
        return mazo;
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
        if (inagotable) return robarAleatoria();
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

        return retirar(indice);
    }

    public T retirar(int indice) {
        if (indice < 0 || indice >= cartas.size()) {
            throw new IllegalArgumentException("Índice de carta no válido");
        }

        return inagotable ? cartas.get(indice) : cartas.remove(indice);
    }

    public void añadir(T carta) {
        if (inagotable) throw new IllegalStateException("El catálogo de ideas es fijo");
        cartas.add(carta);
    }

    public void añadirTodas(List<T> nuevasCartas) {
        if (inagotable) throw new IllegalStateException("El catálogo de ideas es fijo");
        cartas.addAll(nuevasCartas);
    }

    public void reiniciar() {
        cartas.clear();
        cartas.addAll(cartasIniciales);
    }
}
