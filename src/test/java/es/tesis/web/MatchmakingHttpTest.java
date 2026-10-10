package es.tesis.web;

import com.google.gson.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MatchmakingHttpTest {
    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newHttpClient();
    private HttpResponse<String> request(String base, String path, String token, Object body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(base + path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body == null) builder.GET();
        else builder.header("X-Tesis", "1").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(body)));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    private GestorMatchmaking.Vista vista(HttpResponse<String> response) {
        assertEquals(200, response.statusCode(), response.body());
        assertEquals("no-store", response.headers().firstValue("Cache-Control").orElseThrow());
        return gson.fromJson(response.body(), GestorMatchmaking.Vista.class);
    }
    @ParameterizedTest @ValueSource(ints = {3, 4, 5})
    void busquedaConfirmacionInicioYRecuperacionPrivada(int cantidad) throws Exception {
        try (var servidor = new ServidorWeb("127.0.0.1", 0)) {
            servidor.iniciar();
            String base = "http://localhost:" + servidor.puerto() + "/api/";
            var tokens = new ArrayList<String>();
            for (int i = 0; i < cantidad; i++) {
                String token = UUID.randomUUID().toString(); tokens.add(token);
                var estado = vista(request(base, "matchmaking", token, Map.of("nombre", "Ana", "jugadores", cantidad)));
                assertEquals(i == cantidad - 1 ? "CONFIRMACION" : "BUSCANDO", estado.fase());
                assertNull(estado.acceso());
            }
            String grupo = vista(request(base, "matchmaking/estado", tokens.get(0), null)).grupo();
            assertEquals(409, request(base, "matchmaking/confirmar", tokens.get(0), Map.of("grupo", "viejo")).statusCode());
            for (String token : tokens) vista(request(base, "matchmaking/confirmar", token, Map.of("grupo", grupo)));
            var codigos = new HashSet<String>(); var jugadorTokens = new HashSet<String>();
            for (String token : tokens) {
                var respuesta = request(base, "matchmaking/estado", token, null);
                var estado = vista(respuesta);
                assertEquals("ASIGNADA", estado.fase());
                assertEquals(cantidad, estado.acceso().sala().jugadores().size());
                assertEquals("EN_PARTIDA", estado.acceso().sala().fase());
                assertEquals("SELECCION_ROLES", estado.acceso().sala().partida().fase());
                assertEquals(cantidad, new HashSet<>(estado.acceso().sala().jugadores()).size());
                for (String ajeno : tokens) if (!ajeno.equals(token)) assertFalse(respuesta.body().contains(ajeno));
                codigos.add(estado.acceso().codigo()); jugadorTokens.add(estado.acceso().playerToken());
                assertEquals(200, request(base, "salas/" + estado.acceso().codigo() + "/estado", estado.acceso().playerToken(), null).statusCode());
                assertEquals(409, request(base, "matchmaking/cancelar", token, Map.of()).statusCode());
                assertEquals(estado.acceso().playerToken(), vista(request(base, "matchmaking/confirmar", token, Map.of("grupo", grupo))).acceso().playerToken());
            }
            assertEquals(1, codigos.size()); assertEquals(cantidad, jugadorTokens.size());
        }
    }
    @Test void contratosHttpRechazanTiposOrigenIdentidadYCancelan() throws Exception {
        try (var servidor = new ServidorWeb("127.0.0.1", 0)) {
            servidor.iniciar(); String base = "http://localhost:" + servidor.puerto() + "/api/";
            String token = UUID.randomUUID().toString();
            assertEquals(401, request(base, "matchmaking", null, Map.of("nombre", "Ana", "jugadores", 3)).statusCode());
            for (Object invalido : List.of(2, 6, 3.0, "3", true, List.of(3)))
                assertEquals(400, request(base, "matchmaking", token, Map.of("nombre", "Ana", "jugadores", invalido)).statusCode());
            assertEquals(400, request(base, "matchmaking", token, Map.of("nombre", "Ana", "jugadores", 3, "actor", "otro")).statusCode());
            assertEquals(405, request(base, "matchmaking", token, null).statusCode());
            assertEquals(404, request(base, "matchmaking/otra", token, null).statusCode());
            var externo = HttpRequest.newBuilder(URI.create(base + "matchmaking"))
                    .header("Origin", "https://ajeno.example").header("X-Tesis", "1")
                    .header("Content-Type", "application/json").header("Authorization", "Bearer " + token)
                    .POST(HttpRequest.BodyPublishers.ofString("{\"nombre\":\"Ana\",\"jugadores\":3}")).build();
            assertEquals(403, http.send(externo, HttpResponse.BodyHandlers.ofString()).statusCode());
            assertFalse(vista(request(base, "matchmaking", token, Map.of("nombre", "Ana", "jugadores", 3))).bots());
            assertEquals(405, request(base, "matchmaking/bots", token, null).statusCode());
            assertEquals(401, request(base, "matchmaking/bots", null, Map.of()).statusCode());
            assertEquals(400, request(base, "matchmaking/bots", token, Map.of("jugadores", 3)).statusCode());
            var pronto = request(base, "matchmaking/bots", token, Map.of());
            assertEquals(409, pronto.statusCode(), pronto.body());
            assertEquals("BUSCANDO", vista(request(base, "matchmaking/estado", token, null)).fase());
            assertEquals(405, request(base, "matchmaking/estado", token, Map.of()).statusCode());
            assertEquals(401, request(base, "matchmaking/estado", "Ana", null).statusCode());
            assertEquals(404, request(base, "matchmaking/estado", UUID.randomUUID().toString(), null).statusCode());
            assertEquals("CANCELADA", vista(request(base, "matchmaking/cancelar", token, Map.of())).fase());
            assertEquals("CANCELADA", vista(request(base, "matchmaking/estado", token, null)).fase());
        }
    }
}
