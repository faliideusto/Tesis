package es.ciudadela.motor;

public interface EstadoJuego {

    String nombre();

    void entrar(ContextoJuego contexto);

    void avanzar(ContextoJuego contexto);
}