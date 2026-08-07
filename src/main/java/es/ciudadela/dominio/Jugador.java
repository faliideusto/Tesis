package es.ciudadela.dominio;

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
        return Collections.unmodifiableList(cartasIdea);
    }

    public List<Estudio> estudios() {
        return Collections.unmodifiableList(estudios);
    }

    public void asignarPersonaje(Personaje personaje) {
        this.personaje = personaje;
    }

    public void sumarMonedas(int cantidad) {
        monedas += cantidad;
    }

    public boolean gastarMonedas(int cantidad) {
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

    public List<Estudio> estudiosPublicados() {
        return estudios.stream().filter(estudio -> estudio.estado() == EstadoEstudio.PUBLICADO).toList();
    }

    public int cantidadPublicados() {
        return estudiosPublicados().size();
    }
}