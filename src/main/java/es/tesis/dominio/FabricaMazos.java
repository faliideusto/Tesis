package es.tesis.dominio;

import es.tesis.habilidades.*;
import java.util.List;

/** Cada llamada crea cartas y un mazo nuevos, sin estado compartido entre partidas. */
public final class FabricaMazos {
    private FabricaMazos() {}
    public static Mazo<IdeaCarta> crearIdeas() {
        return new Mazo<>(List.of(
                new IdeaCarta("Artículo Ecológico", 2, 1, 1),
                new IdeaCarta("Artículo Transversal", 3, 1, 2),
                new IdeaCarta("Casos y Controles", 3, 2, 3),
                new IdeaCarta("Cohortes", 4, 3, 5),
                new IdeaCarta("Ensayo Clínico Aleatorizado", 5, 4, 7),
                new IdeaCarta("Ensayo Comunitario", 9, 4, 9),
                new IdeaCarta("Revisión Sistemática", 3, 5, 6),
                new IdeaCarta("Patente", 4, 4, 5, 2)
        ), List.of(13, 13, 13, 13, 13, 13, 13, 9));

    }
    public static Mazo<Personaje> crearRoles() {
        return new Mazo<>(List.of(
                new Personaje("Comité de Ética", 1, new ComiteEticaHabilidad()),
                new Personaje("Estadístico", 2, new EstadisticoHabilidad()),
                new Personaje("Investigador Principal", 3, new InvestigadorPrincipalHabilidad()),
                new Personaje("Decana", 4, new DecanaHabilidad()),
                new Personaje("Editorial", 5, new EditorialHabilidad()),
                new Personaje("Pre-Doctoral", 6, new PreDoctoralHabilidad()),
                new Personaje("Revisor 2", 7, new Revisor2Habilidad())
        ));

    }
}
