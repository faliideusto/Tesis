package es.tesis.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Mazo<T extends Carta> {

    private final List<T> cartas;
    private final List<T> cartasIniciales;
    private final boolean inagotable;
    private final List<Integer> pesos;
    private final int pesoTotal;

    public Mazo(List<T> cartas) {
        this(cartas, false);
    }

    Mazo(List<T> cartas, boolean inagotable) {
        this(cartas, inagotable, Collections.nCopies(cartas.size(), 1));
    }

    public Mazo(List<T> cartas, List<Integer> pesos) {
        this(cartas, true, pesos);
    }

    private Mazo(List<T> cartas, boolean inagotable, List<Integer> pesos) {
        if (inagotable && cartas.isEmpty()) throw new IllegalArgumentException("El catálogo no puede estar vacío");
        if (pesos.size() != cartas.size() || pesos.stream().anyMatch(p -> p == null || p <= 0))
            throw new IllegalArgumentException("Cada carta debe tener un peso positivo");
        this.cartas = new ArrayList<>(cartas);
        this.cartasIniciales = new ArrayList<>(cartas);
        this.inagotable = inagotable;
        this.pesos = List.copyOf(pesos);
        this.pesoTotal = pesos.stream().mapToInt(Integer::intValue).sum();
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

        if (inagotable) return cartaParaSorteo(java.util.concurrent.ThreadLocalRandom.current().nextInt(pesoTotal));
        int indice = java.util.concurrent.ThreadLocalRandom.current()
                .nextInt(cartas.size());

        return retirar(indice);
    }

    T cartaParaSorteo(int valor) {
        if (valor < 0 || valor >= pesoTotal) throw new IllegalArgumentException("Sorteo fuera de rango");
        for (int i = 0; i < pesos.size(); i++) {
            valor -= pesos.get(i);
            if (valor < 0) return cartas.get(i);
        }
        throw new IllegalStateException("Distribución no válida");
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
