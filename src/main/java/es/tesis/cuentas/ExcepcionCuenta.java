package es.tesis.cuentas;

/** Error público: nunca incorpora respuestas remotas, tokens ni claves. */
public final class ExcepcionCuenta extends RuntimeException {
    private final int estado;
    public ExcepcionCuenta(int estado, String mensaje) {
        super(mensaje);
        this.estado = estado;
    }
    public int estado() { return estado; }
}
