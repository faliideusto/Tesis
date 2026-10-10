package es.tesis.web;

import es.tesis.dominio.FabricaMazos;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class CatalogoPersonajesTest {
    @Test void sietePersonajesConsecutivosConLosTextosSolicitadosYCincoPlazas() {
        var roles = FabricaMazos.crearRoles().cartas();
        assertEquals(List.of("Comité de Ética", "Estadístico", "Investigador Principal", "Decana", "Editorial", "Pre-Doctoral", "Revisor 2"),
                roles.stream().map(r -> r.nombre()).toList());
        assertEquals(IntStream.rangeClosed(1,7).boxed().toList(),roles.stream().map(r -> r.ordenTurno()).toList());
        var textos = List.of(
                "Nombra un rol al inicio de tu turno. Ese jugador no podrá realizar ninguna acción.",
                "Añade 1 de prestigio a uno de tus artículos ya publicado.",
                "Al iniciar tu turno, recibe 1 idea extra. Comenzarás la elección de rol la próxima ronda.",
                "Obtienes inmunidad frente a cualquier habilidad rival durante toda la ronda.",
                "Al iniciar tu turno, recibe 1 Moneda por cada artículo publicado en la mesa.",
                "Una vez por turno, añade 1 punto de trabajo a uno de tus artículos en desarrollo.",
                "Una vez por turno, retira 1 Punto de Trabajo de un artículo rival en desarrollo.");
        for(int i=0; i<roles.size(); i++) {
            var dto = CatalogoVisual.rol(roles.get(i),i);
            assertEquals(i+1,dto.orden());
            assertEquals(textos.get(i),dto.habilidad());
            assertEquals(i>=2 && i<=4,dto.automatica());
        }
        assertEquals(3,SesionJuego.configuracion().minimo());
        assertEquals(5,SesionJuego.configuracion().maximo());
    }
}
