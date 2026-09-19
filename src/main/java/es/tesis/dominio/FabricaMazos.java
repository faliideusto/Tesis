package es.tesis.dominio;

import es.tesis.habilidades.*;
import java.util.List;

/** Cada llamada crea cartas y un mazo nuevos, sin estado compartido entre partidas. */
public final class FabricaMazos {
    private FabricaMazos() {}
    public static Mazo<IdeaCarta> crearIdeas() {
        return new Mazo<>(List.of(
                new IdeaCarta("Artículo Ecológico", 1, 1, 1),
                new IdeaCarta("Artículo Transversal", 2, 1, 2),
                new IdeaCarta("Casos y Controles", 2, 2, 3),
                new IdeaCarta("Cohortes", 3, 3, 5),
                new IdeaCarta("Ensayo Clínico Aleatorizado", 4, 4, 7),
                new IdeaCarta("Ensayo Comunitario", 8, 4, 9),
                new IdeaCarta("Revisión Sistemática", 2, 5, 6),
                new IdeaCarta("Patente", 3, 5, 5, 2)
        ), List.of(20, 20, 17, 13, 10, 6, 10, 4));

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
