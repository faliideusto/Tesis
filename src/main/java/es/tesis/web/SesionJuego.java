package es.tesis.web;

import es.tesis.acciones.*;
import es.tesis.dominio.*;
import es.tesis.eventos.*;
import es.tesis.habilidades.*;
import es.tesis.motor.*;
import es.tesis.reglas.ReglasAcademicas;
import java.util.*;
import java.util.stream.IntStream;

/** Adaptador del motor y proyecciones privadas por jugador; conserva el modo local de pruebas. */
public final class SesionJuego {
    private MotorJuego motor;
    private boolean bloqueada = true;
    private long revision;
    private Vistas.Peticion accionEnCurso;
    private final Set<String> revelados = new HashSet<>();
    private final List<Vistas.Evento> eventos = new ArrayList<>();

    record ResultadoJugador(Jugador jugador, int prestigio, boolean ganador) {}
    synchronized List<ResultadoJugador> resultadoFinal() {
        if (motor == null || motor.partida().faseActual() != FaseDeTurno.FIN_PARTIDA) return List.of();
        var ganadores = motor.partida().ganadores();
        return motor.partida().jugadores().stream()
                .map(j -> new ResultadoJugador(j, j.prestigio(), ganadores.contains(j))).toList();
    }

    public static Vistas.Configuracion configuracion() {
        int maximo = ReglasAcademicas.MAX_JUGADORES;
        return new Vistas.Configuracion(ReglasAcademicas.MIN_JUGADORES, maximo, 8,
                "El mazo mantiene siempre los 8 tipos de idea. El reparto y los robos usan las probabilidades de cada artículo, con reposición. Admite entre 3 y 5 jugadores. No hay IA.");
    }

    public synchronized Vistas.Estado crear(List<String> nombres) {
        if (nombres == null || nombres.size() < configuracion().minimo() || nombres.size() > configuracion().maximo())
            throw new IllegalArgumentException("Elige entre " + configuracion().minimo() + " y " + configuracion().maximo() + " jugadores.");
        if (nombres.stream().anyMatch(n -> n == null || n.isBlank() || n.length() > 24 || n.chars().anyMatch(Character::isISOControl)))
            throw new IllegalArgumentException("Cada nombre debe tener entre 1 y 24 caracteres sin saltos de línea.");
        return crearJugadores(nombres.stream().map(String::trim).map(Jugador::new).toList());
    }

    synchronized Vistas.Estado crearJugadores(List<Jugador> jugadores) {
        var nuevo = new MotorJuegoImpl(new ReglasAcademicas(), new BusEventosSimple());
        nuevo.iniciarPartida(new Partida(jugadores,
                FabricaMazos.crearRoles(), FabricaMazos.crearIdeas()));
        motor = nuevo;
        revelados.clear(); eventos.clear(); bloqueada = true; revision++;
        motor.registrarObservador(this::evento);
        return estado();
    }

    public synchronized Vistas.Estado revelar(long version) {
        comprobarVersion(version); bloqueada = false; revision++; return estado();
    }

    public synchronized Vistas.Estado ocultar(long version) {
        comprobarVersion(version);
        bloqueada = motor.partida().faseActual() == FaseDeTurno.SELECCION_ROLES
                || motor.partida().faseActual() == FaseDeTurno.TURNO_JUGADOR;
        revision++; return estado();
    }

    public synchronized Vistas.Estado actuar(Vistas.Peticion p) {
        return ejecutar(p, null);
    }

    synchronized Vistas.Estado actuar(Jugador jugador, Vistas.Peticion p) {
        comprobarMiembro(jugador);
        if (motor.partida().jugadorActual() != jugador) throw new ErrorSala(403, "No es tu turno.");
        return ejecutar(p, jugador);
    }

    synchronized void avanzarRondaAutomatica() {
        if (motor.partida().faseActual() != FaseDeTurno.FIN_RONDA) return;
        ejecutar(new Vistas.Peticion(revision, "SIGUIENTE_RONDA", null, null, null), null);
    }

