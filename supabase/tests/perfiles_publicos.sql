begin;
insert into auth.users(id,email,raw_user_meta_data) values
('71000000-0000-0000-0000-000000000001','privado@example.com','{"display_name":"Ada"}'),
('71000000-0000-0000-0000-000000000002','secreto@example.com','{"display_name":"Lin"}'),
('71000000-0000-0000-0000-000000000003','oculto@example.com','{"display_name":"Sol"}');
update public.profiles set friend_code = 'ABCDEF000000000' || right(id::text,1),xp=1000,games_finished=8,wins=3
where id::text like '71000000%';
insert into private.friendships(user_low,user_high,requester,accepted) values
('71000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001',true),
('71000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001',false);
insert into private.account_presence(user_id,last_seen_at) select id,clock_timestamp() from public.profiles where id::text like '71000000%';
do $$ begin
 if has_function_privilege('anon','public.perfil_publico(text)','execute') then raise exception 'Perfil anónimo'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb;
begin
 v := public.perfil_publico('abcdef0000000002');
 if v->>'nombre' <> 'Lin' or (v->>'nivel')::int <> 3 or (v->>'xp')::int <> 1000
    or (v->>'partidasTerminadas')::int <> 8 or (v->>'victorias')::int <> 3
    or not (v->>'enLinea')::boolean or not (v->>'presenciaDisponible')::boolean then raise exception 'Perfil público incorrecto'; end if;
 if (select count(*) from jsonb_object_keys(v)) <> 8 or v::text like '%71000000-%'
    or v::text like '%example.com%' or v::text like '%last_seen%' then raise exception 'Perfil filtra datos'; end if;
 v := public.perfil_publico('ABCDEF0000000003');
 if (v->>'enLinea')::boolean or (v->>'presenciaDisponible')::boolean then raise exception 'Solicitud revela presencia'; end if;
 v := public.perfil_publico('ABCDEF0000000001');
 if not (v->>'presenciaDisponible')::boolean then raise exception 'Propio sin presencia'; end if;
 begin perform public.perfil_publico('ABCDEF0000000099'); raise exception 'Desconocido aceptado'; exception when no_data_found then null; end;
 begin perform public.perfil_publico('ABC'); raise exception 'Código inválido'; exception when invalid_parameter_value then null; end;
 begin perform public.perfil_publico(null); raise exception 'Código nulo'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
delete from private.friendships where user_high = '71000000-0000-0000-0000-000000000003';
update private.account_presence set last_seen_at = clock_timestamp() - interval '91 seconds'
where user_id = '71000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ declare v jsonb;
begin
 v := public.perfil_publico('ABCDEF0000000003');
 if (v->>'enLinea')::boolean or (v->>'presenciaDisponible')::boolean then raise exception 'Desconocido revela presencia'; end if;
 v := public.perfil_publico('ABCDEF0000000002');
 if (v->>'enLinea')::boolean or not (v->>'presenciaDisponible')::boolean then raise exception 'Caducidad perfil'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.perfil_publico('ABCDEF0000000002'); raise exception 'Sin actor'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
