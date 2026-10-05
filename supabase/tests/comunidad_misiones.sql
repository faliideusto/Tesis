-- Requiere ambas migraciones. Solo base de pruebas; todo se revierte.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('30000000-0000-0000-0000-000000000001','{"display_name":"Ada"}'),
 ('30000000-0000-0000-0000-000000000002','{"display_name":"Lin"}'),
 ('30000000-0000-0000-0000-000000000003','{"display_name":"Sol"}');
-- Fixture controlado: activación ayer, resultados antiguos y siete actuales.
update private.community_settings set activated_at = date_trunc('day',now()) - interval '1 day';
insert into private.matches(id,result_hash,version,completed_at)
select ('40000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,repeat('a',64),1,
 case when n = 0 then now() - interval '2 days' else now() end from generate_series(0,7) n;
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner)
select id,0,'30000000-0000-0000-0000-000000000001','Ada',10,true from private.matches;
update private.match_participants set user_id = '30000000-0000-0000-0000-000000000003', display_name = 'Sol'
where match_id = '40000000-0000-0000-0000-000000000000';
insert into private.matches(id,result_hash,version,completed_at)
values ('40000000-0000-0000-0000-000000000008',repeat('b',64),1,now() + interval '1 day');
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner)
values ('40000000-0000-0000-0000-000000000008',0,'30000000-0000-0000-0000-000000000003','Sol',10,true);
update public.profiles set xp = 700,games_finished = 7,wins = 7 where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set xp = 700,games_finished = 7,wins = 7 where id = '30000000-0000-0000-0000-000000000002';
select set_config('test.friend.ada',(select friend_code from public.profiles where id = '30000000-0000-0000-0000-000000000001'),true);
select set_config('test.friend.lin',(select friend_code from public.profiles where id = '30000000-0000-0000-0000-000000000002'),true);
do $$
begin
 if has_function_privilege('anon','public.comunidad()','execute')
    or has_function_privilege('authenticated','private.misiones_actuales(uuid)','execute')
    or has_column_privilege('authenticated','public.profiles','friend_code','update') then raise exception 'Permisos excesivos'; end if;
 if exists(select 1 from public.profiles where friend_code !~ '^[0-9A-F]{16}$') then raise exception 'Código inseguro'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$
declare v jsonb; mid text; antes bigint; tarea jsonb;
begin
 if jsonb_array_length(public.comunidad()->'amigos') <> 0 then raise exception 'Estado inicial'; end if;
 v := public.amistad(lower(current_setting('test.friend.lin')),'solicitar');
 if jsonb_array_length(v->'enviadas') <> 1 then raise exception 'Solicitud'; end if;
 perform public.amistad(current_setting('test.friend.lin'),'solicitar');
 begin perform public.amistad(current_setting('test.friend.lin'),'aceptar'); raise exception 'Aceptó solicitante'; exception when invalid_parameter_value then null; end;
 begin perform public.amistad(current_setting('test.friend.ada'),'solicitar'); raise exception 'Autoamistad'; exception when invalid_parameter_value then null; end;
 begin perform public.amistad(current_setting('test.friend.lin'),'desconocida'); raise exception 'Acción inválida'; exception when invalid_parameter_value then null; end;
 v := public.ranking('xp');
 if (v->'propia'->>'posicion')::int <> 1 or jsonb_array_length(v->'entradas') <> 3 then raise exception 'Ranking'; end if;
 if v::text like '%30000000%' then raise exception 'Filtración de UUID'; end if;
 if (v->'entradas'->1->>'posicion')::int <> 1 then raise exception 'Empates'; end if;
 begin perform public.ranking('invalido'); raise exception 'Criterio'; exception when invalid_parameter_value then null; end;
 v := public.misiones();
 if jsonb_array_length(v->'diarias') <> 2 or jsonb_array_length(v->'semanales') <> 3
    or (v->'semanales'->2->>'progreso')::int <> 7 then raise exception 'Misiones'; end if;
 select xp into antes from public.profiles;
 mid := v->'diarias'->0->>'id';
 v := public.reclamar_mision(mid);
 if not (v->'diarias'->0->>'reclamada')::boolean then raise exception 'Recibo'; end if;
 perform public.reclamar_mision(mid);
 if (select xp from public.profiles) <> antes + 50 then raise exception 'Doble XP'; end if;
 for tarea in select value from jsonb_array_elements((v->'diarias') || (v->'semanales')) loop
    perform public.reclamar_mision(tarea->>'id');
 end loop;
 if (select xp from public.profiles) <> antes + 575 then raise exception 'Recompensas del catálogo incorrectas'; end if;
 begin perform public.reclamar_mision('diarias:jugar1:2000-01-01'); raise exception 'Misión caducada'; exception when invalid_parameter_value then null; end;
 if (select count(*) from public.profiles) <> 1 then raise exception 'RLS'; end if;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
do $$
declare v jsonb;
begin
 -- Solicitud inversa no crea fila ni acepta amistad sin consentimiento.
 v := public.amistad(current_setting('test.friend.ada'),'solicitar');
 if jsonb_array_length(v->'recibidas') <> 1 or jsonb_array_length(v->'amigos') <> 0 then raise exception 'Inversa'; end if;
 begin perform public.amistad(current_setting('test.friend.ada'),'cancelar'); raise exception 'Canceló receptor'; exception when invalid_parameter_value then null; end;
 v := public.amistad(current_setting('test.friend.ada'),'aceptar');
 if jsonb_array_length(v->'amigos') <> 1 then raise exception 'Aceptar'; end if;
 perform public.amistad(current_setting('test.friend.ada'),'aceptar');
 perform public.amistad(current_setting('test.friend.ada'),'eliminar');
 perform public.amistad(current_setting('test.friend.ada'),'solicitar');
 begin perform public.reclamar_mision(public.misiones()->'diarias'->0->>'id'); raise exception 'Misión incompleta'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.amistad(current_setting('test.friend.lin'),'rechazar');
select public.amistad(current_setting('test.friend.lin'),'solicitar');
select public.amistad(current_setting('test.friend.lin'),'cancelar');
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.comunidad(); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Ventanas UTC independientemente de zona horaria de la conexión.
set local timezone = 'Pacific/Honolulu';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$ declare v jsonb; begin
 v := public.misiones();
 if (v->'diarias'->0->>'progreso')::int <> 0 then raise exception 'Resultado antiguo o futuro contó'; end if;
 if (v->>'reinicioDiario')::timestamptz <> (date_trunc('day',now() at time zone 'UTC') + interval '1 day') at time zone 'UTC'
    or (v->>'reinicioSemanal')::timestamptz <> (date_trunc('week',now() at time zone 'UTC') + interval '1 week') at time zone 'UTC' then
    raise exception 'Ventanas distintas de UTC';
 end if;
end $$;
reset role;
-- Ni el resultado anterior a activación ni uno futuro cuentan para completar.
update private.community_settings set activated_at = now() + interval '1 hour';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$ begin
 if (public.misiones()->'diarias'->0->>'progreso')::int <> 0 then raise exception 'Retroactividad'; end if;
end $$;
reset role;
-- Posición propia fuera del top 50.
insert into auth.users(id,raw_user_meta_data)
select ('50000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'{"display_name":"Clasificado"}'::jsonb from generate_series(1,55) n;
update public.profiles set xp = 10000 where id::text like '50000000%';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$ begin
 if jsonb_array_length(public.ranking()->'entradas') <> 50
    or (public.ranking()->'propia'->>'posicion')::int <> 58 then raise exception 'Top y propia'; end if;
end $$;
reset role;
rollback;
