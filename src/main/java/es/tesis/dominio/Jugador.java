package es.tesis.dominio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Jugador {

    private final String nombre;
    private int monedas;
    private int prestigio;
    private Personaje personaje;
    private final List<IdeaCarta> cartasIdea;
    private final List<Estudio> estudios;

    public Jugador(String nombre) {
        this.nombre = nombre;
        this.cartasIdea = new ArrayList<>();
        this.estudios = new ArrayList<>();
    }

    static Jugador restaurar(InstantaneaPartida.JugadorDatos datos, Personaje personaje) {
        Jugador jugador = new Jugador(datos.nombre());
        jugador.monedas = datos.monedas();
        jugador.prestigio = datos.prestigio();
        jugador.personaje = personaje;
        datos.mano().forEach(c -> jugador.cartasIdea.add(c.crear()));
        datos.estudios().forEach(e -> jugador.estudios.add(Estudio.restaurar(e)));
        return jugador;
    }

    public String nombre() {
        return nombre;
    }

    public int monedas() {
        return monedas;
    }

    public int prestigio() {
        return prestigio;
    }

    public Personaje personaje() {
        return personaje;
    }

    public List<IdeaCarta> cartasIdea() {
        return Collections.unmodifiableList(new ArrayList<>(cartasIdea));
    }

    public List<Estudio> estudios() {
        return Collections.unmodifiableList(new ArrayList<>(estudios));
    }

    public void asignarPersonaje(Personaje personaje) {
        this.personaje = personaje;
    }

    public void sumarMonedas(int cantidad) {
        monedas += cantidad;
    }

    public boolean gastarMonedas(int cantidad) {
        if (cantidad < 0) throw new IllegalArgumentException("El coste no puede ser negativo");
        if (monedas < cantidad) {
            return false;
        }
        monedas -= cantidad;
        return true;
    }

    public void sumarPrestigio(int cantidad) {
        prestigio += cantidad;
    }

    public void añadirCartaIdea(IdeaCarta carta) {
        cartasIdea.add(carta);
    }

    public IdeaCarta retirarCartaIdea(int indice) {
        return cartasIdea.remove(indice);
    }

    public void intercambiarManoCon(Jugador otro) {
        var miMano = new ArrayList<>(cartasIdea);
        cartasIdea.clear();
        cartasIdea.addAll(otro.cartasIdea);
        otro.cartasIdea.clear();
        otro.cartasIdea.addAll(miMano);
    }

    public void iniciarEstudio(IdeaCarta carta) {
        estudios.add(new Estudio(carta));
    }

    public Estudio estudioEnDesarrollo(int indice) {
        if (indice < 0 || indice >= estudios.size()) {
            throw new IllegalArgumentException("Índice de estudio no válido");
        }
        Estudio estudio = estudios.get(indice);
        if (estudio.estado() == EstadoEstudio.PUBLICADO) {
            throw new IllegalStateException("El estudio ya fue publicado");
        }
        return estudio;
    }

    public void trabajarEstudio(int indice, int puntos) {
        if (puntos <= 0) {
            throw new IllegalArgumentException("Los puntos de trabajo deben ser positivos");
        }
        Estudio estudio = estudioEnDesarrollo(indice);
        estudio.agregarTrabajo(puntos);
        if (estudio.estado() == EstadoEstudio.PUBLICADO) {
            sumarPrestigio(estudio.carta().prestigio());
        }
    }

    public List<Estudio> estudiosPublicados() {
        return estudios.stream().filter(estudio -> estudio.estado() == EstadoEstudio.PUBLICADO).toList();
    }

    public int cantidadPublicados() {
        return estudiosPublicados().size();
    }
}
