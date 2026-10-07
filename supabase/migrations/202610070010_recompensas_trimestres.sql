-- Forward: conserva XP, recibos, IDs e inventario histórico.
begin;
alter table private.reward_ledger drop constraint reward_ledger_xp_check;
alter table private.reward_ledger add constraint reward_ledger_xp_check check(xp in (100,150,200,300));
alter table private.mission_claims drop constraint mission_claims_xp_check;
alter table private.mission_claims add constraint mission_claims_xp_check check(xp in (50,75,100,150,200,300,400,1000,1500));
alter table private.reward_ledger add column pass_points integer check(pass_points > 0);
update private.reward_ledger set pass_points=xp;
-- Extender solo temporada vigente de octubre; archivos previos conservan fechas.
alter table private.pass_seasons disable trigger pase_temporada_inmutable;
update private.pass_seasons set ends_at=(date_trunc('quarter',now() at time zone 'Europe/Madrid')+interval '3 months') at time zone 'Europe/Madrid'
where id='temporada:'||to_char(date_trunc('quarter',now() at time zone 'Europe/Madrid'),'YYYY-MM') and starts_at <= now() and ends_at > now();
alter table private.pass_seasons enable trigger pase_temporada_inmutable;
create or replace function private.metadatos_temporada(p_ahora timestamptz)
returns table(id text,inicio timestamptz,fin timestamptz)
language sql stable security definer set search_path = '' as $$
 with civil as (select date_trunc('quarter',p_ahora at time zone 'Europe/Madrid') trimestre),
 canon as (select 'temporada:'||to_char(trimestre,'YYYY-MM') id,trimestre at time zone 'Europe/Madrid' inicio,(trimestre+interval '3 months') at time zone 'Europe/Madrid' fin from civil),
 registrada as (select s.id,s.starts_at inicio,s.ends_at fin from private.pass_seasons s where p_ahora >= s.starts_at and p_ahora < s.ends_at order by s.starts_at desc limit 1)
 select * from registrada union all select * from canon where not exists(select 1 from registrada);
$$;
-- Dense rank por prestigio: empate ganador400, empate segundo300, resto200.
create function private.puntos_partida_pase(p_match uuid,p_actor uuid) returns integer
language sql stable security definer set search_path = '' as $$
 select 200+case when posicion=1 then 200 when posicion=2 then 100 else 0 end
 from (select user_id,dense_rank() over(order by prestige desc) posicion from private.match_participants where match_id=p_match) c where user_id=p_actor;
