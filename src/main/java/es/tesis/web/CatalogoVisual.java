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
        String marco = c.prestigio() <= 3 ? "comun" : c.prestigio() <= 6 ? "raro" : "epico";
        return new Vistas.Carta(indice, c.nombre(), c.costeMonedas(), c.trabajoRequerido(), c.prestigio(),
                "articulos/" + ARTICULOS.getOrDefault(c.nombre(), "01_ecologico") + ".png",
                "cartas/marco_articulo_" + marco + ".png");
    }

    static Vistas.Rol rol(Personaje p, int indice) {
        var h = p.habilidad();
        String arte; String texto; boolean automatica = false;
        if (h instanceof ComiteEticaHabilidad) {
            arte = "01_comite_etica"; texto = "Nombra un rol antes de actuar: pierde su turno si no es inmune. Una vez por turno.";
        } else if (h instanceof EstadisticoHabilidad) {
            arte = "02_estadistico"; texto = "Añade 1 de prestigio a un artículo propio publicado. Una vez por turno.";
        } else if (h instanceof PlagiadorHabilidad) {
            arte = "03_plagiador"; texto = "Intercambia tu mano con otro jugador que no sea inmune. Una vez por turno.";
        } else if (h instanceof InvestigadorPrincipalHabilidad) {
            arte = "04_investigador_principal"; texto = "Roba una idea extra al empezar y elige primero en la próxima ronda. Automática."; automatica = true;
        } else if (h instanceof DecanaHabilidad) {
            arte = "05_decana"; texto = "Inmunidad a las habilidades rivales durante toda la ronda. Automática."; automatica = true;
        } else if (h instanceof EditorialHabilidad) {
            arte = "06_editorial"; texto = "Al empezar, cobra por todos los artículos publicados en mesa. Compra 1 de trabajo por 3 monedas, sin límite de usos.";
        } else if (h instanceof PreDoctoralHabilidad) {
            arte = "07_pre_doctoral"; texto = "Cada acción Trabajar aporta 2 puntos de trabajo. Automática."; automatica = true;
        } else {
            arte = "08_revisor_2"; texto = "Paga 1 moneda para retirar 1 de trabajo de un estudio en desarrollo, incluso propio. Una vez por turno.";
        }
        return new Vistas.Rol(indice, p.nombre(), p.ordenTurno(), texto, "personajes/" + arte + ".png", automatica);
    }
}
