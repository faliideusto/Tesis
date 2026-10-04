-- Tesis 2.0.0. Aplicar una vez como propietario mediante Supabase SQL Editor/CLI.
-- No contiene credenciales. No persiste manos, roles ni eventos del motor.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 24 and display_name = btrim(display_name) and display_name !~ '[[:cntrl:]]'),
    xp bigint not null default 0 check (xp >= 0),
    games_finished bigint not null default 0 check (games_finished >= 0),
    wins bigint not null default 0 check (wins >= 0 and wins <= games_finished)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
create policy perfil_propio_lectura on public.profiles for select to authenticated
    using ((select auth.uid()) = id);
create policy perfil_propio_nombre on public.profiles for update to authenticated
    using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function private.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare nombre text;
begin
    nombre := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
    if char_length(nombre) not between 1 and 24 or nombre ~ '[[:cntrl:]]' then nombre := 'Investigador'; end if;
    insert into public.profiles(id, display_name) values (new.id, nombre);
    return new;
end;
$$;
revoke all on function private.crear_perfil() from public, anon, authenticated;
create trigger tesis_crear_perfil after insert on auth.users
    for each row execute function private.crear_perfil();
-- Incluye cuentas creadas antes de aplicar esta migración.
insert into public.profiles(id, display_name)
select id, case when char_length(btrim(coalesce(raw_user_meta_data ->> 'display_name', ''))) between 1 and 24
                    and (raw_user_meta_data ->> 'display_name') !~ '[[:cntrl:]]'
               then btrim(raw_user_meta_data ->> 'display_name') else 'Investigador' end
from auth.users on conflict (id) do nothing;

create table private.matches (
    id uuid primary key,
    result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
    version integer not null check (version = 1),
    completed_at timestamptz not null
);
create table private.match_participants (
    match_id uuid not null references private.matches(id) on delete cascade,
    seat integer not null check (seat between 0 and 4),
    user_id uuid references public.profiles(id) on delete set null,
    display_name text not null check (char_length(display_name) between 1 and 24 and display_name !~ '[[:cntrl:]]'),
    prestige integer not null check (prestige >= 0),
    winner boolean not null,
    primary key (match_id, seat)
);
create unique index participante_cuenta_unica on private.match_participants(match_id, user_id) where user_id is not null;
create table private.reward_ledger (
    match_id uuid not null references private.matches(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    xp integer not null check (xp in (100, 150)),
    version integer not null check (version = 1),
    awarded_at timestamptz not null default now(),
    primary key (match_id, user_id)
);
alter table private.matches enable row level security;
alter table private.match_participants enable row level security;
alter table private.reward_ledger enable row level security;
revoke all on private.matches, private.match_participants, private.reward_ledger from public, anon, authenticated;
grant select, insert, update, delete on private.matches, private.match_participants, private.reward_ledger to service_role;

-- Invoker: solo service_role puede invocarla y acceder al esquema privado.
-- El motor Java entrega el resultado; no hay ruta HTTP pública para este RPC.
create function public.registrar_resultado(
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
        insert into private.reward_ledger(match_id, user_id, xp, version)
        values (p_match_id, participante.user_id, 100 + case when participante.winner then 50 else 0 end, p_version);
        update public.profiles set xp = xp + 100 + case when participante.winner then 50 else 0 end,
            games_finished = games_finished + 1, wins = wins + case when participante.winner then 1 else 0 end
        where id = participante.user_id;
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'xp', xp) order by user_id), '[]'::jsonb)
    into recibos from private.reward_ledger where match_id = p_match_id;
    return recibos;
end;
$$;
revoke all on function public.registrar_resultado(uuid, text, timestamptz, jsonb, integer) from public, anon, authenticated;
grant execute on function public.registrar_resultado(uuid, text, timestamptz, jsonb, integer) to service_role;

commit;