$$;
create or replace function public.registrar_resultado(
    p_match_id uuid,
    p_result_hash text,
    p_completed_at timestamptz,
    p_participants jsonb,
    p_version integer default 1
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    cantidad integer;
    maximo integer;
    creado uuid;
    previo private.matches%rowtype;
    participante record;
    recibos jsonb;
begin
    if p_match_id is null or p_result_hash is null or p_result_hash !~ '^[0-9a-f]{64}$'
       or p_completed_at is null or p_version is distinct from 1 then
        raise exception 'Identificador, hash, fecha o versión de resultado inválidos' using errcode = '22023';
    end if;
    if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
        raise exception 'Participantes debe ser un array' using errcode = '22023';
    end if;
    cantidad := jsonb_array_length(p_participants);
    if cantidad not between 3 and 5 then
        raise exception 'Se necesitan entre tres y cinco participantes' using errcode = '22023';
    end if;
    -- Tipos JSON explícitos: no aceptar null en boolean, asientos/nombres ausentes ni fracciones.
    if exists (select 1 from jsonb_array_elements(p_participants) p where
        jsonb_typeof(p) is distinct from 'object'
        or jsonb_typeof(p -> 'seat') is distinct from 'number'
        or (p ->> 'seat') !~ '^[0-4]$'
        or jsonb_typeof(p -> 'prestige') is distinct from 'number'
        or (p ->> 'prestige') !~ '^[0-9]+$'
        or jsonb_typeof(p -> 'winner') is distinct from 'boolean'
        or jsonb_typeof(p -> 'display_name') is distinct from 'string'
        or char_length(p ->> 'display_name') not between 1 and 24
        or (p ->> 'display_name') ~ '[[:cntrl:]]'
        or not (p ? 'user_id')
        or jsonb_typeof(p -> 'user_id') not in ('string', 'null')) then
        raise exception 'Participante inválido' using errcode = '22023';
    end if;
    if (select count(distinct (p ->> 'seat')::integer) from jsonb_array_elements(p_participants) p) <> cantidad
       or (select count(*) from jsonb_array_elements(p_participants) p where p ->> 'user_id' is not null)
          <> (select count(distinct (p ->> 'user_id')::uuid) from jsonb_array_elements(p_participants) p) then
        raise exception 'Asientos o cuentas duplicados' using errcode = '22023';
    end if;
    if (select min((p ->> 'seat')::integer) from jsonb_array_elements(p_participants) p) <> 0
       or (select max((p ->> 'seat')::integer) from jsonb_array_elements(p_participants) p) <> cantidad - 1 then
        raise exception 'Los asientos deben ser consecutivos desde cero' using errcode = '22023';
    end if;
    select max((p ->> 'prestige')::integer) into maximo from jsonb_array_elements(p_participants) p;
    if exists (select 1 from jsonb_array_elements(p_participants) p
               where (p ->> 'winner')::boolean is distinct from ((p ->> 'prestige')::integer = maximo)) then
        raise exception 'Los ganadores deben coincidir con el máximo prestigio' using errcode = '22023';
    end if;

    -- El INSERT espera a cualquier transacción rival sobre la misma PK.
    insert into private.matches(id, result_hash, version, completed_at)
    values (p_match_id, p_result_hash, p_version, p_completed_at)
    on conflict (id) do nothing returning id into creado;
    if creado is null then
        select * into strict previo from private.matches where id = p_match_id for update;
        if previo.result_hash <> p_result_hash or previo.version <> p_version then
            raise exception 'La partida ya tiene otro resultado' using errcode = '22023';
        end if;
        select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'xp', xp) order by user_id), '[]'::jsonb)
        into recibos from private.reward_ledger where match_id = p_match_id;
        return recibos;
    end if;

    -- Bloquear antes de insertar FKs: evita convertir bloqueos KEY SHARE de
    -- dos transacciones rivales en FOR UPDATE y producir un interbloqueo.
    for participante in
        select (p ->> 'user_id')::uuid as user_id
        from jsonb_array_elements(p_participants) p where p ->> 'user_id' is not null
        order by (p ->> 'user_id')::uuid
    loop
        perform 1 from public.profiles where id = participante.user_id for update;
        if not found then raise exception 'La cuenta no existe' using errcode = '23503'; end if;
    end loop;

    insert into private.match_participants(match_id, seat, user_id, display_name, prestige, winner)
    select p_match_id, (p ->> 'seat')::integer, (p ->> 'user_id')::uuid,
           p ->> 'display_name', (p ->> 'prestige')::integer, (p ->> 'winner')::boolean
    from jsonb_array_elements(p_participants) p;
    -- Orden único de bloqueo para partidas distintas con las mismas cuentas.
    for participante in
        select (p ->> 'user_id')::uuid as user_id, (p ->> 'winner')::boolean as winner
        from jsonb_array_elements(p_participants) p where p ->> 'user_id' is not null
        order by (p ->> 'user_id')::uuid
    loop
        insert into private.reward_ledger(match_id, user_id, xp, version, pass_points)
        values (p_match_id, participante.user_id, 200 + case when participante.winner then 100 else 0 end, p_version, private.puntos_partida_pase(p_match_id,participante.user_id));
        update public.profiles set xp = xp + 200 + case when participante.winner then 100 else 0 end,
            games_finished = games_finished + 1, wins = wins + case when participante.winner then 1 else 0 end
        where id = participante.user_id;
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'xp', xp) order by user_id), '[]'::jsonb)
    into recibos from private.reward_ledger where match_id = p_match_id;
    return recibos;
