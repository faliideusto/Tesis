package es.ciudadela;

import es.ciudadela.dominio.*;
import java.util.List;

public final class PartidaInicial {
    private PartidaInicial() {}

    public static Partida crear() {
        return new Partida(List.of(new Jugador("Ana"), new Jugador("Bruno")),
                FabricaMazos.crearRoles(), FabricaMazos.crearIdeas());
    }
}
