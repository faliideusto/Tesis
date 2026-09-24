package es.tesis.web;

import es.tesis.dominio.*;
import es.tesis.habilidades.*;
import java.util.Map;

/** Metadatos visuales y explicaciones; los valores de las cartas proceden del dominio. */
final class CatalogoVisual {
    private CatalogoVisual() {}
    private static final Map<String, String> ARTICULOS = Map.ofEntries(
        Map.entry("Artículo Ecológico", "01_ecologico"), Map.entry("Artículo Transversal", "02_transversal"),
        Map.entry("Casos y Controles", "03_casos_controles"), Map.entry("Cohortes", "04_cohortes"),
        Map.entry("Revisión Sistemática", "05_revision_sistematica"),
        Map.entry("Ensayo Clínico Aleatorizado", "06_ensayo_clinico_aleatorizado"),
        Map.entry("Ensayo Comunitario", "07_ensayo_comunitario"));

    static Vistas.Carta carta(IdeaCarta c, int indice) {
        if (c.nombre().equals("Patente")) return new Vistas.Carta(indice, c.nombre(), c.costeMonedas(),
                c.trabajoRequerido(), c.prestigio(), "cartas/patente_legendaria.png", "cartas/patente_legendaria.png", c.ingresoPorTurno(), true);
        String marco = c.prestigio() <= 3 ? "comun" : c.prestigio() <= 6 ? "raro" : "epico";
        return new Vistas.Carta(indice, c.nombre(), c.costeMonedas(), c.trabajoRequerido(), c.prestigio(),
                "articulos/" + ARTICULOS.getOrDefault(c.nombre(), "01_ecologico") + ".png",
                "cartas/marco_articulo_" + marco + ".png", c.ingresoPorTurno(), false);
    }

    static Vistas.Rol rol(Personaje p, int indice) {
        var h = p.habilidad();
        String arte; String texto; boolean automatica = false;
        if (h instanceof ComiteEticaHabilidad) {
            arte = "01_comite_etica"; texto = "Nombra un rol al inicio de tu turno. Ese jugador no podrá realizar ninguna acción.";
        } else if (h instanceof EstadisticoHabilidad) {
            arte = "02_estadistico"; texto = "Añade 1 de prestigio a uno de tus artículos ya publicado.";
        } else if (h instanceof PlagiadorHabilidad) {
            arte = "03_plagiador"; texto = "Intercambia tu mano con otro jugador que no sea inmune. Una vez por turno.";
        } else if (h instanceof InvestigadorPrincipalHabilidad) {
            arte = "04_investigador_principal"; texto = "Al iniciar tu turno, recibe 1 idea extra. Comenzarás la elección de rol la próxima ronda."; automatica = true;
        } else if (h instanceof DecanaHabilidad) {
            arte = "05_decana"; texto = "Obtienes inmunidad frente a cualquier habilidad rival durante toda la ronda."; automatica = true;
        } else if (h instanceof EditorialHabilidad) {
            arte = "06_editorial"; texto = "Al iniciar tu turno, recibe 1 Moneda por cada artículo publicado en la mesa."; automatica = true;
        } else if (h instanceof PreDoctoralHabilidad) {
            arte = "07_pre_doctoral"; texto = "Una vez por turno, añade 1 punto de trabajo a uno de tus artículos en desarrollo.";
        } else {
            arte = "08_revisor_2"; texto = "Una vez por turno, podrás pagar 1 Moneda para retirar 2 Puntos de Trabajo de un artículo rival en desarrollo.";
        }
        return new Vistas.Rol(indice, p.nombre(), p.ordenTurno(), texto, "personajes/" + arte + ".png", automatica);
    }
}
