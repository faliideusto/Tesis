package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;

/** Preparación del contrato visual de mesa; nunca contiene el inventario ni datos sociales. */
public record CosmeticosPartida(CuentasSupabase.Cosmetico avatar,
                               CuentasSupabase.Cosmetico marco,
                               CuentasSupabase.Cosmetico reverso,
                               CuentasSupabase.Cosmetico interaccion) {
    public static CosmeticosPartida originales() { return new CosmeticosPartida(null,null,null,null); }
    /** Entrada obtenida del adaptador autenticado, nunca de JSON enviado por el jugador. */
    public static CosmeticosPartida desde(CuentasSupabase.Cosmeticos propios) {
        return new CosmeticosPartida(equipado(propios,"avatar"), equipado(propios,"marco"),
                equipado(propios,"reverso"), equipado(propios,"interaccion"));
    }

    private static CuentasSupabase.Cosmetico equipado(CuentasSupabase.Cosmeticos propios, String tipo) {
        if (propios == null || propios.equipamiento() == null || propios.inventario() == null) return null;
        String id = propios.equipamiento().get(tipo);
        if (id == null) return null;
        return propios.inventario().stream().filter(c -> c.id().equals(id) && c.tipo().equals(tipo))
                .findFirst().orElse(null);
    }
}
