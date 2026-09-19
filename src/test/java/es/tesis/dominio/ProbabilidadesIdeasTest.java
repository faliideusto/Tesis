package es.tesis.dominio;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ProbabilidadesIdeasTest {
    @Test void cadaIntervaloDelSorteoCoincideConElPorcentajeAsignado() {
        var mazo = FabricaMazos.crearIdeas();
        var frecuencias = new HashMap<String,Integer>();
        for (int i=0; i<100; i++) frecuencias.merge(mazo.cartaParaSorteo(i).nombre(),1,Integer::sum);
        assertEquals(Map.of("Artículo Ecológico",20,"Artículo Transversal",20,"Casos y Controles",17,
                "Cohortes",13,"Revisión Sistemática",10,"Ensayo Clínico Aleatorizado",10,
                "Ensayo Comunitario",6,"Patente",4),frecuencias);
        assertThrows(IllegalArgumentException.class,()->mazo.cartaParaSorteo(-1));
        assertThrows(IllegalArgumentException.class,()->mazo.cartaParaSorteo(100));
        assertEquals(8,mazo.cartas().size());
    }

    @Test void robarYRobarAleatoriaUsanLosMismosPesosSinAgotarElCatalogo() {
        var mazo = FabricaMazos.crearIdeas();
        var frecuencias = new HashMap<String,Integer>();
        for (int i=0; i<100000; i++) frecuencias.merge((i%2==0?mazo.robar():mazo.robarAleatoria()).nombre(),1,Integer::sum);
        assertEquals(8,frecuencias.size());
        assertEquals(.20,frecuencias.get("Artículo Ecológico")/100000.0,.01);
        assertEquals(.04,frecuencias.get("Patente")/100000.0,.005);
        assertEquals(8,mazo.cartas().size());
    }
}
