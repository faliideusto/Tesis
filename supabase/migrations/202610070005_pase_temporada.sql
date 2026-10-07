-- Infraestructura provisional: puntos 1:1 con recibos de XP; solo cosméticos.
begin;
create table private.pass_seasons (
    id text primary key check(id ~ '^temporada:[0-9]{4}-[0-9]{2}$'),
    starts_at timestamptz not null, ends_at timestamptz not null check(ends_at > starts_at),
    timezone text not null default 'Europe/Madrid' check(timezone = 'Europe/Madrid'),
    name text not null default 'Crónicas del Archivo',
    free boolean not null default true check(free),
    catalog_version integer not null default 1 check(catalog_version > 0),
    points_per_level integer not null default 500 check(points_per_level > 0),
    max_level integer not null default 10 check(max_level > 0)
);
create table private.cosmetics_catalog (
    id text primary key check(id ~ '^[a-z0-9_-]{1,64}$'),
    kind text not null check(kind in ('avatar','marco','titulo','insignia','reverso','placa')),
    name text not null, asset text not null,
    rarity text not null default 'comun' check(rarity in ('comun','epico','legendario')),
    unique(id,kind)
);
insert into private.cosmetics_catalog(id,kind,name,asset) values
('academia_insignia','insignia','Crónicas del Archivo','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('academia_avatar','avatar','Aprendiz del Archivo','/assets/Tesis-assets/profile-v250/user-icon.svg'),
('academia_titulo','titulo','Custodio de Manuscritos','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('academia_marco','marco','Pergamino Antiguo','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('academia_reverso','reverso','Archivo Nocturno','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('archivo_erudito','avatar','Erudito de Medianoche','/assets/Tesis-assets/profile-v250/user-icon.svg'),
('archivo_placa','placa','Tinta Dorada','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('archivo_biblioteca','marco','Biblioteca Prohibida','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('archivo_cronista','titulo','Cronista de la Academia','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('archivo_maestro_marco','marco','Maestro del Archivo','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg'),
('archivo_maestro_insignia','insignia','Maestro del Archivo','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg');
update private.cosmetics_catalog set rarity='epico' where id='archivo_biblioteca';
update private.cosmetics_catalog set rarity='legendario' where id like 'archivo_maestro_%';
create table private.pass_reward_templates (
    catalog_version integer not null check(catalog_version > 0),
    id text not null check(id ~ '^[a-z0-9_-]{1,64}$'),
    level integer not null check(level between 1 and 10),
    name text not null,
    cosmetic_ids text[] not null check(cardinality(cosmetic_ids) between 1 and 6),
    primary key(catalog_version,id)
);
insert into private.pass_reward_templates(catalog_version,id,level,name,cosmetic_ids) values
(1,'premio_insignia',1,'Crónicas del Archivo',array['academia_insignia']),
(1,'premio_avatar',2,'Aprendiz del Archivo',array['academia_avatar']),
(1,'premio_titulo',3,'Custodio de Manuscritos',array['academia_titulo']),
(1,'premio_marco',4,'Pergamino Antiguo',array['academia_marco']),
(1,'premio_reverso',5,'Archivo Nocturno',array['academia_reverso']),
(1,'premio_erudito',6,'Erudito de Medianoche',array['archivo_erudito']),
(1,'premio_placa',7,'Tinta Dorada',array['archivo_placa']),
(1,'premio_biblioteca',8,'Biblioteca Prohibida',array['archivo_biblioteca']),
(1,'premio_cronista',9,'Cronista de la Academia',array['archivo_cronista']),
(1,'premio_maestro',10,'Maestro del Archivo',array['archivo_maestro_marco','archivo_maestro_insignia']);
create table private.pass_rewards (
    season_id text not null references private.pass_seasons(id),
    id text not null check(id ~ '^[a-z0-9_-]{1,64}$'),
    level integer not null check(level between 1 and 10),
    name text not null,
    cosmetic_ids text[] not null,
    cosmetic_snapshot jsonb not null,
    primary key(season_id,id)
);
create table private.pass_progress (
    user_id uuid not null references public.profiles(id) on delete cascade,
    season_id text not null references private.pass_seasons(id),
    points bigint not null default 0 check(points >= 0),
    primary key(user_id,season_id)
);
create table private.pass_receipts (
    user_id uuid not null references public.profiles(id) on delete cascade,
    source_kind text not null check(source_kind in ('partida','mision')),
    source_key text not null,
    season_id text not null references private.pass_seasons(id),
    points integer not null check(points > 0),
    occurred_at timestamptz not null,
    primary key(user_id,source_kind,source_key)
);
create table private.cosmetics_inventory (
    user_id uuid not null references public.profiles(id) on delete cascade,
    cosmetic_id text not null,
    kind text not null,
    acquired_at timestamptz not null default now(),
    primary key(user_id,cosmetic_id),
    unique(user_id,cosmetic_id,kind),
    foreign key(cosmetic_id,kind) references private.cosmetics_catalog(id,kind)
);
create table private.cosmetics_loadout (
    user_id uuid not null references public.profiles(id) on delete cascade,
    kind text not null check(kind in ('avatar','marco','titulo','insignia','reverso','placa')),
    cosmetic_id text not null,
    primary key(user_id,kind),
    foreign key(user_id,cosmetic_id,kind) references private.cosmetics_inventory(user_id,cosmetic_id,kind)
);
create table private.pass_claims (
    user_id uuid not null references public.profiles(id) on delete cascade,
    season_id text not null,
    reward_id text not null,
    claimed_at timestamptz not null default now(),
    primary key(user_id,season_id,reward_id),
    foreign key(season_id,reward_id) references private.pass_rewards(season_id,id)
);
alter table private.pass_seasons enable row level security;
alter table private.pass_reward_templates enable row level security;
alter table private.cosmetics_catalog enable row level security;
alter table private.pass_rewards enable row level security;
alter table private.pass_progress enable row level security;
alter table private.pass_receipts enable row level security;
alter table private.cosmetics_inventory enable row level security;
alter table private.cosmetics_loadout enable row level security;
alter table private.pass_claims enable row level security;
revoke all on private.pass_seasons,private.pass_reward_templates,private.cosmetics_catalog,private.pass_rewards,private.pass_progress,
    private.pass_receipts,private.cosmetics_inventory,private.cosmetics_loadout,private.pass_claims from public,anon,authenticated;
-- El servidor tampoco puede mutar catálogo ni progreso fuera de las funciones.
grant select on private.pass_seasons,private.pass_reward_templates,private.cosmetics_catalog,private.pass_rewards,private.pass_progress,
    private.pass_receipts,private.cosmetics_inventory,private.cosmetics_loadout,private.pass_claims to service_role;
create index pase_recibos_temporada on private.pass_receipts(season_id,user_id);
create index pase_resultados_usuario on private.reward_ledger(user_id,match_id);

-- Nuevos catálogos usan IDs/versiones nuevos; nunca reinterpretar una posesión.
create function private.catalogo_pase_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
    if TG_TABLE_NAME = 'cosmetics_catalog' and TG_OP = 'UPDATE'
        and (to_jsonb(NEW)-'asset') = (to_jsonb(OLD)-'asset') then return NEW; end if;
    raise exception 'El catálogo y las temporadas registrados son inmutables' using errcode = '22023';
end $$;
create trigger pase_catalogo_inmutable before update or delete on private.cosmetics_catalog for each row execute function private.catalogo_pase_inmutable();
create trigger pase_plantilla_inmutable before update or delete on private.pass_reward_templates for each row execute function private.catalogo_pase_inmutable();
create trigger pase_temporada_inmutable before update or delete on private.pass_seasons for each row execute function private.catalogo_pase_inmutable();
create trigger pase_recompensa_inmutable before update or delete on private.pass_rewards for each row execute function private.catalogo_pase_inmutable();

create function private.validar_bundle_pase() returns trigger
language plpgsql security definer set search_path = '' as $$
declare conocidos integer; esperado jsonb;
begin
    select count(*) into conocidos from private.cosmetics_catalog where id = any(NEW.cosmetic_ids);
    if cardinality(NEW.cosmetic_ids) not between 1 and 6 or array_position(NEW.cosmetic_ids,null) is not null
        or conocidos <> cardinality(NEW.cosmetic_ids) then
        raise exception 'Catálogo de temporada incompleto' using errcode = '22023';
    end if;
    if TG_TABLE_NAME = 'pass_rewards' then
        select jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'rareza',c.rarity) order by array_position(NEW.cosmetic_ids,c.id))
        into esperado from private.cosmetics_catalog c where c.id = any(NEW.cosmetic_ids);
        if NEW.cosmetic_snapshot is distinct from esperado then
            raise exception 'Catálogo de temporada incompleto' using errcode = '22023';
        end if;
    end if;
    return NEW;
end $$;
create trigger pase_plantilla_bundle before insert on private.pass_reward_templates for each row execute function private.validar_bundle_pase();
create trigger pase_recompensa_bundle before insert on private.pass_rewards for each row execute function private.validar_bundle_pase();

-- Fuente común para pase y ranking: metadatos registrados, o calendario canónico.
create function private.metadatos_temporada(p_ahora timestamptz)
returns table(id text,inicio timestamptz,fin timestamptz)
language sql stable security definer set search_path = '' as $$
    with civil as (select date_trunc('month',p_ahora at time zone 'Europe/Madrid') mes),
    canon as (select 'temporada:' || to_char(mes,'YYYY-MM') id,
        mes at time zone 'Europe/Madrid' inicio,(mes + interval '1 month') at time zone 'Europe/Madrid' fin from civil)
    select c.id,coalesce(s.starts_at,c.inicio),coalesce(s.ends_at,c.fin)
    from canon c left join private.pass_seasons s on s.id = c.id;
$$;
create or replace function private.ventana_ranking(p_ambito text,p_ahora timestamptz)
returns table(id text,inicio timestamptz,fin timestamptz)
language sql stable set search_path = '' as $$
    select * from private.metadatos_temporada(p_ahora) where p_ambito = 'temporada'
    union all
    select 'semanal:' || to_char(principio,'YYYY-MM-DD'),principio at time zone 'Europe/Madrid',
        (principio + interval '1 week') at time zone 'Europe/Madrid'
    from (select date_trunc('week',p_ahora at time zone 'Europe/Madrid') principio) civil where p_ambito = 'semanal';
$$;

create function private.registrar_temporada(p_fecha timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare v record; nueva text;
begin
    select * into v from private.metadatos_temporada(p_fecha);
    insert into private.pass_seasons(id,starts_at,ends_at) values(v.id,v.inicio,v.fin)
    on conflict(id) do nothing returning id into nueva;
    if nueva is not null then
        if exists(select 1 from private.pass_reward_templates t where t.catalog_version = 1
            and (cardinality(t.cosmetic_ids) <> (select count(*) from private.cosmetics_catalog c where c.id = any(t.cosmetic_ids))))
        then raise exception 'Catálogo de temporada incompleto' using errcode = '22023'; end if;
        -- Snapshot inmutable por temporada, incluye presentación del cosmético.
        insert into private.pass_rewards(season_id,id,level,name,cosmetic_ids,cosmetic_snapshot)
        select nueva,t.id,t.level,t.name,t.cosmetic_ids,
            (select jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'rareza',c.rarity) order by array_position(t.cosmetic_ids,c.id))
             from private.cosmetics_catalog c where c.id = any(t.cosmetic_ids))
        from private.pass_reward_templates t
        where t.catalog_version = (select catalog_version from private.pass_seasons where id = nueva);
    end if;
    return v.id;
end $$;

create function private.anotar_puntos_pase(p_actor uuid,p_fuente text,p_clave text,p_puntos integer,p_fecha timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare temporada text; insertado text;
begin
    -- Recibos futuros esperan al paso del reloj y una sincronización de lectura.
    if p_actor is null or p_fecha > now() then return; end if;
    perform 1 from public.profiles where id = p_actor for update;
    if not found then return; end if;
    temporada := private.registrar_temporada(p_fecha);
    insert into private.pass_receipts(user_id,source_kind,source_key,season_id,points,occurred_at)
    values(p_actor,p_fuente,p_clave,temporada,p_puntos,p_fecha)
    on conflict(user_id,source_kind,source_key) do nothing returning source_key into insertado;
    if insertado is not null then
        insert into private.pass_progress(user_id,season_id,points) values(p_actor,temporada,p_puntos)
        on conflict(user_id,season_id) do update set points = private.pass_progress.points + excluded.points;
    end if;
end $$;

create function private.recibo_pase_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if TG_TABLE_NAME = 'reward_ledger' then
        perform private.anotar_puntos_pase(NEW.user_id,'partida',NEW.match_id::text,NEW.xp,
            (select completed_at from private.matches where id = NEW.match_id));
    else
        perform private.anotar_puntos_pase(NEW.user_id,'mision',NEW.mission_id,NEW.xp,NEW.claimed_at);
    end if;
    return NEW;
end $$;
create trigger recibo_partida_pase after insert on private.reward_ledger for each row execute function private.recibo_pase_trigger();
create trigger recibo_mision_pase after insert on private.mission_claims for each row execute function private.recibo_pase_trigger();

create function private.sincronizar_pase(p_actor uuid,p_temporada text) returns void
language plpgsql security definer set search_path = '' as $$
declare recibo record; temporada private.pass_seasons%rowtype;
begin
    perform 1 from public.profiles where id = p_actor for update;
    select * into temporada from private.pass_seasons where id = p_temporada;
    for recibo in
        select 'partida' fuente,r.match_id::text clave,r.xp puntos,m.completed_at fecha
        from private.reward_ledger r join private.matches m on m.id = r.match_id
        where r.user_id = p_actor and m.completed_at >= temporada.starts_at and m.completed_at < temporada.ends_at and m.completed_at <= now()
        union all select 'mision',mc.mission_id,mc.xp,mc.claimed_at from private.mission_claims mc
        where mc.user_id = p_actor and mc.claimed_at >= temporada.starts_at and mc.claimed_at < temporada.ends_at and mc.claimed_at <= now()
    loop
        perform private.anotar_puntos_pase(p_actor,recibo.fuente,recibo.clave,recibo.puntos,recibo.fecha);
    end loop;
end $$;

create function public.pase_temporada(p_temporada text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); temporada private.pass_seasons%rowtype;
    sid text; puntos bigint; nivel integer; recompensas jsonb;
begin
    perform 1 from public.profiles where id = actor for update;
    sid := private.registrar_temporada(now());
    if p_temporada is not null then
        if p_temporada !~ '^temporada:[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Temporada inválida' using errcode = '22023'; end if;
        sid := p_temporada;
    end if;
    select * into temporada from private.pass_seasons where id = sid;
    if not found then raise exception 'La temporada no está registrada' using errcode = '22023'; end if;
    if temporada.starts_at > now() then raise exception 'La temporada todavía no ha comenzado' using errcode = '22023'; end if;
    insert into private.pass_progress(user_id,season_id) values(actor,sid) on conflict do nothing;
    perform private.sincronizar_pase(actor,sid);
    select coalesce((select points from private.pass_progress where user_id = actor and season_id = sid),0) into puntos;
    nivel := least(temporada.max_level,1 + puntos / temporada.points_per_level);
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.name,'nivel',r.level,'cosmeticos',
        (select jsonb_agg(s.v || jsonb_build_object('asset',c.asset) order by s.orden)
         from jsonb_array_elements(r.cosmetic_snapshot) with ordinality s(v,orden)
         join private.cosmetics_catalog c on c.id = s.v->>'id'),
        'reclamada',exists(select 1 from private.pass_claims c where c.user_id = actor and c.season_id = sid and c.reward_id = r.id),
        'desbloqueada',nivel >= r.level) order by r.level,r.id),'[]'::jsonb) into recompensas
    from private.pass_rewards r where r.season_id = sid;
    return jsonb_build_object('temporada',jsonb_build_object('id',sid,'inicio',temporada.starts_at,'fin',temporada.ends_at,
        'nombre',temporada.name,'gratuita',temporada.free,'zonaHoraria',temporada.timezone,'activa',now() >= temporada.starts_at and now() < temporada.ends_at),
        'progreso',jsonb_build_object('puntos',puntos,'nivel',nivel,'puntosSiguienteNivel',case when nivel < temporada.max_level then nivel * temporada.points_per_level end,
            'maxNivel',temporada.max_level,'puntosPorNivel',temporada.points_per_level),'recompensas',recompensas);
