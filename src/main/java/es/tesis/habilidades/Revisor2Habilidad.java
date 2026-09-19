package es.tesis.habilidades;

import es.tesis.dominio.Jugador;
import es.tesis.motor.ContextoJuego;

public class Revisor2Habilidad implements HabilidadPersonaje {
    @Override
    public void ejecutarSobreEstudio(ContextoJuego contexto, Jugador actor, String objetivo, int indiceEstudio) {
        Jugador otro = contexto.buscarJugador(objetivo);
        if (otro == null) throw new IllegalArgumentException("No existe el jugador objetivo");
        if (otro != actor && contexto.estaProtegido(otro.nombre())) {
            throw new IllegalStateException("La Decana es inmune");
        }
        if (indiceEstudio < 0 || indiceEstudio >= otro.estudios().size())
            throw new IllegalArgumentException("Índice de estudio no válido");
        var estudio = otro.estudios().get(indiceEstudio);
        if (estudio.trabajoAcumulado() == 0) throw new IllegalStateException("El estudio no tiene trabajo que retirar");
        if (!actor.gastarMonedas(1)) throw new IllegalStateException("Se necesita una moneda para revisar");
        otro.revisarEstudio(indiceEstudio);
        contexto.publicarEvento("habilidad.revisor_2", java.util.Map.of(
                "actor", actor.nombre(), "objetivo", otro.nombre(), "articulo", estudio.carta().nombre()));
    }
}
