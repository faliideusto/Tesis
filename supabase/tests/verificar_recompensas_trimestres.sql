-- Verificación de solo lectura: no inserta usuarios, resultados ni reclamaciones.
with checks(nombre,ok) as (
 select 'Calendario Crónicas octubre/diciembre',
   (select id='temporada:2026-10' and fin='2026-12-31T23:00:00Z'::timestamptz from private.metadatos_temporada('2026-10-07T12:00:00Z'))
   and (select id='temporada:2026-10' and fin='2026-12-31T23:00:00Z'::timestamptz from private.metadatos_temporada('2026-11-15T12:00:00Z'))
   and (select id='temporada:2026-10' and fin='2026-12-31T23:00:00Z'::timestamptz from private.metadatos_temporada('2026-12-31T22:59:59Z'))
 union all select 'Nueva temporada enero y DST marzo',
   (select id='temporada:2027-01' and fin='2027-03-31T22:00:00Z'::timestamptz from private.metadatos_temporada('2026-12-31T23:00:00Z'))
 union all select 'Ranking comparte temporada',
   exists(select 1 from private.ventana_ranking('temporada',now()) r join private.metadatos_temporada(now()) p using(id,inicio,fin))
 union all select 'Recompensas diarias/semanales',
   (select array_agg(xp order by id) from private.misiones_actuales(null))=array[150,100,300,200,400]
 union all select 'Recompensas de temporada',
   (select array_agg(xp order by id) from private.misiones_temporada_actuales(null))=array[1500,1000]
 union all select 'Puntos de partida independientes',
   exists(select 1 from information_schema.columns where table_schema='private' and table_name='reward_ledger' and column_name='pass_points' and data_type='integer')
   and position('private.puntos_partida_pase' in pg_get_functiondef('public.registrar_resultado(uuid,text,timestamptz,jsonb,integer)'::regprocedure))>0
   and position('coalesce(NEW.pass_points,NEW.xp)' in pg_get_functiondef('private.recibo_pase_trigger()'::regprocedure))>0
 union all select 'Clasificación de segundo puesto y bonos',
   position('dense_rank()' in pg_get_functiondef('private.puntos_partida_pase(uuid,uuid)'::regprocedure))>0
   and position('when posicion=1 then 200 when posicion=2 then 100' in pg_get_functiondef('private.puntos_partida_pase(uuid,uuid)'::regprocedure))>0
 union all select 'XP partida duplicada 200+100',
   position('xp = xp + 200 + case when participante.winner then 100 else 0 end' in pg_get_functiondef('public.registrar_resultado(uuid,text,timestamptz,jsonb,integer)'::regprocedure))>0
 union all select 'Funciones privadas restringidas',
   not has_function_privilege('authenticated','private.puntos_partida_pase(uuid,uuid)','execute')
   and not has_function_privilege('anon','private.puntos_partida_pase(uuid,uuid)','execute')
   and not has_function_privilege('authenticated','public.registrar_resultado(uuid,text,timestamptz,jsonb,integer)','execute')
   and not has_function_privilege('authenticated','private.metadatos_temporada(timestamptz)','execute')
 union all select 'Recibos de pase conservan claves únicas',
   exists(select 1 from pg_constraint where conrelid='private.pass_receipts'::regclass and contype='p')
)
select nombre,case when ok then 'PASS' else 'FAIL' end resultado from checks order by nombre;
