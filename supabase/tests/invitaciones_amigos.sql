begin;
insert into auth.users(id,raw_user_meta_data) values
('72000000-0000-0000-0000-000000000001','{"display_name":"Ada"}'),
('72000000-0000-0000-0000-000000000002','{"display_name":"Lin"}'),
('72000000-0000-0000-0000-000000000003','{"display_name":"Sol"}');
update public.profiles set friend_code = 'ABCDEF000000000' || right(id::text,1) where id::text like '72000000%';
insert into private.friendships(user_low,user_high,requester,accepted) values
('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000001',true),
('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000003','72000000-0000-0000-0000-000000000001',false);
insert into private.account_presence(user_id,last_seen_at) select id,clock_timestamp() from public.profiles where id::text like '72000000%';
do $$ begin
 if has_function_privilege('authenticated','public.resolver_amigo_en_linea(uuid,text)','execute')
    or has_function_privilege('anon','public.resolver_amigo_en_linea(uuid,text)','execute')
    or not has_function_privilege('service_role','public.resolver_amigo_en_linea(uuid,text)','execute') then raise exception 'Permisos resolver'; end if;
end $$;
set local role service_role;
do $$ declare actor uuid := '72000000-0000-0000-0000-000000000001'; v jsonb;
begin
 v := public.resolver_amigo_en_linea(actor,'abcdef0000000002');
 if v->>'destino' <> '72000000-0000-0000-0000-000000000002' then raise exception 'Amigo disponible'; end if;
 if public.resolver_amigo_en_linea(actor,'ABCDEF0000000003')->>'destino' is not null
    or public.resolver_amigo_en_linea(actor,'ABCDEF0000000001')->>'destino' is not null
    or public.resolver_amigo_en_linea(actor,'ABCDEF0000000099')->>'destino' is not null then raise exception 'No amigo disponible'; end if;
end $$;
reset role;
update private.account_presence set last_seen_at = clock_timestamp() - interval '91 seconds';
set local role service_role;
do $$ begin
 if public.resolver_amigo_en_linea('72000000-0000-0000-0000-000000000001','ABCDEF0000000002')->>'destino' is not null then raise exception 'Offline aceptado'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform public.resolver_amigo_en_linea('72000000-0000-0000-0000-000000000001','ABCDEF0000000002');
 raise exception 'Navegador obtiene UUID'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
