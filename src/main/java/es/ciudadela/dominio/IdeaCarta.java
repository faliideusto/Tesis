package es.ciudadela.dominio;

public class IdeaCarta implements Carta {

    private final String nombre;
    private final int costeMonedas;
    private final int trabajoRequerido;
    private final int prestigio;

    public IdeaCarta(String nombre, int costeMonedas, int trabajoRequerido, int prestigio) {
        if (nombre == null || nombre.isBlank() || costeMonedas < 0 || trabajoRequerido <= 0 || prestigio < 0) {
            throw new IllegalArgumentException("La idea debe tener nombre, coste y prestigio no negativos y trabajo positivo");
        }
        this.nombre = nombre;
        this.costeMonedas = costeMonedas;
        this.trabajoRequerido = trabajoRequerido;
        this.prestigio = prestigio;
    }

    @Override
    public String nombre() {
        return nombre;
    }

    public int costeMonedas() {
        return costeMonedas;
    }

    public int trabajoRequerido() {
        return trabajoRequerido;
    }

    public int prestigio() {
        return prestigio;
    }
}
