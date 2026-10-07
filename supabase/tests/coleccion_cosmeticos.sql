begin;
insert into auth.users(id,raw_user_meta_data) values
('77000000-0000-0000-0000-000000000001','{"display_name":"Colección"}'),
('77000000-0000-0000-0000-000000000002','{"display_name":"Otra persona"}');
select set_config('test.collection.old',private.registrar_temporada(now()-interval '1 month'),true);
select set_config('test.collection.future',private.registrar_temporada(now()+interval '2 months'),true);
insert into private.pass_progress(user_id,season_id,points) values
('77000000-0000-0000-0000-000000000002',current_setting('test.collection.old'),2500),
('77000000-0000-0000-0000-000000000001',current_setting('test.collection.future'),0);
-- Cosmético de prueba únicamente local: no forma parte del catálogo inicial.
insert into private.cosmetics_catalog(id,kind,name,asset) values
('test_interaccion','interaccion','Interacción de prueba','/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg');
set local role authenticated;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb;
begin
 v:=public.cosmeticos();
 if (select count(*) from jsonb_object_keys(v->'equipamiento'))<>7
    or v->'equipamiento'->'interaccion'<>'null'::jsonb then raise exception 'Slot interacción'; end if;
 begin perform public.equipar_cosmetico('interaccion','test_interaccion'); raise exception 'Admite interacción sin posesión'; exception when invalid_parameter_value then null; end;
 begin perform public.equipar_cosmetico('interaccion','academia_avatar'); raise exception 'Admite otro tipo sin posesión'; exception when invalid_parameter_value then null; end;
 begin perform public.equipar_cosmetico('animacion',null); raise exception 'Admite tipo no soportado'; exception when invalid_parameter_value then null; end;
 if jsonb_array_length(v->'inventario')<>0 or jsonb_array_length(v->'catalogo')<>11
    or jsonb_array_length(v->'temporadas')<>1 then raise exception 'Catálogo vacío, otro usuario o futuro filtrado incorrectamente'; end if;
 if (v->'temporadas'->0->>'nivel')::int<>1 or (v->'temporadas'->0->>'totalRecompensas')::int<>10
    or (v->'temporadas'->0->>'recompensasObtenidas')::int<>0 then raise exception 'Contadores iniciales'; end if;
 if (select count(*) from jsonb_array_elements(v->'catalogo') r where (r->>'nivel')::int=10)<>2
    or (select count(*) from jsonb_array_elements(v->'catalogo') r where r->'cosmetico'->>'tipo'='placa')<>1
 then raise exception 'Bundle o tipos faltantes'; end if;
 perform public.reclamar_recompensa_temporada(v->'temporadas'->0->>'id','premio_insignia');
 v:=public.equipar_cosmetico('insignia','academia_insignia');
 if jsonb_array_length(v->'inventario')<>1 or v->'equipamiento'->>'insignia'<>'academia_insignia'
    or (v->'temporadas'->0->>'recompensasObtenidas')::int<>1 then raise exception 'Claim o loadout no reflejados'; end if;
end $$;
reset role;
insert into private.cosmetics_inventory(user_id,cosmetic_id,kind) values
('77000000-0000-0000-0000-000000000001','test_interaccion','interaccion');
insert into private.pass_progress(user_id,season_id,points) values
('77000000-0000-0000-0000-000000000001',current_setting('test.collection.old'),2000);
set local role authenticated;
do $$ declare v jsonb;
begin
 v:=public.equipar_cosmetico('interaccion','test_interaccion');
 if v->'equipamiento'->>'interaccion'<>'test_interaccion' then raise exception 'Interacción no equipada'; end if;
 begin perform public.equipar_cosmetico('avatar','test_interaccion'); raise exception 'Admite interacción en otro tipo'; exception when invalid_parameter_value then null; end;
 v:=public.equipar_cosmetico('interaccion',null);
 if v->'equipamiento'->'interaccion'<>'null'::jsonb or jsonb_array_length(v->'inventario')<>2 then raise exception 'Desequipar interacción elimina posesión'; end if;
 v:=public.cosmeticos();
 if jsonb_array_length(v->'temporadas')<>2 or jsonb_array_length(v->'catalogo')<>22 then raise exception 'Archivo histórico perdido'; end if;
 if (v->'temporadas'->1->>'nivel')::int<>5 then raise exception 'Nivel histórico incorrecto'; end if;
 if v->'equipamiento'->>'insignia'<>'academia_insignia' then raise exception 'Equipamiento permanente perdido'; end if;
 if has_function_privilege('anon','public.cosmeticos()','execute') then raise exception 'RPC anónima'; end if;
end $$;
rollback;
