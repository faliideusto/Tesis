-- Amplía la RPC existente: catálogo bloqueado y archivo privado del actor.
-- No modifica inventario, IDs, assets ni permisos sobre tablas.
begin;
-- Slot futuro exclusivamente cosmético: ninguna acción, animación o ventaja.
alter table private.cosmetics_catalog drop constraint cosmetics_catalog_kind_check;
alter table private.cosmetics_catalog add constraint cosmetics_catalog_kind_check
    check(kind in ('avatar','marco','titulo','insignia','reverso','placa','interaccion'));
alter table private.cosmetics_loadout drop constraint cosmetics_loadout_kind_check;
alter table private.cosmetics_loadout add constraint cosmetics_loadout_kind_check
    check(kind in ('avatar','marco','titulo','insignia','reverso','placa','interaccion'));
create or replace function public.cosmeticos() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); inventario jsonb; equipo jsonb; catalogo jsonb; temporadas jsonb;
begin
    perform 1 from public.profiles where id = actor for update;
    -- La lectura registra el mes vigente y sincroniza sus recibos autoritativos.
    perform public.pase_temporada(null);
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'asset',c.asset,'rareza',c.rarity) order by c.kind,c.id),'[]'::jsonb)
    into inventario from private.cosmetics_inventory i join private.cosmetics_catalog c on c.id = i.cosmetic_id where i.user_id = actor;
    select jsonb_object_agg(k.kind,l.cosmetic_id) into equipo
    from (values('avatar'),('marco'),('titulo'),('insignia'),('reverso'),('placa'),('interaccion')) k(kind)
    left join private.cosmetics_loadout l on l.user_id = actor and l.kind = k.kind;
    select coalesce(jsonb_agg(jsonb_build_object('cosmetico',c.cosmetico,'temporada',jsonb_build_object('id',c.season_id,'nombre',c.name),'nivel',c.level)
        order by c.starts_at desc,c.level,c.cosmetic_id),'[]'::jsonb) into catalogo
    from (
        select distinct on (s.id,a.v->>'id') s.id season_id,s.name,s.starts_at,r.level,a.v->>'id' cosmetic_id,
            a.v || jsonb_build_object('asset',cc.asset) cosmetico
        from private.pass_progress p join private.pass_seasons s on s.id=p.season_id
        join private.pass_rewards r on r.season_id=s.id
        cross join lateral jsonb_array_elements(r.cosmetic_snapshot) a(v)
        join private.cosmetics_catalog cc on cc.id=a.v->>'id'
        where p.user_id=actor and s.starts_at<=now()
        order by s.id,a.v->>'id',r.level,r.id
    ) c;
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.name,'inicio',s.starts_at,'fin',s.ends_at,
        'nivel',least(s.max_level,1+p.points/s.points_per_level),'maxNivel',s.max_level,
        'recompensasObtenidas',(select count(*) from private.pass_claims c where c.user_id=actor and c.season_id=s.id),
        'totalRecompensas',(select count(*) from private.pass_rewards r where r.season_id=s.id)) order by s.starts_at desc),'[]'::jsonb)
    into temporadas from private.pass_progress p join private.pass_seasons s on s.id=p.season_id
    where p.user_id=actor and s.starts_at<=now();
    return jsonb_build_object('inventario',inventario,'equipamiento',equipo,'catalogo',catalogo,'temporadas',temporadas);
end $$;
create or replace function public.equipar_cosmetico(p_tipo text,p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); tipo text;
begin
    perform 1 from public.profiles where id = actor for update;
    if p_tipo is null or p_tipo not in ('avatar','marco','titulo','insignia','reverso','placa','interaccion')
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
revoke all on function public.cosmeticos() from public,anon,authenticated;
grant execute on function public.cosmeticos() to authenticated;
revoke all on function public.equipar_cosmetico(text,text) from public,anon,authenticated;
grant execute on function public.equipar_cosmetico(text,text) to authenticated;
commit;
