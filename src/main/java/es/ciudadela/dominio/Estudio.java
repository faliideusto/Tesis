package es.ciudadela.dominio;

public class Estudio {

    private final IdeaCarta carta;
    private int trabajoAcumulado;
    private EstadoEstudio estado;
    private int prestigioExtra;

    public int prestigioExtra() { return prestigioExtra; }

    public void añadirPrestigioExtra() {
        if (estado != EstadoEstudio.PUBLICADO) throw new IllegalStateException("El estudio debe estar publicado");
        prestigioExtra++;
    }

    public void retirarTrabajo() {
        if (estado == EstadoEstudio.PUBLICADO) throw new IllegalStateException("El estudio ya fue publicado");
        if (trabajoAcumulado == 0) throw new IllegalStateException("El estudio no tiene trabajo que retirar");
        trabajoAcumulado--;
    }

    public Estudio(IdeaCarta carta) {
        this.carta = carta;
        this.estado = EstadoEstudio.EN_DESARROLLO;
    }

    static Estudio restaurar(InstantaneaPartida.EstudioDatos datos) {
        Estudio estudio = new Estudio(datos.idea().crear());
        estudio.trabajoAcumulado = datos.trabajo();
        estudio.prestigioExtra = datos.prestigioExtra();
        estudio.estado = datos.trabajo() >= estudio.carta.trabajoRequerido()
                ? EstadoEstudio.PUBLICADO : EstadoEstudio.EN_DESARROLLO;
        return estudio;
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
        if (puntos <= 0) throw new IllegalArgumentException("El trabajo añadido debe ser positivo");
        if (estado == EstadoEstudio.PUBLICADO) throw new IllegalStateException("El estudio ya fue publicado");
        trabajoAcumulado += puntos;
        if (trabajoAcumulado >= carta.trabajoRequerido()) {
            estado = EstadoEstudio.PUBLICADO;
        }
    }
}