    private Vistas.Estado ejecutar(Vistas.Peticion p, Jugador perspectiva) {
        if (p == null || p.revision() == null) throw new IllegalArgumentException("Falta la versión de la partida.");
        comprobarVersion(p.revision());
        if (perspectiva == null && bloqueada) throw new IllegalStateException("Pasa el control y muestra tu mano antes de jugar.");
        if (p.tipo() == null) throw new IllegalArgumentException("Indica una acción.");
        String anterior = motor.partida().jugadorActual().nombre();
        FaseDeTurno fase = motor.partida().faseActual();
        accionEnCurso = p;
        try { switch (p.tipo()) {
            case "SELECCIONAR" -> motor.ejecutarAccion(new SeleccionarPersonajeAccion(indice(p)));
            case "COBRAR" -> motor.ejecutarAccion(new CobrarAccion());
            case "PENSAR" -> motor.ejecutarAccion(new PensarAccion());
            case "INICIAR" -> motor.ejecutarAccion(new IniciarEstudioAccion(indice(p)));
            case "TRABAJAR" -> motor.ejecutarAccion(new TrabajarAccion(indice(p)));
            case "HABILIDAD" -> motor.ejecutarAccion(p.indice() == null ? new UsarHabilidadAccion(p.objetivo())
                    : p.objetivo() == null ? new UsarHabilidadAccion(p.indice()) : new UsarHabilidadAccion(p.objetivo(), p.indice()));
            case "FIN_TURNO" -> {
                motor.contexto().reglas().validarFinTurno(motor.contexto()); motor.avanzarFase();
            }
            case "SIGUIENTE_RONDA" -> {
                if (fase != FaseDeTurno.FIN_RONDA) throw new IllegalStateException("La ronda todavía no ha terminado.");
                motor.avanzarFase();
            }
            default -> throw new IllegalArgumentException("Acción desconocida.");
        }
        } finally { accionEnCurso = null; }
        var partida = motor.partida();
        if (partida.faseActual() == FaseDeTurno.SELECCION_ROLES && fase != partida.faseActual()) revelados.clear();
        if (partida.faseActual() == FaseDeTurno.TURNO_JUGADOR) revelados.add(partida.jugadorActual().nombre());
        if (p.tipo().equals("SELECCIONAR") || !anterior.equals(partida.jugadorActual().nombre())
                || fase != partida.faseActual()) bloqueada = partida.faseActual() == FaseDeTurno.SELECCION_ROLES
                        || partida.faseActual() == FaseDeTurno.TURNO_JUGADOR;
        revision++;
        return perspectiva == null ? estado() : estado(perspectiva);
    }

    private int indice(Vistas.Peticion p) {
        if (p.indice() == null) throw new IllegalArgumentException("Selecciona una carta o un estudio.");
        return p.indice();
    }
    private void comprobarVersion(long version) {
        if (motor == null) throw new IllegalStateException("Primero crea una partida.");
        if (version != revision) throw new Conflicto("La mesa ha cambiado. Actualiza el estado antes de actuar.");
    }
    public static final class Conflicto extends IllegalStateException {
        public Conflicto(String message) { super(message); }
    }

    public synchronized Vistas.Estado estado() {
        return vista(null);
    }

    synchronized Vistas.Estado estado(Jugador jugador) {
        comprobarMiembro(jugador);
        return vista(jugador);
    }

    private void comprobarMiembro(Jugador jugador) {
        if (motor == null || !motor.partida().jugadores().contains(jugador))
            throw new ErrorSala(403, "No perteneces a esta partida.");
    }

