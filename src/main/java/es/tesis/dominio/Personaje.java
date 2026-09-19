package es.tesis.dominio;

import es.tesis.habilidades.HabilidadPersonaje;

public class Personaje implements Carta {

    private final String nombre;
    private final int ordenTurno;
    private final HabilidadPersonaje habilidad;

    public Personaje(String nombre, int ordenTurno, HabilidadPersonaje habilidad) {
        this.nombre = nombre;
        this.ordenTurno = ordenTurno;
        this.habilidad = habilidad;
    }

    @Override
    public String nombre() {
        return nombre;
    }

    public int ordenTurno() {
        return ordenTurno;
    }

    public HabilidadPersonaje habilidad() {
        return habilidad;
    }
}