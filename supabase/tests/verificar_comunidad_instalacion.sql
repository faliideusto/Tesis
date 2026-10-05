-- Comprobación de solo lectura tras aplicar la migración de comunidad.
with controles as (
select 'Tres tablas nuevas con RLS' as comprobacion, (select count(*)=3 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('community_settings','friendships','mission_claims')) as correcto
union all select 'Cinco RPC para usuarios autenticados', (select count(*)=5 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('comunidad','amistad','ranking','misiones','reclamar_mision'))
union all select 'Sin RPC para usuarios anonimos', (select count(*)=5 and not bool_or(has_function_privilege('anon',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('comunidad','amistad','ranking','misiones','reclamar_mision'))
union all select 'Tablas privadas sin acceso directo', not has_table_privilege('authenticated','private.friendships','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','private.mission_claims','SELECT,INSERT,UPDATE,DELETE')
union all select 'Helpers privados sin acceso del navegador', not has_function_privilege('authenticated','private.actor_comunidad()','EXECUTE') and not has_function_privilege('authenticated','private.misiones_actuales(uuid)','EXECUTE')
union all select 'Codigo amigo protegido contra escritura', not has_column_privilege('authenticated','public.profiles','friend_code','UPDATE')
union all select 'Codigos existentes validos y unicos', not exists(select 1 from public.profiles where friend_code is null or friend_code !~ '^[0-9A-F]{16}$') and (select count(*)=count(distinct friend_code) from public.profiles)
union all select 'Cinco misiones activas y 575 XP', (select count(*)=5 and sum(xp)=575 from private.misiones_actuales(null))
union all select 'Activacion de misiones registrada', (select count(*)=1 and bool_and(activated_at<=now()) from private.community_settings)
union all select 'XP y estadisticas protegidas', not has_column_privilege('authenticated','public.profiles','xp','UPDATE') and not has_column_privilege('authenticated','public.profiles','wins','UPDATE') and not has_column_privilege('authenticated','public.profiles','games_finished','UPDATE')
) select * from controles order by comprobacion;
