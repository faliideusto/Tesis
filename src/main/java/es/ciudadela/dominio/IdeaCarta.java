package es.ciudadela.dominio;

public class IdeaCarta implements Carta {

    private final String nombre;
    private final int costeMonedas;
    private final int trabajoRequerido;
    private final int prestigio;

    public IdeaCarta(String nombre, int costeMonedas, int trabajoRequerido, int prestigio) {
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