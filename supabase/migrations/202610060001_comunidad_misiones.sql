-- Comunidad persistente. Aplicar después de 202610050001; sin despliegue automático.
begin;
alter table public.profiles add column friend_code text not null
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
    check (friend_code ~ '^[0-9A-F]{16}$');
create unique index perfil_codigo_amigo_unico on public.profiles(friend_code);
-- Los grants de columna anteriores no permiten editar este código.
create table private.community_settings (
    singleton boolean primary key default true check (singleton),
    activated_at timestamptz not null default now()
);
insert into private.community_settings(singleton) values (true);
create table private.friendships (
    user_low uuid not null references public.profiles(id) on delete cascade,
    user_high uuid not null references public.profiles(id) on delete cascade,
    requester uuid not null references public.profiles(id) on delete cascade,
    accepted boolean not null default false,
    primary key(user_low, user_high),
    check (user_low < user_high and requester in (user_low, user_high))
);
create index amistades_receptor on private.friendships(user_high);
create table private.mission_claims (
    user_id uuid not null references public.profiles(id) on delete cascade,
    mission_id text not null,
    xp integer not null check (xp in (50,75,100,150,200)),
    claimed_at timestamptz not null default now(),
    primary key(user_id, mission_id)
);
create index participantes_misiones on private.match_participants(user_id, match_id) where user_id is not null;
alter table private.community_settings enable row level security;
alter table private.friendships enable row level security;
alter table private.mission_claims enable row level security;
revoke all on private.community_settings, private.friendships, private.mission_claims from public, anon, authenticated;
grant select on private.community_settings to service_role;
grant select, insert, update, delete on private.friendships, private.mission_claims to service_role;

create function private.actor_comunidad() returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
    if actor is null or not exists(select 1 from public.profiles where id = actor) then
        raise exception 'Inicia sesión para acceder a la comunidad' using errcode = '42501';
    end if;
    return actor;
end $$;

create function public.comunidad() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb;
begin
    select jsonb_build_object('codigo', (select friend_code from public.profiles where id = actor),
        'amigos', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where f.accepted), '[]'::jsonb),
        'recibidas', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where not f.accepted and f.requester <> actor), '[]'::jsonb),
        'enviadas', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where not f.accepted and f.requester = actor), '[]'::jsonb))
    into resultado from private.friendships f
    join public.profiles p on p.id = case when f.user_low = actor then f.user_high else f.user_low end
    cross join lateral (select jsonb_build_object('codigo', p.friend_code, 'nombre', p.display_name, 'nivel', 1 + p.xp / 500) as v) x
    where actor in (f.user_low, f.user_high);
    return resultado;
end $$;

create function public.amistad(p_codigo text, p_accion text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); destino uuid; bajo uuid; alto uuid; relacion private.friendships%rowtype;
begin
    if p_codigo is null or upper(btrim(p_codigo)) !~ '^[0-9A-F]{16}$'
       or p_accion is null or p_accion not in ('solicitar','aceptar','rechazar','cancelar','eliminar') then
        raise exception 'Código o acción de amistad inválidos' using errcode = '22023';
    end if;
    select id into destino from public.profiles where friend_code = upper(btrim(p_codigo));
    if destino is null then raise exception 'No existe una cuenta con ese código' using errcode = '22023'; end if;
    if actor = destino then raise exception 'No puedes agregarte a ti mismo' using errcode = '22023'; end if;
    bajo := least(actor, destino); alto := greatest(actor, destino);
    -- Mismo orden que registrar_resultado; antes de insertar claves foráneas.
    perform 1 from public.profiles where id in (bajo, alto) order by id for update;
    select * into relacion from private.friendships where user_low = bajo and user_high = alto;
    if p_accion = 'solicitar' then
        if relacion.user_low is null then
            if (select count(*) from private.friendships where actor in (user_low,user_high)) >= 100
               or (select count(*) from private.friendships where destino in (user_low,user_high)) >= 100 then
                raise exception 'Se ha alcanzado el límite de cien amistades y solicitudes' using errcode = '22023';
            end if;
            insert into private.friendships(user_low,user_high,requester) values(bajo,alto,actor);
        end if;
    elsif p_accion = 'aceptar' then
        if relacion.user_low is null or relacion.requester = actor then
            raise exception 'Solo el receptor puede aceptar una solicitud' using errcode = '22023';
        end if;
        update private.friendships set accepted = true where user_low = bajo and user_high = alto;
    elsif p_accion = 'rechazar' then
        if relacion.user_low is not null and (relacion.accepted or relacion.requester = actor) then
            raise exception 'No puedes rechazar esta solicitud' using errcode = '22023';
        end if;
        delete from private.friendships where user_low = bajo and user_high = alto;
    elsif p_accion = 'cancelar' then
        if relacion.user_low is not null and (relacion.accepted or relacion.requester <> actor) then
            raise exception 'No puedes cancelar esta solicitud' using errcode = '22023';
        end if;
        delete from private.friendships where user_low = bajo and user_high = alto;
    else
        if relacion.user_low is not null and not relacion.accepted then
            raise exception 'La amistad aún no ha sido aceptada' using errcode = '22023';
        end if;
        delete from private.friendships where user_low = bajo and user_high = alto;
    end if;
    return public.comunidad();