end $$;

create function public.reclamar_recompensa_temporada(p_temporada text,p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); vista jsonb; recompensa private.pass_rewards%rowtype;
begin
    perform 1 from public.profiles where id = actor for update;
    if p_temporada is null or p_id is null or p_id !~ '^[a-z0-9_-]{1,64}$' then raise exception 'Recompensa de temporada inválida' using errcode = '22023'; end if;
    vista := public.pase_temporada(p_temporada);
    select * into recompensa from private.pass_rewards where season_id = p_temporada and id = p_id;
    if not found then raise exception 'La recompensa no existe en esta temporada' using errcode = '22023'; end if;
    if (vista->'progreso'->>'nivel')::integer < recompensa.level then raise exception 'La recompensa todavía no está desbloqueada' using errcode = '22023'; end if;
    if cardinality(recompensa.cosmetic_ids) <> (select count(*) from private.cosmetics_catalog where id = any(recompensa.cosmetic_ids)) then
        raise exception 'Catálogo de temporada incompleto' using errcode = '22023';
    end if;
    insert into private.pass_claims(user_id,season_id,reward_id) values(actor,p_temporada,p_id) on conflict do nothing;
    insert into private.cosmetics_inventory(user_id,cosmetic_id,kind)
    select actor,c.id,c.kind from private.cosmetics_catalog c where c.id = any(recompensa.cosmetic_ids) on conflict do nothing;
    return public.pase_temporada(p_temporada);
