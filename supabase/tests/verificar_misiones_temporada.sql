-- Solo lectura administrativa; no crea ni expone usuarios, partidas o reclamaciones.
select '1. Extensión mensual instalada' control,
    case when to_regprocedure('private.misiones_temporada_actuales(uuid,timestamptz)') is not null then 'PASS' else 'FAIL' end resultado
union all select '2. RPC mensual y puntos',case when
    position('reinicioTemporada' in pg_get_functiondef('public.misiones()'::regprocedure))>0
    and position('puntosPase' in pg_get_functiondef('public.misiones()'::regprocedure))>0
    and position('misiones_temporada_actuales' in pg_get_functiondef('public.reclamar_mision(text)'::regprocedure))>0 then 'PASS' else 'FAIL' end
union all select '3. Calendario compartido',case when
    (select fin from private.metadatos_temporada(now()))=(select fin from private.ventana_ranking('temporada',now()))
    and position('metadatos_temporada' in pg_get_functiondef(to_regprocedure('private.misiones_temporada_actuales(uuid,timestamptz)')))>0 then 'PASS' else 'FAIL' end
union all select '4. Permisos limitados',case when
    not has_function_privilege('anon','public.misiones()','execute')
    and not has_function_privilege('anon','public.reclamar_mision(text)','execute')
    and not has_function_privilege('authenticated',to_regprocedure('private.misiones_temporada_actuales(uuid,timestamptz)'),'execute')
    and has_function_privilege('authenticated','public.misiones()','execute') then 'PASS' else 'FAIL' end
union all select '5. Recibos de misión conectados al pase',case when exists(
    select 1 from pg_trigger where tgrelid='private.mission_claims'::regclass and tgname='recibo_mision_pase' and tgenabled='O')
    then 'PASS' else 'FAIL' end;
