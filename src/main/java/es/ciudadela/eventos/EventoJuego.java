package es.ciudadela.eventos;

import java.util.Map;

public record EventoJuego(String tipo, Map<String, Object> datos) {
}