end $$;

create function public.cosmeticos() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); inventario jsonb; equipo jsonb;
begin
    perform 1 from public.profiles where id = actor for update;
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'asset',c.asset,'rareza',c.rarity) order by c.kind,c.id),'[]'::jsonb)
    into inventario from private.cosmetics_inventory i join private.cosmetics_catalog c on c.id = i.cosmetic_id where i.user_id = actor;
    select jsonb_object_agg(k.kind,l.cosmetic_id) into equipo
    from (values('avatar'),('marco'),('titulo'),('insignia'),('reverso'),('placa')) k(kind)
    left join private.cosmetics_loadout l on l.user_id = actor and l.kind = k.kind;
    return jsonb_build_object('inventario',inventario,'equipamiento',equipo);
end $$;

create function public.equipar_cosmetico(p_tipo text,p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); tipo text;
begin
    perform 1 from public.profiles where id = actor for update;
    if p_tipo is null or p_tipo not in ('avatar','marco','titulo','insignia','reverso','placa')
        or (p_id is not null and p_id !~ '^[a-z0-9_-]{1,64}$') then raise exception 'Cosmético o tipo inválido' using errcode = '22023'; end if;
    if p_id is null then
        delete from private.cosmetics_loadout where user_id = actor and kind = p_tipo;
    else
        select kind into tipo from private.cosmetics_inventory where user_id = actor and cosmetic_id = p_id;
        if not found then raise exception 'No posees este cosmético' using errcode = '22023'; end if;
        if tipo <> p_tipo then raise exception 'El cosmético no corresponde a ese tipo' using errcode = '22023'; end if;
        insert into private.cosmetics_loadout(user_id,kind,cosmetic_id) values(actor,p_tipo,p_id)
        on conflict(user_id,kind) do update set cosmetic_id = excluded.cosmetic_id;
    end if;
    return public.cosmeticos();
end $$;

revoke all on function private.metadatos_temporada(timestamptz),private.registrar_temporada(timestamptz),
    private.anotar_puntos_pase(uuid,text,text,integer,timestamptz),private.recibo_pase_trigger(),private.sincronizar_pase(uuid,text),private.catalogo_pase_inmutable(),private.validar_bundle_pase()
    from public,anon,authenticated;
revoke all on function public.pase_temporada(text),public.reclamar_recompensa_temporada(text,text),public.cosmeticos(),public.equipar_cosmetico(text,text)
    from public,anon,authenticated;
grant execute on function public.pase_temporada(text),public.reclamar_recompensa_temporada(text,text),public.cosmeticos(),public.equipar_cosmetico(text,text) to authenticated;

-- Backfill inicial: solo mes actual. Meses anteriores no se crean retroactivamente.
do $$ declare sid text; usuario uuid;
begin
    sid := private.registrar_temporada(now());
    for usuario in select id from public.profiles order by id loop perform private.sincronizar_pase(usuario,sid); end loop;
end $$;
commit;
