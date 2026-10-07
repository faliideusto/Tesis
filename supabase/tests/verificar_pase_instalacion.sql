-- Sólo lectura. Ejecutar como postgres tras instalar 202610070005.
-- No muestra cuentas, UUID, tokens ni datos individuales.
with tablas as (
    select c.oid,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname in
        ('pass_seasons','pass_reward_templates','cosmetics_catalog','pass_rewards','pass_progress',
         'pass_receipts','cosmetics_inventory','cosmetics_loadout','pass_claims')
), funciones as (
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
        ('pase_temporada','reclamar_recompensa_temporada','cosmeticos','equipar_cosmetico')
), vigente as (
    select * from private.metadatos_temporada(now())
), fuentes as (
    select r.user_id,'partida'::text tipo,r.match_id::text clave,r.xp puntos,m.completed_at fecha
    from private.reward_ledger r join private.matches m on m.id=r.match_id cross join vigente v
    where m.completed_at >= v.inicio and m.completed_at < v.fin and m.completed_at <= now()
    union all
    select m.user_id,'mision',m.mission_id,m.xp,m.claimed_at
    from private.mission_claims m cross join vigente v
    where m.claimed_at >= v.inicio and m.claimed_at < v.fin and m.claimed_at <= now()
), controles as (
    select '01 Tablas privadas' control,(select count(*)=9 from tablas) correcto
    union all select '02 RLS activo',(select count(*)=9 and bool_and(relrowsecurity) from tablas)
    union all select '03 Sin acceso directo de navegador',not exists(
        select 1 from tablas cross join (values('anon'),('authenticated')) roles(nombre)
        where has_table_privilege(roles.nombre,tablas.oid,'SELECT,INSERT,UPDATE,DELETE'))
    union all select '04 Cuatro RPC autenticadas',(select count(*)=4 and bool_and(
        has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE')) from funciones)
    union all select '05 Helpers privados',not exists(
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private' and p.proname in
            ('metadatos_temporada','registrar_temporada','anotar_puntos_pase','recibo_pase_trigger',
             'sincronizar_pase','catalogo_pase_inmutable','validar_bundle_pase')
        and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')))
    union all select '06 Temporada gratuita mensual',exists(
        select 1 from private.pass_seasons s join vigente v on s.id=v.id
        where s.name='Crónicas del Archivo' and s.free and s.max_level=10 and s.points_per_level=500
        and s.starts_at=v.inicio and s.ends_at=v.fin and s.timezone='Europe/Madrid')
    union all select '07 Diez niveles con recompensa',(select count(*)=10 and count(distinct level)=10
        and min(level)=1 and max(level)=10 from private.pass_rewards where season_id=(select id from vigente))
    union all select '08 Once cosméticos y seis tipos',(select count(*)=11 and count(distinct kind)=6 from private.cosmetics_catalog)
    union all select '09 Set final completo',exists(
        select 1 from private.pass_rewards r where r.season_id=(select id from vigente) and r.level=10
        and cardinality(r.cosmetic_ids)=2 and jsonb_array_length(r.cosmetic_snapshot)=2
        and (select count(*)=2 and count(distinct kind)=2 and bool_and(rarity='legendario')
             from private.cosmetics_catalog c where c.id=any(r.cosmetic_ids) and c.kind in ('marco','insignia')))
    union all select '10 Calendario compartido con ranking',exists(
        select 1 from vigente v join private.ventana_ranking('temporada',now()) r
        on r.id=v.id and r.inicio=v.inicio and r.fin=v.fin)
    union all select '11 Triggers de recibos activos',(select count(*)=2 from pg_trigger
        where tgname in ('recibo_partida_pase','recibo_mision_pase') and not tgisinternal and tgenabled='O')
    union all select '12 Recibos actuales recuperados',not exists(
        select 1 from fuentes f left join private.pass_receipts r
        on r.user_id=f.user_id and r.source_kind=f.tipo and r.source_key=f.clave
        where r.user_id is null or r.points<>f.puntos or r.occurred_at<>f.fecha or r.season_id<>(select id from vigente))
    union all select '13 Progreso coherente con recibos',not exists(
        select 1 from (select user_id,season_id,sum(points) puntos from private.pass_receipts group by user_id,season_id) r
        full join private.pass_progress p using(user_id,season_id)
        where coalesce(p.points,0)<>coalesce(r.puntos,0))
    union all select '14 Equipamiento propio y del tipo correcto',not exists(
        select 1 from private.cosmetics_loadout l left join private.cosmetics_inventory i
        on i.user_id=l.user_id and i.cosmetic_id=l.cosmetic_id and i.kind=l.kind where i.user_id is null)
    union all select '15 Inventario respaldado por catálogo',not exists(
        select 1 from private.cosmetics_inventory i left join private.cosmetics_catalog c
        on c.id=i.cosmetic_id and c.kind=i.kind where c.id is null)
)
select control,case when correcto then 'PASS' else 'FAIL' end resultado from controles order by control;
