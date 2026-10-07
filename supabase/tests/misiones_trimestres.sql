-- Resultados del motor, reclamaciones y pase persistente; todo se revierte.
begin;
insert into auth.users(id,raw_user_meta_data) values
('81000000-0000-0000-0000-000000000001','{"display_name":"Misiones Ada"}'),
('81000000-0000-0000-0000-000000000002','{"display_name":"Misiones Lin"}');
update private.community_settings set activated_at=(select inicio from private.metadatos_temporada(now()));
insert into private.matches(id,result_hash,version,completed_at)
select ('82000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,repeat('e',64),1,
    case when n=11 then (select inicio from private.metadatos_temporada(now()))-interval '1 microsecond'
         when n=12 then (select fin from private.metadatos_temporada(now()))+interval '1 hour' else now() end from generate_series(1,12) n;
insert into private.match_participants(match_id,seat,user_id,display_name,prestige,winner)
select id,0,'81000000-0000-0000-0000-000000000001','Misiones Ada',10,
    row_number() over(order by id)<=5 from private.matches where id::text like '82000000%';
do $$ declare siguiente timestamptz; m record;
begin
    if has_function_privilege('authenticated','private.misiones_temporada_actuales(uuid,timestamptz)','execute')
       or has_function_privilege('anon','public.misiones()','execute') then raise exception 'Misiones permisos'; end if;
    begin
        insert into private.mission_claims(user_id,mission_id,xp)
        values('81000000-0000-0000-0000-000000000001','test:xp_invalido',99);
        raise exception 'Recompensa XP no autorizada';
    exception when check_violation then null; end;
    siguiente:=(select fin from private.metadatos_temporada(now()));
    for m in select * from private.misiones_temporada_actuales('81000000-0000-0000-0000-000000000001',siguiente) loop
        if m.progreso<>0 or m.reclamada or m.completada then raise exception 'Reinicio mensual'; end if;
    end loop;
    -- Fin mensual canónico y DST, igual que ranking/pase.
    if (select fin from private.metadatos_temporada('2026-10-25T12:00:00Z'))<>'2026-12-31T23:00:00Z' then raise exception 'Calendario DST'; end if;
end $$;
select set_config('test.mision.diaria',(select id from private.misiones_actuales('81000000-0000-0000-0000-000000000001') where periodo='diarias' order by xp,id limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; m jsonb; sid text; antes bigint; puntos bigint;
begin
    v:=public.misiones();
    if jsonb_array_length(v->'diarias')<>2 or jsonb_array_length(v->'semanales')<>3
       or jsonb_array_length(v->'temporada')<>2 then raise exception 'Catalogo real'; end if;
    if v->'diarias'->0->>'id'<>current_setting('test.mision.diaria') then raise exception 'ID diario modificado'; end if;
    if (v->'temporada'->0->>'progreso')::int<>10 or (v->'temporada'->1->>'progreso')::int<>5
       or not (v->'temporada'->0->>'completada')::boolean then raise exception 'Progreso mensual'; end if;
    if (v->>'reinicioTemporada')::timestamptz<>(public.pase_temporada()->'temporada'->>'fin')::timestamptz then raise exception 'Ranking/pase/misiones diferentes'; end if;
    select xp into antes from public.profiles;
    for m in select value from jsonb_array_elements(v->'temporada') loop
        if (m->>'puntosPase')::int<>(m->>'xp')::int or length(m->>'descripcion')<10 then raise exception 'Descripcion/recibo'; end if;
        perform public.reclamar_mision(m->>'id');
        perform public.reclamar_mision(m->>'id');
    end loop;
    v:=public.misiones();
    if not (v->'temporada'->0->>'reclamada')::boolean or not (v->'temporada'->1->>'reclamada')::boolean
       or (select xp from public.profiles)<>antes+2500 then raise exception 'Persistencia o doble XP'; end if;
    v:=public.pase_temporada(); sid:=v->'temporada'->>'id';
    if (v->'progreso'->>'puntos')::int<>2500 or (v->'progreso'->>'nivel')::int<>6 then raise exception 'Recibo puntos'; end if;
    puntos:=(v->'progreso'->>'puntos')::bigint;
    select xp into antes from public.profiles;
    perform public.reclamar_recompensa_temporada(sid,'premio_insignia');
    perform public.reclamar_recompensa_temporada(sid,'premio_insignia');
    if jsonb_array_length(public.cosmeticos()->'inventario')<>1 or (select xp from public.profiles)<>antes
       or (public.pase_temporada()->'progreso'->>'puntos')::bigint<>puntos then raise exception 'Cosmetico duplica o da XP'; end if;
    begin perform public.reclamar_mision('temporada:jugar10:2000-01'); raise exception 'Caducada aceptada'; exception when invalid_parameter_value then null; end;
    v:=public.reclamar_mision(current_setting('test.mision.diaria'));
    perform public.reclamar_mision(current_setting('test.mision.diaria'));
    if not (v->'diarias'->0->>'reclamada')::boolean or (select xp from public.profiles)<>antes+100
       or (public.pase_temporada()->'progreso'->>'puntos')::bigint<>puntos+100 then raise exception 'Regresión claim diario'; end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000002',true);
do $$ begin
    if (public.misiones()->'temporada'->0->>'progreso')::int<>0
       or jsonb_array_length(public.cosmeticos()->'inventario')<>0 then raise exception 'Aislamiento'; end if;
    begin perform public.reclamar_mision(public.misiones()->'temporada'->0->>'id'); raise exception 'Incompleta aceptada'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
    if (select count(*) from private.mission_claims where user_id='81000000-0000-0000-0000-000000000001')<>3
       or (select count(*) from private.pass_receipts where user_id='81000000-0000-0000-0000-000000000001')<>3 then raise exception 'Recibos únicos'; end if;
end $$;
rollback;
