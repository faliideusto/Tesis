-- Misiones especiales: detección por resultados del servidor, una sola reclamación y premios.
-- Todo se revierte.
begin;
insert into auth.users(id,raw_user_meta_data) values
('91000000-0000-0000-0000-000000000001','{"display_name":"Especial Ada"}'),
('91000000-0000-0000-0000-000000000002','{"display_name":"Especial Lin"}'),
('91000000-0000-0000-0000-000000000003','{"display_name":"Especial Eva"}');
update private.community_settings set activated_at=now()-interval '1 day';
insert into private.matches(id,result_hash,version,completed_at) values
('92000000-0000-0000-0000-000000000001',repeat('a',64),1,now()-interval '1 hour'),
('92000000-0000-0000-0000-000000000002',repeat('b',64),1,now()-interval '1 hour'),
('92000000-0000-0000-0000-000000000003',repeat('c',64),1,now()-interval '2 days');
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner) values
-- Ada gana 21 a 17: Cum Laude sí, ventaja de 4 no basta.
('92000000-0000-0000-0000-000000000001',0,'91000000-0000-0000-0000-000000000001','Especial Ada',21,true),
('92000000-0000-0000-0000-000000000001',1,'91000000-0000-0000-0000-000000000002','Especial Lin',17,false),
('92000000-0000-0000-0000-000000000001',2,null,'Invitado',3,false),
-- Lin gana 12 a 7 (ventaja 5) sin llegar a 20; Eva pierde con 7.
('92000000-0000-0000-0000-000000000002',0,'91000000-0000-0000-0000-000000000002','Especial Lin',12,true),
('92000000-0000-0000-0000-000000000002',1,'91000000-0000-0000-0000-000000000003','Especial Eva',7,false),
('92000000-0000-0000-0000-000000000002',2,null,'Invitado',1,false),
-- Eva gana 25 a 2 antes de la activación: no cuenta.
('92000000-0000-0000-0000-000000000003',0,'91000000-0000-0000-0000-000000000003','Especial Eva',25,true),
('92000000-0000-0000-0000-000000000003',1,null,'Invitado',2,false),
('92000000-0000-0000-0000-000000000003',2,null,'Invitado B',2,false);
do $$ begin
    if has_function_privilege('authenticated','private.misiones_especiales_actuales(uuid)','execute')
       or has_function_privilege('anon','public.misiones()','execute') then raise exception 'Permisos misiones especiales'; end if;
    if (select rarity from private.cosmetics_catalog where id='especial_cum_laude')<>'legendario' then raise exception 'Marco Cum Laude'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; c jsonb; p jsonb; antes bigint;
begin
    v:=public.misiones();
    if jsonb_array_length(v->'especiales')<>2 or jsonb_array_length(v->'diarias')<>2 then raise exception 'Catalogo especial'; end if;
    select value into c from jsonb_array_elements(v->'especiales') where value->>'id'='especial:cumlaude';
    select value into p from jsonb_array_elements(v->'especiales') where value->>'id'='especial:paliza5';
    if not (c->>'completada')::boolean or (c->>'reclamada')::boolean or (c->>'xp')::int<>0
       or c->'recompensa'->>'id'<>'especial_cum_laude' or c->'recompensa'->>'tipo'<>'marco' then raise exception 'Cum Laude Ada: %',c; end if;
    if (p->>'completada')::boolean or (p->>'progreso')::int<>0 or (p->>'xp')::int<>500
       or (p->>'puntosPase')::int<>500 or jsonb_typeof(p->'recompensa')<>'null' then raise exception 'Paliza Ada: %',p; end if;
    begin perform public.reclamar_mision('especial:paliza5'); raise exception 'Incompleta aceptada';
    exception when invalid_parameter_value then null; end;
    begin perform public.reclamar_mision('especial:inventada'); raise exception 'Inventada aceptada';
    exception when invalid_parameter_value then null; end;
    select xp into antes from public.profiles;
    perform public.reclamar_mision('especial:cumlaude');
    v:=public.reclamar_mision('especial:cumlaude');
    if not (select (value->>'reclamada')::boolean from jsonb_array_elements(v->'especiales') where value->>'id'='especial:cumlaude')
       then raise exception 'Cum Laude no reclamada'; end if;
    if (select xp from public.profiles)<>antes then raise exception 'El marco no debe dar XP'; end if;
    if not exists(select 1 from jsonb_array_elements(public.cosmeticos()->'inventario') i where i->>'id'='especial_cum_laude')
       then raise exception 'Marco fuera del inventario'; end if;
    perform public.equipar_cosmetico('marco','especial_cum_laude');
    if public.cosmeticos()->'equipamiento'->>'marco'<>'especial_cum_laude' then raise exception 'Marco no equipable'; end if;
end $$;

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
do $$ declare v jsonb; antes bigint; puntos bigint;
begin
    v:=public.misiones();
    if (select (value->>'completada')::boolean from jsonb_array_elements(v->'especiales') where value->>'id'='especial:cumlaude')
       then raise exception 'Lin no llegó a 20 ganando'; end if;
    if not (select (value->>'completada')::boolean from jsonb_array_elements(v->'especiales') where value->>'id'='especial:paliza5')
       then raise exception 'Lin ganó por 5'; end if;
    select xp into antes from public.profiles;
    puntos:=(public.pase_temporada()->'progreso'->>'puntos')::bigint;
    perform public.reclamar_mision('especial:paliza5');
    perform public.reclamar_mision('especial:paliza5');
    if (select xp from public.profiles)<>antes+500 then raise exception 'Paliza debe sumar 500 XP una vez'; end if;
    if (public.pase_temporada()->'progreso'->>'puntos')::bigint<>puntos+500 then raise exception 'Recibo de pase 1:1'; end if;
    begin perform public.reclamar_mision('especial:cumlaude'); raise exception 'Cum Laude sin lograr';
    exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
do $$ declare v jsonb;
begin
    v:=public.misiones();
    if exists(select 1 from jsonb_array_elements(v->'especiales') where (value->>'completada')::boolean)
       then raise exception 'Partidas anteriores a la activación no cuentan'; end if;
end $$;
rollback;
