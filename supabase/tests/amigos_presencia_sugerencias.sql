-- Base de pruebas vacía, tres migraciones aplicadas. Todo revierte.
begin;
insert into auth.users(id,raw_user_meta_data)
select ('70000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
    jsonb_build_object('display_name','Investigador ' || n) from generate_series(1,20) n;
update public.profiles set friend_code = lpad(right(id::text,12),16,'0'),
    xp = case when right(id::text,12)::integer = 20 then 50000 else 0 end
where id::text like '70000000%';
insert into private.friendships(user_low,user_high,requester,accepted) values
('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001',true),
('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001',false),
('70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000004',false);
do $$ begin
 if has_function_privilege('anon','public.presencia()','execute')
    or has_table_privilege('authenticated','private.account_presence','select')
    or has_table_privilege('authenticated','private.account_presence','update')
    or not (select relrowsecurity from pg_class where oid = 'private.account_presence'::regclass)
 then raise exception 'Permisos presencia excesivos'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);
select public.presencia();
select public.presencia();
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000003',true);
select public.presencia();
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; s jsonb;
begin
 v := public.comunidad();
 if not (v->>'presenciaDisponible')::boolean or not (v->'amigos'->0->>'enLinea')::boolean
    or (v->'enviadas'->0->>'enLinea')::boolean then raise exception 'Presencia o privacidad'; end if;
 if jsonb_array_length(v->'sugerencias') <> 12
    or v->'sugerencias'->0->>'codigo' <> '0000000000000005' then raise exception 'Límite/orden sugerencias'; end if;
 for s in select value from jsonb_array_elements(v->'sugerencias') loop
    if s->>'codigo' in ('0000000000000001','0000000000000002','0000000000000003','0000000000000004','0000000000000020')
       or (s->>'enLinea')::boolean then raise exception 'Sugerencia excluida o presencia desconocida'; end if;
 end loop;
 if v::text like '%70000000-%' or v::text like '%last_seen%' then raise exception 'Filtración'; end if;
 -- Una solicitud elimina inmediatamente al candidato de sugerencias.
 v := public.amistad('0000000000000005','solicitar');
 if v->'sugerencias'->0->>'codigo' <> '0000000000000006' then raise exception 'Sugerencia pendiente'; end if;
 begin perform (select last_seen_at from private.account_presence limit 1); raise exception 'Lectura privada';
 exception when insufficient_privilege then null; end;
 begin update private.account_presence set last_seen_at = clock_timestamp(); raise exception 'Escritura privada';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Simula el paso del tiempo sin esperar 90 segundos.
update private.account_presence set last_seen_at = clock_timestamp() - interval '91 seconds';
set local role authenticated;
do $$ begin
 if (public.comunidad()->'amigos'->0->>'enLinea')::boolean then raise exception 'No caduca presencia'; end if;
end $$;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);
select public.presencia();
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
do $$ begin
 if not (public.comunidad()->'amigos'->0->>'enLinea')::boolean then raise exception 'Heartbeat no renueva'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.presencia(); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
 begin perform public.comunidad(); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000099',true);
do $$ begin
 begin perform public.presencia(); raise exception 'Perfil inexistente'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from private.account_presence) <> 2 then raise exception 'Duplicado heartbeat'; end if;
end $$;
rollback;
