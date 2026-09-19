package es.tesis.persistencia;

import com.google.gson.*;
import es.tesis.dominio.Partida;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

/** JSON legible, con escritura atómica cuando el sistema de archivos la admite. */
public final class SerializadorPartidaJson {
    private final Gson gson = new GsonBuilder().setPrettyPrinting().serializeNulls()
            .setStrictness(Strictness.STRICT).disableJdkUnsafe().create();

    public String serializar(PartidaGuardada partida) {
        return gson.toJson(java.util.Objects.requireNonNull(partida));
    }

    public PartidaGuardada deserializar(String json) {
        try {
            JsonElement original = gson.fromJson(json, JsonElement.class);
            // Los guardados anteriores al mazo inagotable conservan su modalidad finita.
            if (original != null && original.isJsonObject()
                    && original.getAsJsonObject().has("partida")
                    && original.getAsJsonObject().get("partida").isJsonObject()) {
                JsonObject datos = original.getAsJsonObject().getAsJsonObject("partida");
                if (!datos.has("ideasInagotables")) datos.addProperty("ideasInagotables", false);
            }
            PartidaGuardada guardada = gson.fromJson(original, PartidaGuardada.class);
            if (guardada == null) throw new IllegalArgumentException("El JSON no contiene una partida");
            validarEstructura(original, gson.toJsonTree(guardada));
            Partida.restaurar(guardada.partida());
            return guardada;
        } catch (RuntimeException error) {
            throw new IllegalArgumentException("Archivo de partida no válido o incompatible", error);
        }
    }

    // Gson asigna cero/false a primitivas ausentes. No permitir que un archivo incompleto
    // reinicie silenciosamente contadores o cambie el jugador actual.
    private void validarEstructura(JsonElement original, JsonElement esperado) {
        if (esperado.isJsonObject()) {
            if (!original.isJsonObject() || !original.getAsJsonObject().keySet().equals(esperado.getAsJsonObject().keySet())) {
                throw new IllegalArgumentException("Faltan campos o hay campos desconocidos en el guardado");
            }
            esperado.getAsJsonObject().entrySet().forEach(e -> validarEstructura(original.getAsJsonObject().get(e.getKey()), e.getValue()));
        } else if (esperado.isJsonArray()) {
            if (!original.isJsonArray() || original.getAsJsonArray().size() != esperado.getAsJsonArray().size()) {
                throw new IllegalArgumentException("Lista de datos no válida");
            }
            for (int i = 0; i < esperado.getAsJsonArray().size(); i++) {
                validarEstructura(original.getAsJsonArray().get(i), esperado.getAsJsonArray().get(i));
            }
        } else if (esperado.isJsonNull()) {
            if (!original.isJsonNull()) throw new IllegalArgumentException("Valor no válido");
        } else if (!original.isJsonPrimitive()
                || original.getAsJsonPrimitive().isBoolean() != esperado.getAsJsonPrimitive().isBoolean()
                || original.getAsJsonPrimitive().isString() != esperado.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Tipo de dato no válido");
        }
    }

    public void escribir(Path archivo, PartidaGuardada partida) throws IOException {
        String json = serializar(partida);
        Path destino = archivo.toAbsolutePath().normalize();
        Path temporal = Files.createTempFile(destino.getParent(), "partida-", ".tmp");
        try {
            Files.writeString(temporal, json, StandardCharsets.UTF_8);
            try {
                Files.move(temporal, destino, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException error) {
                Files.move(temporal, destino, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(temporal);
        }
    }

    public PartidaGuardada leer(Path archivo) throws IOException {
        return deserializar(Files.readString(archivo, StandardCharsets.UTF_8));
    }
}
