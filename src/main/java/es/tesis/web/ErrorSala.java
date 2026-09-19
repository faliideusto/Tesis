package es.tesis.web;

/** Error previsto de la API, sin datos privados en su mensaje. */
final class ErrorSala extends RuntimeException {
    final int estado;
    ErrorSala(int estado, String mensaje) { super(mensaje); this.estado = estado; }
}
