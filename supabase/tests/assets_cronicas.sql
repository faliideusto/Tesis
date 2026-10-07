begin;
insert into auth.users(id,raw_user_meta_data) values
('75000000-0000-0000-0000-000000000001','{"display_name":"Assets"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000001',true);
do $$ declare v jsonb; pieza jsonb;
begin
 v:=public.cosmeticos();
 if jsonb_array_length(v->'catalogo')<>12 then raise exception 'IDs del catálogo alterados'; end if;
 if (select count(*) from jsonb_array_elements(v->'catalogo') r where r->'cosmetico'->>'tipo'='titulo' and r->'cosmetico'->'asset'='null'::jsonb)<>2
 then raise exception 'Títulos con arte'; end if;
 select r->'cosmetico' into pieza from jsonb_array_elements(v->'catalogo') r where r->'cosmetico'->>'id'='archivo_lanzamiento_libro';
 if (select count(*) from jsonb_object_keys(pieza->'assets'))<>4
    or pieza->>'asset'<>'/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/libro.png'
    or pieza->'assets'->>'hoja-01'<>'/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/hoja-01.png'
 then raise exception 'Piezas de interacción incompletas'; end if;
 v:=public.pase_temporada(null);
 select c into pieza from jsonb_array_elements(v->'recompensas') r cross join lateral jsonb_array_elements(r->'cosmeticos') c
 where c->>'id'='archivo_lanzamiento_libro';
 if pieza->'assets'->>'impacto'<>'/assets/seasons/cronicas-del-archivo/interacciones/lanzamiento-libro/impacto.png'
 then raise exception 'RPC pase usa metadata anterior'; end if;
 perform public.reclamar_recompensa_temporada(v->'temporada'->>'id','premio_insignia');
 v:=public.equipar_cosmetico('insignia','academia_insignia');
 if v->'inventario'->0->>'asset'<>'/assets/seasons/cronicas-del-archivo/insignias/insignia-cronicas-del-archivo.png'
 then raise exception 'Inventario no resuelve asset actual'; end if;
end $$;
reset role;
do $$ begin
 begin update private.cosmetics_catalog set name='Otro' where id='academia_titulo'; raise exception 'Catálogo modifica identidad'; exception when invalid_parameter_value then null; end;
 begin update private.cosmetics_catalog set asset=null where id='academia_avatar'; raise exception 'Avatar admite null'; exception when check_violation then null; end;
 if has_function_privilege('anon','public.cosmeticos()','execute') or has_function_privilege('anon','public.pase_temporada(text)','execute') then raise exception 'Permisos RPC'; end if;
end $$;
rollback;
