package es.ciudadela.dominio;

public class Estudio {

    private final IdeaCarta carta;
    private int trabajoAcumulado;
    private EstadoEstudio estado;

    public Estudio(IdeaCarta carta) {
        this.carta = carta;
        this.estado = EstadoEstudio.EN_DESARROLLO;
    }

    public IdeaCarta carta() {
        return carta;
    }

    public int trabajoAcumulado() {
        return trabajoAcumulado;
    }

    public EstadoEstudio estado() {
        return estado;
    }

    public void agregarTrabajo(int puntos) {
        trabajoAcumulado += puntos;
        if (trabajoAcumulado >= carta.trabajoRequerido()) {
            estado = EstadoEstudio.PUBLICADO;
        }
    }
}