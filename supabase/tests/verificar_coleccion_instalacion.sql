-- Solo lectura administrativa: sin usuarios ficticios ni operaciones sobre inventario.
select '01_catalogo_interaccion' control, case when exists (
 select 1 from pg_constraint where conrelid='private.cosmetics_catalog'::regclass
 and conname='cosmetics_catalog_kind_check' and pg_get_constraintdef(oid) like '%interaccion%'
) then 'PASS' else 'FAIL' end resultado
union all select '02_loadout_interaccion', case when exists (
 select 1 from pg_constraint where conrelid='private.cosmetics_loadout'::regclass
 and conname='cosmetics_loadout_kind_check' and pg_get_constraintdef(oid) like '%interaccion%'
) then 'PASS' else 'FAIL' end
union all select '03_rpc_coleccion', case when
 pg_get_functiondef('public.cosmeticos()'::regprocedure) like '%catalogo%'
 and pg_get_functiondef('public.cosmeticos()'::regprocedure) like '%temporadas%'
 and pg_get_functiondef('public.cosmeticos()'::regprocedure) like '%interaccion%'
 then 'PASS' else 'FAIL' end
union all select '04_equipar_interaccion', case when
 pg_get_functiondef('public.equipar_cosmetico(text,text)'::regprocedure) like '%interaccion%'
 then 'PASS' else 'FAIL' end
union all select '05_permisos_rpc', case when
 has_function_privilege('authenticated','public.cosmeticos()','EXECUTE')
 and has_function_privilege('authenticated','public.equipar_cosmetico(text,text)','EXECUTE')
 and not has_function_privilege('anon','public.cosmeticos()','EXECUTE')
 and not has_function_privilege('anon','public.equipar_cosmetico(text,text)','EXECUTE')
 then 'PASS' else 'FAIL' end
union all select '06_catalogo_inicial_intacto', case when
 (select count(*) from private.cosmetics_catalog)=11
 and not exists(select 1 from private.cosmetics_catalog where kind='interaccion')
 then 'PASS' else 'FAIL' end
order by control;
