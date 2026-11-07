-- Misión especial Llaverito: se completa al llegar a Catedrático (nivel 25 = 12.000 XP),
-- se reclama una sola vez y no concede XP, puntos de pase ni cosméticos. Todo se revierte.
begin;
insert into auth.users(id,raw_user_meta_data) values
('93000000-0000-0000-0000-000000000001','{"display_name":"Llavero Ada"}'),
('93000000-0000-0000-0000-000000000002','{"display_name":"Llavero Lin"}');
update public.profiles set xp=12000 where id='93000000-0000-0000-0000-000000000001';
update public.profiles set xp=11999 where id='93000000-0000-0000-0000-000000000002';
do $$ begin
    if has_function_privilege('authenticated','private.misiones_especiales_actuales(uuid)','execute')
       then raise exception 'Permisos misiones especiales'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; l jsonb; antes bigint; puntos bigint;
begin
    v:=public.misiones();
    if jsonb_array_length(v->'especiales')<>3 then raise exception 'Catalogo especial: %',v->'especiales'; end if;
    select value into l from jsonb_array_elements(v->'especiales') where value->>'id'='especial:llaverito';
    if l->>'titulo'<>'Llaverito' or position('Choquet' in l->>'descripcion')=0 or position('llavero' in l->>'descripcion')=0
       or (l->>'objetivo')::int<>25 or (l->>'progreso')::int<>25 or not (l->>'completada')::boolean
       or (l->>'reclamada')::boolean or (l->>'xp')::int<>0 or (l->>'puntosPase')::int<>0
       or jsonb_typeof(l->'recompensa')<>'null' then raise exception 'Llaverito Ada: %',l; end if;
    select xp into antes from public.profiles;
    puntos:=(public.pase_temporada()->'progreso'->>'puntos')::bigint;
    perform public.reclamar_mision('especial:llaverito');
    v:=public.reclamar_mision('especial:llaverito');
    if not (select (value->>'reclamada')::boolean from jsonb_array_elements(v->'especiales') where value->>'id'='especial:llaverito')
       then raise exception 'Llaverito no reclamada'; end if;
    if (select xp from public.profiles)<>antes then raise exception 'Llaverito no debe dar XP'; end if;
    if (public.pase_temporada()->'progreso'->>'puntos')::bigint<>puntos then raise exception 'Llaverito no debe sumar puntos de pase'; end if;
    if jsonb_array_length(public.cosmeticos()->'inventario')<>0 then raise exception 'Llaverito no da cosméticos'; end if;
end $$;

select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
do $$ declare l jsonb;
begin
    select value into l from jsonb_array_elements(public.misiones()->'especiales') where value->>'id'='especial:llaverito';
    if (l->>'completada')::boolean or (l->>'progreso')::int<>24 then raise exception 'Lin está en nivel 24: %',l; end if;
    begin perform public.reclamar_mision('especial:llaverito'); raise exception 'Llaverito sin Catedrático aceptada';
    exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
    if (select count(*) from private.mission_claims where mission_id='especial:llaverito')<>1 then raise exception 'Un solo recibo'; end if;
end $$;
rollback;
