-- Solo presentación: conserva IDs, derechos, snapshots, progreso y equipamiento.
begin;
lock table public.profiles in share row exclusive mode;
alter table private.cosmetics_catalog alter column asset drop not null;
alter table private.cosmetics_catalog add column assets jsonb;
alter table private.cosmetics_catalog add constraint cosmetic_asset_nullable check(asset is not null or kind='titulo');
create or replace function private.catalogo_pase_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
    if TG_TABLE_NAME = 'cosmetics_catalog' and TG_OP = 'UPDATE'
        and (to_jsonb(NEW)-'asset'-'assets') = (to_jsonb(OLD)-'asset'-'assets') then return NEW; end if;
    raise exception 'El catálogo y las temporadas registrados son inmutables' using errcode = '22023';
end $$;
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/insignias/insignia-cronicas-del-archivo.png' where id='academia_insignia';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/avatares/avatar-aprendiz-del-archivo.png' where id='academia_avatar';
update private.cosmetics_catalog set asset=null where id='academia_titulo';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/marcos/marco-pergamino-antiguo.png' where id='academia_marco';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/reversos/reverso-archivo-nocturno.png' where id='academia_reverso';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/avatares/avatar-erudito-de-medianoche.png' where id='archivo_erudito';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/placas/placa-tinta-dorada.png' where id='archivo_placa';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/marcos/marco-biblioteca-prohibida.png' where id='archivo_biblioteca';
update private.cosmetics_catalog set asset=null where id='archivo_cronista';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/marcos/marco-maestro-del-archivo.png' where id='archivo_maestro_marco';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/insignias/insignia-maestro-del-archivo.png' where id='archivo_maestro_insignia';
update private.cosmetics_catalog set asset='/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png' where id='archivo_lanzamiento_libro';
update private.cosmetics_catalog set assets='{"libro":"/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png","hoja-01":"/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-01.png","hoja-02":"/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-02.png","impacto":"/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/impacto.png"}'::jsonb where id='archivo_lanzamiento_libro';
create or replace function public.pase_temporada(p_temporada text default null) returns jsonb
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
        (select jsonb_agg(s.v || jsonb_build_object('asset',c.asset,'assets',c.assets) order by s.orden)
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

create or replace function public.cosmeticos() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); inventario jsonb; equipo jsonb; catalogo jsonb; temporadas jsonb;
begin
    perform 1 from public.profiles where id = actor for update;
    -- La lectura registra el mes vigente y sincroniza sus recibos autoritativos.
    perform public.pase_temporada(null);
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'asset',c.asset,'assets',c.assets,'rareza',c.rarity) order by c.kind,c.id),'[]'::jsonb)
    into inventario from private.cosmetics_inventory i join private.cosmetics_catalog c on c.id = i.cosmetic_id where i.user_id = actor;
    select jsonb_object_agg(k.kind,l.cosmetic_id) into equipo
    from (values('avatar'),('marco'),('titulo'),('insignia'),('reverso'),('placa'),('interaccion')) k(kind)
    left join private.cosmetics_loadout l on l.user_id = actor and l.kind = k.kind;
    select coalesce(jsonb_agg(jsonb_build_object('cosmetico',c.cosmetico,'temporada',jsonb_build_object('id',c.season_id,'nombre',c.name),'nivel',c.level)
        order by c.starts_at desc,c.level,c.cosmetic_id),'[]'::jsonb) into catalogo
    from (
        select distinct on (s.id,a.v->>'id') s.id season_id,s.name,s.starts_at,r.level,a.v->>'id' cosmetic_id,
            a.v || jsonb_build_object('asset',cc.asset,'assets',cc.assets) cosmetico
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
revoke all on function public.cosmeticos(),public.pase_temporada(text),private.catalogo_pase_inmutable() from public,anon,authenticated;
grant execute on function public.cosmeticos(),public.pase_temporada(text) to authenticated;
commit;
