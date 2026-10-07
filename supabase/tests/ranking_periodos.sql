begin;
-- Fronteras civiles: DST de marzo/octubre, febrero bisiesto y cambio de año.
do $$ declare v record;
begin
 select * into v from private.ventana_ranking('semanal','2026-03-29T12:00:00Z');
 if v.inicio <> '2026-03-22T23:00:00Z' or v.fin <> '2026-03-29T22:00:00Z'
    or extract(epoch from v.fin-v.inicio)/3600 <> 167 then raise exception 'Semana DST primavera'; end if;
 select * into v from private.ventana_ranking('semanal','2026-10-25T12:00:00Z');
 if extract(epoch from v.fin-v.inicio)/3600 <> 169 then raise exception 'Semana DST otoño'; end if;
 select * into v from private.ventana_ranking('temporada','2024-02-29T22:59:59Z');
 if v.id <> 'temporada:2024-02' or v.inicio <> '2024-01-31T23:00:00Z' or v.fin <> '2024-02-29T23:00:00Z' then raise exception 'Mes bisiesto'; end if;
 select * into v from private.ventana_ranking('temporada','2024-02-29T23:00:00Z');
 if v.id <> 'temporada:2024-03' then raise exception 'Cambio mensual exacto'; end if;
 select * into v from private.ventana_ranking('temporada','2026-12-31T23:00:00Z');
 if v.id <> 'temporada:2027-01' then raise exception 'Cambio año'; end if;
 if has_function_privilege('anon','public.ranking_periodo(text,text)','execute')
    or has_function_privilege('authenticated','private.ventana_ranking(text,timestamptz)','execute') then raise exception 'Permisos ranking'; end if;
end $$;
insert into auth.users(id,raw_user_meta_data)
select ('73000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,jsonb_build_object('display_name','Investigador '||n) from generate_series(1,55) n;
update public.profiles set friend_code = 'AA' || lpad(right(id::text,12),14,'0'),xp = 100000,games_finished=20,wins=10 where id::text like '73000000%';
update public.profiles set xp = 0,games_finished=0,wins=0 where id='73000000-0000-0000-0000-000000000055';
insert into private.friendships(user_low,user_high,requester,accepted) values
('73000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000055','73000000-0000-0000-0000-000000000055',true),
('73000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000055','73000000-0000-0000-0000-000000000055',false);
-- Una partida y misión en ambas ventanas, otra antes del inicio y otra futura.
insert into private.matches(id,result_hash,version,completed_at) values
('74000000-0000-0000-0000-000000000001',repeat('a',64),1,now()),
('74000000-0000-0000-0000-000000000002',repeat('b',64),1,now()-interval '40 days'),
('74000000-0000-0000-0000-000000000003',repeat('c',64),1,now()+interval '40 days');
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner)
select m.id,0,'73000000-0000-0000-0000-000000000001','Investigador 1',10,true from private.matches m where m.id::text like '74000000%';
insert into private.reward_ledger(match_id,user_id,xp,version)
select m.id,'73000000-0000-0000-0000-000000000001',150,1 from private.matches m where m.id::text like '74000000%';
insert into private.mission_claims(user_id,mission_id,xp,claimed_at) values
('73000000-0000-0000-0000-000000000001','test:actual',75,now()),
('73000000-0000-0000-0000-000000000001','test:pasada',75,now()-interval '40 days'),
('73000000-0000-0000-0000-000000000001','test:futura',75,now()+interval '40 days');
-- Borde inferior exacto del período: cuenta; un microsegundo antes queda fuera.
insert into private.matches(id,result_hash,version,completed_at)
select ('75000000-0000-0000-0000-00000000000' || n)::uuid,repeat('d',64),1,v.inicio - case n when 1 then interval '0' else interval '1 microsecond' end
from private.ventana_ranking('semanal',now()) v cross join generate_series(1,2) n;
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner)
select id,0,'73000000-0000-0000-0000-000000000003','Investigador 3',0,false from private.matches where id::text like '75000000%';
insert into private.reward_ledger(match_id,user_id,xp,version)
select id,'73000000-0000-0000-0000-000000000003',100,1 from private.matches where id::text like '75000000%';
set local role authenticated;
select set_config('request.jwt.claim.sub','73000000-0000-0000-0000-000000000055',true);
do $$ declare v jsonb; ambito text;
begin
 v := public.ranking_periodo('xp','global');
 if jsonb_array_length(v->'entradas') <> 50 or (v->'propia'->>'posicion')::int <> 55
    or v->'periodo' <> 'null'::jsonb or (v->'entradas'->1->>'posicion')::int <> 1 then raise exception 'Top/propia/empates'; end if;
 v := public.ranking_periodo('xp','amigos');
 if jsonb_array_length(v->'entradas') <> 2 or (v->'propia'->>'posicion')::int <> 2 then raise exception 'Ranking amistades aceptadas'; end if;
 foreach ambito in array array['semanal','temporada'] loop
    v := public.ranking_periodo('xp',ambito);
    if (v->'entradas'->0->>'xp')::int <> 225 or (v->'entradas'->0->>'partidas')::int <> 1
       or (v->'entradas'->0->>'victorias')::int <> 1 or (v->'entradas'->0->>'nivel')::int <> 201
       or v->'periodo'->>'zonaHoraria' <> 'Europe/Madrid' then raise exception 'Agregación temporal/nivel %',ambito; end if;
    if ambito = 'semanal' and ((v->'entradas'->1->>'xp')::int <> 100 or (v->'entradas'->1->>'partidas')::int <> 1)
       then raise exception 'Borde inferior semana'; end if;
    if not exists(select 1 from jsonb_array_elements(v->'entradas') e where (e->>'xp')::int = 0)
       then raise exception 'Zero temporal'; end if;
    if v::text like '%73000000-%' or v::text like '%user_id%' then raise exception 'Filtración'; end if;
 end loop;
 begin perform public.ranking_periodo('xp','inventado'); raise exception 'Ámbito inválido'; exception when invalid_parameter_value then null; end;
 begin perform public.ranking_periodo('inventado','global'); raise exception 'Criterio inválido'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.ranking_periodo('xp','global'); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
