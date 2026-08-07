package es.ciudadela.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Tablero {

    private final List<Estudio> estudiosEnMesa;

    public Tablero() {
        this.estudiosEnMesa = new ArrayList<>();
    }

    public List<Estudio> estudiosEnMesa() {
        return Collections.unmodifiableList(estudiosEnMesa);
    }

    public void agregarEstudio(Estudio estudio) {
        estudiosEnMesa.add(estudio);
    }

    public int cantidadEstudiosPublicados() {
        return (int) estudiosEnMesa.stream().filter(estudio -> estudio.estado() == EstadoEstudio.PUBLICADO).count();
    }
}