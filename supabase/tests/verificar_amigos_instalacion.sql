-- Solo lectura: controles posteriores a la migración de presencia y sugerencias.
with controles as (
select 'Tabla privada con RLS' comprobacion,
  (select relrowsecurity from pg_class where oid='private.account_presence'::regclass) correcto
union all select 'Sin acceso directo del navegador',
  not has_table_privilege('anon','private.account_presence','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','private.account_presence','SELECT,INSERT,UPDATE,DELETE')
union all select 'Servidor con acceso a presencia',
  has_table_privilege('service_role','private.account_presence','SELECT')
  and has_table_privilege('service_role','private.account_presence','INSERT')
  and has_table_privilege('service_role','private.account_presence','UPDATE')
union all select 'Dos RPC autenticadas y sin acceso anonimo',
  has_function_privilege('authenticated','public.presencia()','EXECUTE')
  and has_function_privilege('authenticated','public.comunidad()','EXECUTE')
  and not has_function_privilege('anon','public.presencia()','EXECUTE')
  and not has_function_privilege('anon','public.comunidad()','EXECUTE')
union all select 'Dos RPC definer con search_path vacio',
  (select count(*)=2 and bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc where oid in ('public.presencia()'::regprocedure,'public.comunidad()'::regprocedure))
union all select 'Actor autenticado en ambas RPC',
  position('private.actor_comunidad()' in pg_get_functiondef('public.presencia()'::regprocedure))>0
  and position('private.actor_comunidad()' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
union all select 'Una presencia por perfil y clave foranea',
  (select count(*)=2 from pg_constraint where conrelid='private.account_presence'::regclass and contype in ('p','f'))
union all select 'Presencia caduca a los 90 segundos',
  position('90 seconds' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
union all select 'Sugerencias y disponibilidad instaladas',
  position('''sugerencias''' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
  and position('''presenciaDisponible'',true' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
union all select 'Sugerencias limitadas y excluyen relaciones',
  position('limit 12' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
  and position('not exists' in pg_get_functiondef('public.comunidad()'::regprocedure))>0
) select * from controles order by comprobacion;
