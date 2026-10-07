-- Infra provisional. Fixtures, catálogo y progreso vuelven al estado inicial.
begin;
insert into auth.users(id,raw_user_meta_data) values
('76000000-0000-0000-0000-000000000001','{"display_name":"Ada"}'),
('76000000-0000-0000-0000-000000000002','{"display_name":"Lin"}');
select set_config('test.pass.actual',(select id from private.metadatos_temporada(now())),true);
select set_config('test.pass.anterior',(select id from private.metadatos_temporada(date_trunc('month',now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' - interval '1 microsecond')),true);
select set_config('test.pass.futura',private.registrar_temporada(now()+interval '2 months'),true);
do $$ declare tabla text; v record; ranking record;
begin
 foreach tabla in array array['pass_seasons','pass_reward_templates','cosmetics_catalog','pass_rewards','pass_progress','pass_receipts','cosmetics_inventory','cosmetics_loadout','pass_claims'] loop
    if has_table_privilege('authenticated','private.'||tabla,'select') or has_table_privilege('authenticated','private.'||tabla,'insert')
       or not (select relrowsecurity from pg_class where oid=('private.'||tabla)::regclass) then raise exception 'Permisos/RLS %',tabla; end if;
 end loop;
 if has_function_privilege('anon','public.pase_temporada(text)','execute')
    or has_function_privilege('authenticated','private.anotar_puntos_pase(uuid,text,text,integer,timestamptz)','execute')
    or has_function_privilege('authenticated','private.registrar_temporada(timestamptz)','execute') then raise exception 'RPC privada'; end if;
 select * into v from private.metadatos_temporada('2024-02-29T22:59:59Z');
 select * into ranking from private.ventana_ranking('temporada','2024-02-29T22:59:59Z');
 if v.id <> ranking.id or v.inicio <> ranking.inicio or v.fin <> ranking.fin then raise exception 'Ranking/pase distintos'; end if;
 select * into v from private.metadatos_temporada('2026-10-25T12:00:00Z');
 if v.inicio <> '2026-09-30T22:00:00Z' or v.fin <> '2026-10-31T23:00:00Z' then raise exception 'DST mes'; end if;
 begin update private.cosmetics_catalog set kind='marco' where id='academia_avatar'; raise exception 'Catálogo cambia tipo histórico'; exception when invalid_parameter_value then null; end;
 begin update private.pass_rewards set level=1 where id='premio_avatar'; raise exception 'Recompensa cambia nivel histórico'; exception when invalid_parameter_value then null; end;
 begin update private.pass_seasons set points_per_level=1; raise exception 'Temporada cambia progresión'; exception when invalid_parameter_value then null; end;
 begin insert into private.pass_reward_templates(catalog_version,id,level,name,cosmetic_ids)
 values(2,'malformada',10,'Malformada',array['academia_avatar','no_existe']); raise exception 'Bundle parcial admitido'; exception when invalid_parameter_value then null; end;
 begin insert into private.pass_reward_templates(catalog_version,id,level,name,cosmetic_ids)
 values(2,'duplicada',10,'Duplicada',array['academia_avatar','academia_avatar']); raise exception 'Bundle duplicado admitido'; exception when invalid_parameter_value then null; end;
 begin insert into private.pass_reward_templates(catalog_version,id,level,name,cosmetic_ids)
 values(2,'nula',10,'Nula',array['academia_avatar',null]); raise exception 'Bundle nulo admitido'; exception when invalid_parameter_value then null; end;
 begin insert into private.pass_rewards(season_id,id,level,name,cosmetic_ids,cosmetic_snapshot)
 values(current_setting('test.pass.actual'),'snapshot_malo',10,'Malo',array['academia_avatar'],'[]'::jsonb); raise exception 'Snapshot parcial admitido'; exception when invalid_parameter_value then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb;
begin
 v := public.pase_temporada();
 if (v->'progreso'->>'puntos')::integer <> 0 or (v->'progreso'->>'nivel')::integer <> 1
    or (v->'progreso'->>'puntosSiguienteNivel')::integer <> 500 or jsonb_array_length(v->'recompensas') <> 10
    or (v->'progreso'->>'puntosPorNivel')::integer <> 500 or v->'temporada'->>'nombre' <> 'Crónicas del Archivo'
    or not (v->'temporada'->>'gratuita')::boolean then raise exception 'Pase inicial'; end if;
 if not (v->'temporada'->>'activa')::boolean or v->'temporada'->>'id' <> current_setting('test.pass.actual') then raise exception 'Temporada actual'; end if;
 if v::text like '%76000000-%' or v::text like '%user_id%' then raise exception 'Identidad privada'; end if;
 v := public.cosmeticos();
 if jsonb_array_length(v->'inventario') <> 0 or v->'equipamiento'->'avatar' <> 'null'::jsonb
    or (select count(*) from jsonb_object_keys(v->'equipamiento')) <> 7 then raise exception 'Inventario inicial'; end if;
 begin perform public.reclamar_recompensa_temporada(current_setting('test.pass.actual'),'premio_avatar'); raise exception 'Claim bloqueado aceptado'; exception when invalid_parameter_value then null; end;
 begin perform public.equipar_cosmetico('avatar','academia_avatar'); raise exception 'Ownership ignorado'; exception when invalid_parameter_value then null; end;
 begin perform public.equipar_cosmetico('otro',null); raise exception 'Tipo ignorado'; exception when invalid_parameter_value then null; end;
 begin perform public.pase_temporada('temporada:2026-13'); raise exception 'Mes inválido'; exception when invalid_parameter_value then null; end;
 begin perform public.pase_temporada('temporada:1900-01'); raise exception 'Temporada desconocida'; exception when invalid_parameter_value then null; end;
 begin perform public.pase_temporada(current_setting('test.pass.futura')); raise exception 'Temporada futura'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- Triggers automáticos, replay de fuentes, premio mision+partida actual.
insert into private.matches(id,result_hash,version,completed_at) values
('77000000-0000-0000-0000-000000000001',repeat('e',64),1,now()),
('77000000-0000-0000-0000-000000000002',repeat('f',64),1,now()+interval '2 months');
insert into private.reward_ledger(match_id,user_id,xp,version) values
('77000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001',150,1),
('77000000-0000-0000-0000-000000000002','76000000-0000-0000-0000-000000000001',150,1);
insert into private.mission_claims(user_id,mission_id,xp,claimed_at)
select '76000000-0000-0000-0000-000000000001','test:actual:'||n,100,now() from generate_series(1,5) n;
insert into private.mission_claims(user_id,mission_id,xp,claimed_at) values
('76000000-0000-0000-0000-000000000001','test:actual:1',100,now()) on conflict do nothing;
select private.anotar_puntos_pase('76000000-0000-0000-0000-000000000001','partida','77000000-0000-0000-0000-000000000001',150,now());
do $$ begin
 if (select points from private.pass_progress where user_id='76000000-0000-0000-0000-000000000001' and season_id=current_setting('test.pass.actual')) <> 650
    or (select count(*) from private.pass_receipts where user_id='76000000-0000-0000-0000-000000000001') <> 6 then raise exception 'Recibos idempotentes/futuros'; end if;
end $$;
-- Lectura sincroniza recibos iniciales existentes sin trigger (backfill seguro).
alter table private.reward_ledger disable trigger recibo_partida_pase;
insert into private.reward_ledger(match_id,user_id,xp,version) values
('77000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002',100,1);
alter table private.reward_ledger enable trigger recibo_partida_pase;
set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; antes bigint;
begin
 select xp into antes from public.profiles;
 v := public.pase_temporada(); perform public.pase_temporada();
 if (v->'progreso'->>'puntos')::int <> 650 or (v->'progreso'->>'nivel')::int <> 2
    or (v->'progreso'->>'puntosSiguienteNivel')::int <> 1000 then raise exception 'Nivel/umbral actual'; end if;
 v := public.reclamar_recompensa_temporada(current_setting('test.pass.actual'),'premio_avatar');
 perform public.reclamar_recompensa_temporada(current_setting('test.pass.actual'),'premio_avatar');
 if not (v->'recompensas'->1->>'reclamada')::boolean or (select xp from public.profiles) <> antes then raise exception 'Reclamo único/no XP'; end if;
 v := public.equipar_cosmetico('avatar','academia_avatar');
 if v->'equipamiento'->>'avatar' <> 'academia_avatar' or jsonb_array_length(v->'inventario') <> 1 then raise exception 'Equipamiento'; end if;
 begin perform public.equipar_cosmetico('marco','academia_avatar'); raise exception 'Tipo ajeno aceptado'; exception when invalid_parameter_value then null; end;
 begin perform public.reclamar_recompensa_temporada(current_setting('test.pass.actual'),'premio_otro'); raise exception 'ID ajeno aceptado'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000002',true);
do $$ declare v jsonb;
begin
 v := public.pase_temporada();
 if (v->'progreso'->>'puntos')::int <> 100 or jsonb_array_length(public.cosmeticos()->'inventario') <> 0 then raise exception 'Backfill o actor'; end if;
 begin perform public.equipar_cosmetico('avatar','academia_avatar'); raise exception 'Ownership ajeno'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- Resultado tardío de temporada cerrada y 5000 puntos: conserva derechos e inventario.
insert into private.mission_claims(user_id,mission_id,xp,claimed_at)
select '76000000-0000-0000-0000-000000000001','test:anterior:'||n,200,
    (select inicio from private.metadatos_temporada(now())) - interval '1 microsecond' from generate_series(1,25) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb;
begin
 v := public.pase_temporada(current_setting('test.pass.anterior'));
 if (v->'temporada'->>'activa')::boolean or (v->'progreso'->>'nivel')::int <> 10
    or v->'progreso'->'puntosSiguienteNivel' <> 'null'::jsonb then raise exception 'Histórico/max'; end if;
 perform public.reclamar_recompensa_temporada(current_setting('test.pass.anterior'),'premio_maestro');
 perform public.reclamar_recompensa_temporada(current_setting('test.pass.anterior'),'premio_maestro');
 v := public.pase_temporada();
 if (v->'progreso'->>'puntos')::int <> 650 then raise exception 'Rollover mezcla puntos'; end if;
 v := public.cosmeticos();
 if v->'equipamiento'->>'avatar' <> 'academia_avatar' or jsonb_array_length(v->'inventario') <> 3 then raise exception 'Rollover/bundle borra inventario/equipo'; end if;
 if (select count(*) from jsonb_array_elements(v->'inventario') c where c->>'rareza'='legendario') <> 2 then raise exception 'Bundle/rareza final'; end if;
 v := public.equipar_cosmetico('avatar',null);
 if v->'equipamiento'->'avatar' <> 'null'::jsonb or jsonb_array_length(v->'inventario') <> 3 then raise exception 'Desequipar elimina posesión'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.pase_temporada(); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
 begin perform public.cosmeticos(); raise exception 'Actor ausente'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from private.pass_claims where user_id='76000000-0000-0000-0000-000000000001') <> 2 then raise exception 'Doble claim'; end if;
 -- El FK compuesto bloquea equipar tipo incorrecto aun con acceso administrativo.
 begin insert into private.cosmetics_loadout(user_id,kind,cosmetic_id) values('76000000-0000-0000-0000-000000000001','marco','academia_avatar');
 raise exception 'FK tipo ignorado'; exception when foreign_key_violation then null; end;
 -- El arte se sustituye sin reinterpretar identidad/tipo/derechos de snapshots.
 update private.cosmetics_catalog set asset='/assets/Tesis-assets/season-pass-placeholder/replaced.svg' where id='academia_avatar';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb;
begin
 v := public.pase_temporada();
 if v->'recompensas'->1->'cosmeticos'->0->>'asset' <> '/assets/Tesis-assets/season-pass-placeholder/replaced.svg'
    or v->'recompensas'->1->'cosmeticos'->0->>'id' <> 'academia_avatar' then raise exception 'Arte snapshot no actualiza'; end if;
end $$;
reset role;
rollback;