    private Vistas.Estado vista(Jugador perspectiva) {
        if (motor == null) return null;
        var p = motor.partida(); var actual = p.jugadorActual();
        boolean local = perspectiva == null;
        var propio = local ? actual : perspectiva;
        boolean privada = !local || !bloqueada && (p.faseActual() == FaseDeTurno.SELECCION_ROLES || p.faseActual() == FaseDeTurno.TURNO_JUGADOR);
        boolean puedeActuar = privada && propio == actual;
        var jugadores = p.jugadores().stream().map(j -> new Vistas.Jugador(j.nombre(), j.monedas(), j.prestigio(),
                j.cartasIdea().size(), j.cantidadPublicados(), j.personaje() != null && (revelados.contains(j.nombre())
                    || (privada && j == propio)) ? CatalogoVisual.rol(j.personaje(), -1) : null,
                IntStream.range(0, j.estudios().size()).mapToObj(i -> {
                    var e = j.estudios().get(i);
                    return new Vistas.Estudio(i, CatalogoVisual.carta(e.carta(), i), e.trabajoAcumulado(),
                            e.prestigioExtra(), e.estado() == EstadoEstudio.PUBLICADO);
                }).toList(), j == actual)).toList();
        var mano = privada ? IntStream.range(0, propio.cartasIdea().size()).mapToObj(i -> CatalogoVisual.carta(propio.cartasIdea().get(i), i)).toList() : List.<Vistas.Carta>of();
        var roles = puedeActuar && p.faseActual() == FaseDeTurno.SELECCION_ROLES
                ? IntStream.range(0, p.mazoRoles().cartas().size()).mapToObj(i -> CatalogoVisual.rol(p.mazoRoles().cartas().get(i), i)).toList() : List.<Vistas.Rol>of();
        // A single sentinel covers both discarded and chosen roles; never expose the reason or owner.
        var catalogoSeleccion = roles.isEmpty() ? List.<Vistas.Rol>of() : p.mazoRoles().cartasIniciales().stream()
                .map(r -> CatalogoVisual.rol(r, p.mazoRoles().cartas().indexOf(r))).toList();
        boolean pendiente = p.faseActual() == FaseDeTurno.TURNO_JUGADOR && actual.personaje().habilidad().requiereResolucionAlInicio() && !p.habilidadUsada();
        boolean agotada = p.mazoIdeas().estaVacio() && p.jugadores().stream().allMatch(j -> j.cartasIdea().isEmpty()
                && j.estudios().stream().allMatch(e -> e.estado() == EstadoEstudio.PUBLICADO))
                && !motor.contexto().reglas().debeFinalizarPartida(motor.contexto());
        return new Vistas.Estado(revision, p.faseActual().name(), p.ronda(), actual.nombre(), local && bloqueada,
                p.mazoIdeas().cartas().size(), p.mazoRoles().cartas().size(), p.faseActual() == FaseDeTurno.TURNO_JUGADOR ? 2 - p.accionesBaseRealizadas() : 0,
                puedeActuar && pendiente, jugadores, mano, roles, catalogoSeleccion, (local ? bloqueada : !puedeActuar) ? List.of() : acciones(), List.copyOf(eventos),
                p.ganadores().stream().map(Jugador::nombre).toList(), motor.contexto().reglas().debeFinalizarPartida(motor.contexto()),
                agotada ? "No quedan ideas ni estudios por completar y nadie ha publicado tres artículos. El motor no define un cierre para esta situación; podéis consultar el resultado actual o empezar otra partida." : "");
    }