end $$;

create function public.ranking(p_criterio text default 'xp') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb;
begin
    if p_criterio is null or p_criterio not in ('xp','victorias','partidas') then
        raise exception 'Criterio de ranking inválido' using errcode = '22023';
    end if;
    with clasificacion as (
        select p.*, rank() over(order by case p_criterio when 'xp' then xp when 'victorias' then wins else games_finished end desc) posicion,
            row_number() over(order by case p_criterio when 'xp' then xp when 'victorias' then wins else games_finished end desc, friend_code) orden
        from public.profiles p
    ), vistas as (
        select orden, id, jsonb_build_object('posicion',posicion,'codigo',friend_code,'nombre',display_name,
            'nivel',1 + xp / 500,'xp',xp,'victorias',wins,'partidas',games_finished,'yo',id = actor) v from clasificacion
    ) select jsonb_build_object('criterio',p_criterio,
        'entradas',coalesce(jsonb_agg(v order by orden) filter(where orden <= 50),'[]'::jsonb),
        'propia',(select v from vistas where id = actor)) into resultado from vistas;
    return resultado;
end $$;

-- IDs vinculados a ventana UTC; ninguna estadística enviada por el cliente.
create function private.misiones_actuales(p_actor uuid)
returns table(id text, titulo text, objetivo integer, progreso integer, xp integer, completada boolean, reclamada boolean, periodo text)
language sql stable security definer set search_path = '' as $$
    with ventanas as (
        select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' diario,
               date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' semanal,
               activated_at from private.community_settings
    ), catalogo(clave,titulo,objetivo,xp,periodo,victoria) as (values
        ('jugar1','Juega una partida',1,50,'diarias',false),
        ('ganar1','Gana una partida',1,75,'diarias',true),
        ('jugar3','Juega tres partidas',3,100,'semanales',false),
        ('jugar7','Juega siete partidas',7,200,'semanales',false),
        ('ganar3','Gana tres partidas',3,150,'semanales',true)
    ), datos as (
        select c.*, c.periodo || ':' || c.clave || ':' || to_char((case when c.periodo = 'diarias' then v.diario else v.semanal end) at time zone 'UTC','YYYY-MM-DD') id,
            least(c.objetivo, (select count(*) from private.match_participants p join private.matches m on m.id = p.match_id
                where p.user_id = p_actor and (not c.victoria or p.winner)
                and m.completed_at >= greatest(v.activated_at, case when c.periodo = 'diarias' then v.diario else v.semanal end)
                and m.completed_at <= now())::integer) progreso
        from catalogo c cross join ventanas v
    ) select d.id,d.titulo,d.objetivo,d.progreso,d.xp,d.progreso >= d.objetivo,
        exists(select 1 from private.mission_claims mc where mc.user_id = p_actor and mc.mission_id = d.id),d.periodo from datos d;
$$;

create function public.misiones() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb;
begin
    select jsonb_build_object(
        'diarias',coalesce(jsonb_agg(to_jsonb(m) - 'periodo' order by m.xp,m.id) filter(where m.periodo = 'diarias'),'[]'::jsonb),
        'semanales',coalesce(jsonb_agg(to_jsonb(m) - 'periodo' order by m.xp,m.id) filter(where m.periodo = 'semanales'),'[]'::jsonb),
        'reinicioDiario', (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC',
        'reinicioSemanal',(date_trunc('week', now() at time zone 'UTC') + interval '1 week') at time zone 'UTC')
    into resultado from private.misiones_actuales(actor) m;
    return resultado;
end $$;

create function public.reclamar_mision(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); m record; insertada text;
begin
    if p_id is null or length(p_id) > 64 then raise exception 'Misión inválida' using errcode = '22023'; end if;
    -- Solo un perfil, antes de FK/recibo: compatible con orden del registro de resultados.
    perform 1 from public.profiles where id = actor for update;
    select * into m from private.misiones_actuales(actor) where id = p_id;
    if not found then raise exception 'La misión no existe o ha caducado' using errcode = '22023'; end if;
    if not m.completada then raise exception 'La misión todavía no está completada' using errcode = '22023'; end if;
    insert into private.mission_claims(user_id,mission_id,xp) values(actor,p_id,m.xp)
    on conflict(user_id,mission_id) do nothing returning mission_id into insertada;
    if insertada is not null then update public.profiles set xp = xp + m.xp where id = actor; end if;
    return public.misiones();
end $$;

revoke all on function private.actor_comunidad(), private.misiones_actuales(uuid) from public, anon, authenticated;
revoke all on function public.comunidad(), public.amistad(text,text), public.ranking(text), public.misiones(), public.reclamar_mision(text) from public, anon, authenticated;
grant execute on function public.comunidad(), public.amistad(text,text), public.ranking(text), public.misiones(), public.reclamar_mision(text) to authenticated;
commit;
