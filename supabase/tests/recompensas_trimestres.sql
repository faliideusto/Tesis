-- Nuevo balance, empates, idempotencia y conservación de recibos. Rollback completo.
begin;
insert into auth.users(id,raw_user_meta_data) values
('83000000-0000-0000-0000-000000000001','{"display_name":"Uno"}'),
('83000000-0000-0000-0000-000000000002','{"display_name":"Dos"}'),
('83000000-0000-0000-0000-000000000003','{"display_name":"Tres"}'),
('83000000-0000-0000-0000-000000000004','{"display_name":"Cuatro"}');
select public.registrar_resultado('84000000-0000-0000-0000-000000000001',repeat('f',64),now(),
'[{"seat":0,"user_id":"83000000-0000-0000-0000-000000000001","display_name":"Uno","prestige":12,"winner":true},
{"seat":1,"user_id":"83000000-0000-0000-0000-000000000002","display_name":"Dos","prestige":8,"winner":false},
{"seat":2,"user_id":"83000000-0000-0000-0000-000000000003","display_name":"Tres","prestige":3,"winner":false},
{"seat":3,"user_id":"83000000-0000-0000-0000-000000000004","display_name":"Cuatro","prestige":8,"winner":false}]');
-- Reintento devuelve recibos, no vuelve a aplicar XP ni pase.
select public.registrar_resultado('84000000-0000-0000-0000-000000000001',repeat('f',64),now(),
'[{"seat":0,"user_id":"83000000-0000-0000-0000-000000000001","display_name":"Uno","prestige":12,"winner":true},
{"seat":1,"user_id":"83000000-0000-0000-0000-000000000002","display_name":"Dos","prestige":8,"winner":false},
{"seat":2,"user_id":"83000000-0000-0000-0000-000000000003","display_name":"Tres","prestige":3,"winner":false},
{"seat":3,"user_id":"83000000-0000-0000-0000-000000000004","display_name":"Cuatro","prestige":8,"winner":false}]');
do $$ declare actor uuid; antes bigint; sid text;
begin
 if (select xp from public.profiles where id='83000000-0000-0000-0000-000000000001')<>300
 or (select xp from public.profiles where id='83000000-0000-0000-0000-000000000002')<>200
 or (select points from private.pass_progress where user_id='83000000-0000-0000-0000-000000000001')<>400
 or (select points from private.pass_progress where user_id='83000000-0000-0000-0000-000000000002')<>300
 or (select points from private.pass_progress where user_id='83000000-0000-0000-0000-000000000003')<>200
 or (select points from private.pass_progress where user_id='83000000-0000-0000-0000-000000000004')<>300 then raise exception 'Balance/empate/idempotencia'; end if;
 sid:=private.registrar_temporada(now());
 for actor in select id from public.profiles where id::text like '83000000%' loop
  select points into antes from private.pass_progress where user_id=actor and season_id=sid;
  perform private.sincronizar_pase(actor,sid); perform private.sincronizar_pase(actor,sid);
  if (select points from private.pass_progress where user_id=actor and season_id=sid)<>antes then raise exception 'Backfill duplica'; end if;
 end loop;
 if (select id from private.metadatos_temporada('2026-11-15T12:00:00Z'))<>'temporada:2026-10'
 or (select fin from private.metadatos_temporada('2026-11-15T12:00:00Z'))<>'2026-12-31T23:00:00Z'
 or (select id from private.metadatos_temporada('2027-01-01T00:00:00Z'))<>'temporada:2027-01'
 or (select fin from private.metadatos_temporada('2027-01-01T00:00:00Z'))<>'2027-03-31T22:00:00Z'
 then raise exception 'Trimestres/DST'; end if;
 if exists(select 1 from private.ventana_ranking('temporada',now()) r cross join private.metadatos_temporada(now()) p where r.id<>p.id or r.fin<>p.fin)
 then raise exception 'Ranking separado de pase'; end if;
 if has_function_privilege('authenticated','private.puntos_partida_pase(uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.registrar_resultado(uuid,text,timestamptz,jsonb,integer)','execute') then raise exception 'Permisos'; end if;
end $$;
select public.registrar_resultado('84000000-0000-0000-0000-000000000002',repeat('b',64),now(),
'[{"seat":0,"user_id":"83000000-0000-0000-0000-000000000001","display_name":"Uno","prestige":12,"winner":true},
{"seat":1,"user_id":"83000000-0000-0000-0000-000000000002","display_name":"Dos","prestige":12,"winner":true},
{"seat":2,"user_id":"83000000-0000-0000-0000-000000000003","display_name":"Tres","prestige":3,"winner":false}]');
do $$ begin
 if (select pass_points from private.reward_ledger where match_id='84000000-0000-0000-0000-000000000002' and user_id='83000000-0000-0000-0000-000000000001')<>400
 or (select pass_points from private.reward_ledger where match_id='84000000-0000-0000-0000-000000000002' and user_id='83000000-0000-0000-0000-000000000002')<>400
 or (select pass_points from private.reward_ledger where match_id='84000000-0000-0000-0000-000000000002' and user_id='83000000-0000-0000-0000-000000000003')<>300
 or exists(select 1 from private.reward_ledger where match_id='84000000-0000-0000-0000-000000000002' and xp<>case when user_id='83000000-0000-0000-0000-000000000003' then 200 else 300 end)
 then raise exception 'Empate de ganadores'; end if;
end $$;
rollback;