    private String validar(Runnable validacion) {
        try { validacion.run(); return ""; } catch (IllegalStateException | IllegalArgumentException e) { return e.getMessage(); }
    }
    private Vistas.Accion accion(String id, String nombre, String descripcion, String motivo, List<Vistas.Opcion> opciones) {
        return new Vistas.Accion(id, nombre, descripcion, motivo.isEmpty(), motivo, opciones);
    }
    private List<Vistas.Accion> acciones() {
        var p = motor.partida(); var c = motor.contexto(); var j = p.jugadorActual();
        if (p.faseActual() == FaseDeTurno.FIN_RONDA) return List.of(accion("SIGUIENTE_RONDA",
                c.reglas().debeFinalizarPartida(c) ? "Ver resultados" : "Siguiente ronda", "Continúa al cierre de la ronda.", "", List.of()));
        if (p.faseActual() != FaseDeTurno.TURNO_JUGADOR) return List.of();
        String base = validar(() -> c.reglas().validarAccionBase(c));
        var iniciar = IntStream.range(0, j.cartasIdea().size()).filter(i -> j.cartasIdea().get(i).costeMonedas() <= j.monedas())
                .mapToObj(i -> {
                    var carta = j.cartasIdea().get(i);
                    return new Vistas.Opcion(carta.nombre(), i, null, null, "−" + carta.costeMonedas()
                            + " monedas · Te quedarán " + (j.monedas() - carta.costeMonedas())
                            + " · 0/" + carta.trabajoRequerido() + " trabajo · Consume 1 acción");
                }).toList();
        var trabajar = IntStream.range(0, j.estudios().size()).filter(i -> j.estudios().get(i).estado() == EstadoEstudio.EN_DESARROLLO)
                .mapToObj(i -> new Vistas.Opcion(j.estudios().get(i).carta().nombre(), i, null, null,
                        previsualizarTrabajo(j, j.estudios().get(i), j.personaje().habilidad()
                                .modificarPuntosTrabajo(c, j, c.reglas().puntosTrabajoBase())) + " · Consume 1 acción")).toList();
        var resultado = new ArrayList<Vistas.Accion>();
        resultado.add(accion("COBRAR", "Cobrar", "Recibe 2 monedas. Consume una acción.", base, List.of()));
        resultado.add(accion("PENSAR", "Pensar", "Roba una idea. Consume una acción.", !base.isEmpty() ? base : p.mazoIdeas().estaVacio() ? "El mazo de ideas está vacío." : "", List.of()));
        String motivoIniciar = j.cartasIdea().isEmpty() ? "No tienes ideas en la mano. Usa Pensar para robar una."
                : iniciar.isEmpty() ? "Te faltan " + (j.cartasIdea().stream().mapToInt(IdeaCarta::costeMonedas).min().orElseThrow() - j.monedas())
                    + " monedas para iniciar tu idea más barata." : "";
        resultado.add(accion("INICIAR", "Iniciar estudio", "Paga el coste de una idea de tu mano. Consume una acción.", !base.isEmpty() ? base : motivoIniciar, iniciar));
        resultado.add(accion("TRABAJAR", "Trabajar", "Aporta trabajo a un estudio propio. Se publica automáticamente al completarlo.", !base.isEmpty() ? base : trabajar.isEmpty() ? "No tienes estudios en desarrollo." : "", trabajar));
        resultado.add(habilidad());
        resultado.add(accion("FIN_TURNO", "Fin de turno", "Cede el control al siguiente jugador.", validar(() -> c.reglas().validarFinTurno(c)), List.of()));
        return resultado;
    }

    private String previsualizarTrabajo(Jugador jugador, Estudio estudio, int puntos) {
        int siguiente = estudio.trabajoAcumulado() + puntos;
        int requerido = estudio.carta().trabajoRequerido();
        String texto = estudio.trabajoAcumulado() + "/" + requerido + " → " + siguiente + "/" + requerido;
        if (siguiente >= requerido) {
            texto += " · PUBLICARÁS · +" + (estudio.carta().prestigio() + estudio.prestigioExtra()) + " prestigio";
            if (jugador.cantidadPublicados() == 2 && !motor.contexto().reglas().debeFinalizarPartida(motor.contexto()))
                texto += " · Será la última ronda";
        } else texto += " · +" + puntos + " trabajo";
        return texto;
    }

