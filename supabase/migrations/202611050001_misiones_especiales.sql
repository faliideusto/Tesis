-- Tesis: misiones especiales permanentes (una sola vez por cuenta), visibles desde el inicio.
--   especial:cumlaude  Gana una partida con 20 o más de prestigio -> marco «Cum Laude».
--   especial:paliza5   Gana sacando 5 o más de prestigio al segundo -> +500 XP, sin puntos de pase.
-- Se calculan solo con resultados del servidor (match_participants). Cuentan las partidas
-- registradas desde la activación de la comunidad. Aplicar una vez tras 202611030002.
begin;
alter table private.mission_claims drop constraint mission_claims_xp_check;
alter table private.mission_claims add constraint mission_claims_xp_check check(xp in (50,75,100,150,200,300,400,500,1000,1500));

-- Las misiones especiales solo dan XP: sus recibos no suman puntos al pase de temporada.
create or replace function private.recibo_pase_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if TG_TABLE_NAME = 'reward_ledger' then
        perform private.anotar_puntos_pase(NEW.user_id,'partida',NEW.match_id::text,coalesce(NEW.pass_points,NEW.xp),
            (select completed_at from private.matches where id = NEW.match_id));
    elsif NEW.mission_id not like 'especial:%' then
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
        where mc.user_id = p_actor and mc.mission_id not like 'especial:%'
          and mc.claimed_at >= temporada.starts_at and mc.claimed_at < temporada.ends_at and mc.claimed_at <= now()
    loop
        perform private.anotar_puntos_pase(p_actor,recibo.fuente,recibo.clave,recibo.puntos,recibo.fecha);
    end loop;
end $$;

insert into private.cosmetics_catalog(id,kind,name,asset,rarity) values
('especial_cum_laude','marco','Cum Laude','/assets/seasons/misiones-especiales/marcos/marco-cum-laude.png','legendario');

create function private.misiones_especiales_actuales(p_actor uuid)
returns table(id text, titulo text, descripcion text, objetivo integer, progreso integer, xp integer,
              completada boolean, reclamada boolean, recompensa text)
language sql stable security definer set search_path = '' as $$
    with ganadas as (
        select p.prestige,
            p.prestige - coalesce((select max(o.prestige) from private.match_participants o
                                   where o.match_id = p.match_id and o.seat <> p.seat), 0) ventaja
        from private.match_participants p join private.matches m on m.id = p.match_id
        cross join private.community_settings c
        where p.user_id = p_actor and p.winner
          and m.completed_at >= c.activated_at and m.completed_at <= now()
    ), catalogo(id,titulo,descripcion,xp,recompensa,logrado) as (values
        ('especial:cumlaude','Cum Laude','Gana una partida con 20 o más puntos de prestigio.',0,'especial_cum_laude',
            exists(select 1 from ganadas where prestige >= 20)),
        ('especial:paliza5','Victoria aplastante','Gana una partida sacando 5 o más puntos de prestigio al segundo.',500,null::text,
            exists(select 1 from ganadas where ventaja >= 5))
    ) select c.id,c.titulo,c.descripcion,1,case when c.logrado then 1 else 0 end,c.xp,c.logrado,
        case when c.recompensa is null
             then exists(select 1 from private.mission_claims mc where mc.user_id = p_actor and mc.mission_id = c.id)
             else exists(select 1 from private.cosmetics_inventory i where i.user_id = p_actor and i.cosmetic_id = c.recompensa) end,
        c.recompensa
    from catalogo c;
$$;

create or replace function public.misiones() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb; especiales jsonb;
begin
    with actuales as (
        select * from private.misiones_actuales(actor)
        union all select * from private.misiones_temporada_actuales(actor)
    ), vistas as (
        select m.*, (to_jsonb(m)-'periodo') || jsonb_build_object('puntosPase',m.xp,'descripcion',
            case when split_part(m.id,':',2) like 'ganar%' then
                'Consigue ' || m.objetivo || case when m.objetivo = 1 then ' victoria' else ' victorias' end || ' en partidas completadas.'
            else 'Completa ' || m.objetivo || case when m.objetivo = 1 then ' partida' else ' partidas' end || ' en cualquier modo de juego.' end) v
        from actuales m
    ) select jsonb_build_object(
        'diarias',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='diarias'),'[]'::jsonb),
        'semanales',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='semanales'),'[]'::jsonb),
        'temporada',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='temporada'),'[]'::jsonb),
        'reinicioDiario',(date_trunc('day',now() at time zone 'UTC') + interval '1 day') at time zone 'UTC',
        'reinicioSemanal',(date_trunc('week',now() at time zone 'UTC') + interval '1 week') at time zone 'UTC',
        'reinicioTemporada',(select fin from private.metadatos_temporada(now())))
    into resultado from vistas;
    select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'titulo',e.titulo,'descripcion',e.descripcion,
            'objetivo',e.objetivo,'progreso',e.progreso,'xp',e.xp,'puntosPase',0,
            'completada',e.completada,'reclamada',e.reclamada,
            'recompensa',(select jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'asset',c.asset,'assets',c.assets,'rareza',c.rarity)
                          from private.cosmetics_catalog c where c.id = e.recompensa)) order by e.id),'[]'::jsonb)
    into especiales from private.misiones_especiales_actuales(actor) e;
    return resultado || jsonb_build_object('especiales',especiales);
end $$;

create or replace function public.reclamar_mision(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); m record; e record; insertada text; premio private.cosmetics_catalog%rowtype;
begin
    if p_id is null or length(p_id) > 64 then raise exception 'Misión inválida' using errcode='22023'; end if;
    perform 1 from public.profiles where id=actor for update;
    if p_id like 'especial:%' then
        select * into e from private.misiones_especiales_actuales(actor) where id=p_id;
        if not found then raise exception 'La misión no existe o ha caducado' using errcode='22023'; end if;
        if not e.completada then raise exception 'La misión todavía no está completada' using errcode='22023'; end if;
        if e.recompensa is not null then
            -- Premio cosmético: no concede XP ni puntos de pase.
            select * into strict premio from private.cosmetics_catalog where id = e.recompensa;
            insert into private.cosmetics_inventory(user_id,cosmetic_id,kind) values(actor,premio.id,premio.kind)
            on conflict do nothing;
        else
            insert into private.mission_claims(user_id,mission_id,xp) values(actor,p_id,e.xp)
            on conflict(user_id,mission_id) do nothing returning mission_id into insertada;
            if insertada is not null then update public.profiles set xp=xp+e.xp where id=actor; end if;
        end if;
        return public.misiones();
    end if;
    select * into m from (
        select * from private.misiones_actuales(actor)
        union all select * from private.misiones_temporada_actuales(actor)
    ) actuales where id=p_id;
    if not found then raise exception 'La misión no existe o ha caducado' using errcode='22023'; end if;
    if not m.completada then raise exception 'La misión todavía no está completada' using errcode='22023'; end if;
    insert into private.mission_claims(user_id,mission_id,xp) values(actor,p_id,m.xp)
    on conflict(user_id,mission_id) do nothing returning mission_id into insertada;
    -- El trigger existente del recibo aporta puntos al pase una sola vez.
    if insertada is not null then update public.profiles set xp=xp+m.xp where id=actor; end if;
    return public.misiones();
end $$;

revoke all on function private.misiones_especiales_actuales(uuid) from public,anon,authenticated;
revoke all on function public.misiones(),public.reclamar_mision(text) from public,anon,authenticated;
grant execute on function public.misiones(),public.reclamar_mision(text) to authenticated;
commit;