end;
$$;
create or replace function private.misiones_actuales(p_actor uuid)
returns table(id text, titulo text, objetivo integer, progreso integer, xp integer, completada boolean, reclamada boolean, periodo text)
language sql stable security definer set search_path = '' as $$
    with ventanas as (
        select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' diario,
               date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' semanal,
               activated_at from private.community_settings
    ), catalogo(clave,titulo,objetivo,xp,periodo,victoria) as (values
        ('jugar1','Juega una partida',1,100,'diarias',false),
        ('ganar1','Gana una partida',1,150,'diarias',true),
        ('jugar3','Juega tres partidas',3,200,'semanales',false),
        ('jugar7','Juega siete partidas',7,400,'semanales',false),
        ('ganar3','Gana tres partidas',3,300,'semanales',true)
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

create or replace function private.misiones_temporada_actuales(p_actor uuid, p_ahora timestamptz default now())
returns table(id text, titulo text, objetivo integer, progreso integer, xp integer, completada boolean, reclamada boolean, periodo text)
language sql stable security definer set search_path = '' as $$
    with ventana as (
        select t.*, c.activated_at from private.metadatos_temporada(p_ahora) t
        cross join private.community_settings c
    ), catalogo(clave,titulo,objetivo,xp,victoria) as (values
        ('jugar10','Completa diez partidas de temporada',10,1000,false),
        ('ganar5','Gana cinco partidas de temporada',5,1500,true)
    ), datos as (
        select 'temporada:' || c.clave || ':' || substring(v.id from 11) id, c.titulo,c.objetivo,c.xp,
            least(c.objetivo,(select count(*) from private.match_participants p
                join private.matches m on m.id = p.match_id
                where p.user_id = p_actor and (not c.victoria or p.winner)
                and m.completed_at >= greatest(v.inicio,v.activated_at)
                and m.completed_at < v.fin and m.completed_at <= p_ahora)::integer) progreso
        from catalogo c cross join ventana v
    ) select d.id,d.titulo,d.objetivo,d.progreso,d.xp,d.progreso >= d.objetivo,
        exists(select 1 from private.mission_claims c where c.user_id = p_actor and c.mission_id = d.id),'temporada'::text
    from datos d;
$$;

create or replace function private.recibo_pase_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if TG_TABLE_NAME = 'reward_ledger' then
        perform private.anotar_puntos_pase(NEW.user_id,'partida',NEW.match_id::text,coalesce(NEW.pass_points,NEW.xp),
            (select completed_at from private.matches where id = NEW.match_id));
    else
        perform private.anotar_puntos_pase(NEW.user_id,'mision',NEW.mission_id,NEW.xp,NEW.claimed_at);
    end if;
    return NEW;
end $$;
create or replace function private.sincronizar_pase(p_actor uuid,p_temporada text) returns void
language plpgsql security definer set search_path = '' as $$
declare recibo record; temporada private.pass_seasons%rowtype;
begin
    perform 1 from public.profiles where id = p_actor for update;
    select * into temporada from private.pass_seasons where id = p_temporada;
    for recibo in
        select 'partida' fuente,r.match_id::text clave,coalesce(r.pass_points,r.xp) puntos,m.completed_at fecha
        from private.reward_ledger r join private.matches m on m.id = r.match_id
        where r.user_id = p_actor and m.completed_at >= temporada.starts_at and m.completed_at < temporada.ends_at and m.completed_at <= now()
        union all select 'mision',mc.mission_id,mc.xp,mc.claimed_at from private.mission_claims mc
        where mc.user_id = p_actor and mc.claimed_at >= temporada.starts_at and mc.claimed_at < temporada.ends_at and mc.claimed_at <= now()
    loop
        perform private.anotar_puntos_pase(p_actor,recibo.fuente,recibo.clave,recibo.puntos,recibo.fecha);
    end loop;
end $$;

revoke all on function private.puntos_partida_pase(uuid,uuid) from public,anon,authenticated;
grant execute on function private.puntos_partida_pase(uuid,uuid) to service_role;
commit;