    private Vistas.Accion habilidad() {
        var c = motor.contexto(); var j = c.jugadorActual(); var h = j.personaje().habilidad();
        String motivo = validar(() -> c.reglas().validarHabilidad(c));
        var opciones = new ArrayList<Vistas.Opcion>();
        if (h instanceof ComiteEticaHabilidad) {
            c.partida().mazoRoles().cartasIniciales().stream().filter(r -> r != j.personaje() && !(r.habilidad() instanceof DecanaHabilidad))
                    .forEach(r -> opciones.add(new Vistas.Opcion(r.nombre(), null, r.nombre(), CatalogoVisual.rol(r, -1))));
        } else if (h instanceof EstadisticoHabilidad || h instanceof PreDoctoralHabilidad) {
            for (int i = 0; i < j.estudios().size(); i++) {
                boolean publicado = j.estudios().get(i).estado() == EstadoEstudio.PUBLICADO;
                if (h instanceof EstadisticoHabilidad ? publicado : !publicado)
                    opciones.add(new Vistas.Opcion(j.estudios().get(i).carta().nombre(), i, null, null,
                            (h instanceof EstadisticoHabilidad ? "+1 prestigio en este artículo"
                                    : previsualizarTrabajo(j, j.estudios().get(i), 1)) + " · No consume acciones base"));
            }
        } else if (h instanceof PlagiadorHabilidad) {
            c.partida().jugadores().stream().filter(otro -> otro != j && !c.estaProtegido(otro.nombre()))
                    .forEach(otro -> opciones.add(new Vistas.Opcion(otro.nombre(), null, otro.nombre())));
        } else if (h instanceof Revisor2Habilidad && j.monedas() >= 1) {
            for (var otro : c.partida().jugadores()) {
                if (otro == j || c.estaProtegido(otro.nombre())) continue;
                for (int i = 0; i < otro.estudios().size(); i++) {
                    var e = otro.estudios().get(i);
                    if (e.estado() == EstadoEstudio.EN_DESARROLLO && e.trabajoAcumulado() > 0)
                        opciones.add(new Vistas.Opcion(otro.nombre() + " · " + e.carta().nombre(), i, otro.nombre(), null,
                                e.trabajoAcumulado() + "/" + e.carta().trabajoRequerido() + " → "
                                + Math.max(0, e.trabajoAcumulado() - 2) + "/" + e.carta().trabajoRequerido()
                                + " · −1 moneda · No consume acciones base"));
                }
            }
        }
        var rol = CatalogoVisual.rol(j.personaje(), -1);
        if (rol.automatica()) motivo = "Esta habilidad se aplica automáticamente.";
        else if (motivo.isEmpty() && opciones.isEmpty()) {
            if (h instanceof EstadisticoHabilidad) motivo = "Necesitas un artículo propio publicado.";
            else if (h instanceof PreDoctoralHabilidad) motivo = "Necesitas un estudio propio en desarrollo.";
            else if (h instanceof Revisor2Habilidad) motivo = j.monedas() < 1 ? "Necesitas 1 moneda para revisar."
                    : "No hay estudios rivales en desarrollo con trabajo que puedas revisar.";
            else motivo = "No hay objetivos válidos para esta habilidad.";
        }
        return accion("HABILIDAD", "Habilidad", rol.habilidad(), motivo, opciones);
    }

