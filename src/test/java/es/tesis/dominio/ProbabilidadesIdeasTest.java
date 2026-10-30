package es.tesis.dominio;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ProbabilidadesIdeasTest {
    @Test void cadaIntervaloDelSorteoCoincideConElPorcentajeAsignado() {
        var mazo = FabricaMazos.crearIdeas();
        var frecuencias = new HashMap<String,Integer>();
        for (int i=0; i<100; i++) frecuencias.merge(mazo.cartaParaSorteo(i).nombre(),1,Integer::sum);
        assertEquals(Map.of("Artículo Ecológico",13,"Artículo Transversal",13,"Casos y Controles",13,
                "Cohortes",13,"Revisión Sistemática",13,"Ensayo Clínico Aleatorizado",13,
                "Ensayo Comunitario",13,"Patente",9),frecuencias);
        assertThrows(IllegalArgumentException.class,()->mazo.cartaParaSorteo(-1));
        assertThrows(IllegalArgumentException.class,()->mazo.cartaParaSorteo(100));
        assertEquals(8,mazo.cartas().size());
    }

    @Test void robarYRobarAleatoriaUsanLosMismosPesosSinAgotarElCatalogo() {
        var mazo = FabricaMazos.crearIdeas();
        var frecuencias = new HashMap<String,Integer>();
        for (int i=0; i<100000; i++) frecuencias.merge((i%2==0?mazo.robar():mazo.robarAleatoria()).nombre(),1,Integer::sum);
        assertEquals(8,frecuencias.size());
        assertEquals(.13,frecuencias.get("Artículo Ecológico")/100000.0,.01);
        assertEquals(.09,frecuencias.get("Patente")/100000.0,.005);
        assertEquals(8,mazo.cartas().size());
    }
}
