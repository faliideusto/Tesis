package es.tesis.web;

import es.tesis.cuentas.CuentasSupabase;
import java.net.http.HttpClient;
import java.time.Clock;

/** Sólo QA local: Auth/RPC simulados en loopback, servidor de salas real. */
public final class InteraccionesPreview {
    public static void main(String[] args) throws Exception {
        if(args.length!=2 || !args[0].matches("http://127\\.0\\.0\\.1:[0-9]+"))
            throw new IllegalArgumentException("Se requiere Auth simulado loopback y puerto web de QA.");
        var cuentas=new CuentasSupabase(new CuentasSupabase.Configuracion(args[0],"sb_publishable_qa","sb_secret_qa"),HttpClient.newHttpClient(),Clock.systemUTC());
        var servidor=new ServidorWeb("127.0.0.1",Integer.parseInt(args[1]),cuentas);
        Runtime.getRuntime().addShutdownHook(new Thread(servidor::close));
        servidor.iniciar();
        System.out.println("Servidor QA de interacciones activo en loopback; cuentas simuladas.");
        Thread.currentThread().join();
    }
}