    private void evento(EventoJuego e) {
        var d = e.datos();
        String actor = String.valueOf(d.getOrDefault("jugador", d.getOrDefault("actor", "")));
        // The chosen veto remains secret until the engine actually resolves it.
        boolean revelaRol = Set.of("fase.turno", "turno.vetado").contains(e.tipo());
        if (revelaRol) revelados.add(actor);
        String texto = switch (e.tipo()) {
            case "accion.seleccionar_personaje" -> actor + " ha elegido un personaje.";
            case "fase.turno" -> "Comienza el turno de " + actor + ".";
            case "fase.seleccion_roles" -> "Comienza la ronda " + d.get("ronda") + ".";
            case "fase.fin_ronda" -> "La ronda ha terminado.";
            case "turno.vetado" -> actor + " pierde su turno por el veto del Comité.";
            case "accion.cobrar" -> actor + " recibe 2 monedas.";
            case "accion.pensar" -> actor + " roba una idea.";
            case "accion.iniciar_estudio" -> actor + " inicia «" + d.get("articulo") + "».";
            case "accion.trabajar", "habilidad.editorial.trabajo", "habilidad.pre_doctoral" -> actor
                    + ("PUBLICADO".equals(d.get("estado")) ? " publica «" : " añade " + d.get("trabajo") + " de trabajo a «")
                    + d.get("articulo") + "»" + ("PUBLICADO".equals(d.get("estado")) ? " y gana " + d.get("prestigio") + " de prestigio" : "")
                    + (e.tipo().equals("habilidad.pre_doctoral") ? " con Pre-Doctoral." : ".");
            case "habilidad.comite_etica" -> actor + " registra un veto privado ante el Comité de Ética.";
            case "habilidad.estadistico" -> actor + " añade 1 de prestigio a «" + d.get("articulo") + "».";
            case "habilidad.plagiador" -> actor + " intercambia su mano con " + d.get("objetivo") + ".";
            case "habilidad.revisor_2" -> actor + " retira hasta 2 puntos de trabajo de «" + d.get("articulo") + "», que queda en desarrollo.";
            case "habilidad.editorial.inicio" -> actor + " recibe " + d.get("monedasRecibidas") + " monedas de Editorial.";
            case "articulo.ingresos" -> actor + " recibe " + d.get("monedas") + " monedas de sus patentes publicadas.";
            case "habilidad.investigador_principal" -> actor + " elegirá primero la próxima ronda" + (Boolean.TRUE.equals(d.get("cartaRobada")) ? " y roba una idea extra." : ".");
            case "habilidad.decana" -> actor + " tiene la inmunidad de Decana.";
            case "partida.fin" -> "Partida finalizada. Victoria: " + d.get("ganadores") + ".";
            default -> null;
        };
        if (texto != null) {
            // Explicit public metadata only; never forward the engine's arbitrary data map.
            Integer estudio = null;
            if ("accion.iniciar_estudio".equals(e.tipo()))
                estudio = motor.partida().jugadorActual().estudios().size() - 1;
            else if (Set.of("accion.trabajar", "habilidad.estadistico", "habilidad.revisor_2", "habilidad.pre_doctoral").contains(e.tipo())
                    && accionEnCurso != null) estudio = accionEnCurso.indice();
            Integer cantidad = switch (e.tipo()) {
                case "accion.cobrar" -> 2;
                case "accion.trabajar", "habilidad.pre_doctoral" -> ((Number) d.get("trabajo")).intValue();
                case "habilidad.editorial.inicio" -> ((Number) d.get("monedasRecibidas")).intValue();
                case "articulo.ingresos" -> ((Number) d.get("monedas")).intValue();
                default -> null;
            };
            eventos.add(new Vistas.Evento(eventos.isEmpty() ? 1 : eventos.get(eventos.size() - 1).numero() + 1,
                    texto, "PUBLICADO".equals(d.get("estado")), e.tipo(), actor,
                    Set.of("habilidad.plagiador", "habilidad.revisor_2").contains(e.tipo()) ? String.valueOf(d.get("objetivo")) : null,
                    estudio, cantidad, "accion.pensar".equals(e.tipo()) || Boolean.TRUE.equals(d.get("cartaRobada")),
                    // Snapshot at the public turn event, never infer a historical role
                    // from a later round or from a client's private player projection.
                    revelaRol ? CatalogoVisual.rol(motor.partida().jugadorActual().personaje(), -1) : null));
            if (eventos.size() > 80) eventos.remove(0);
        }
    }
}
