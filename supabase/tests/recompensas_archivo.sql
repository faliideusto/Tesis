begin;
insert into auth.users(id,raw_user_meta_data) values
('76000000-0000-0000-0000-000000000002','{"display_name":"Nuevo set"}');
insert into private.pass_progress(user_id,season_id,points)
values('76000000-0000-0000-0000-000000000002',private.registrar_temporada(now()),4500);
set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-0000-0000-000000000002',true);
do $$ declare p jsonb; s text; v jsonb;
begin
 p:=public.pase_temporada(null); s:=p->'temporada'->>'id';
 if jsonb_array_length(p->'recompensas')<>10 then raise exception 'No son diez niveles'; end if;
 if (select jsonb_array_length(r->'cosmeticos') from jsonb_array_elements(p->'recompensas') r where (r->>'nivel')::int=10)<>3
 then raise exception 'Set final incompleto'; end if;
 perform public.reclamar_recompensa_temporada(s,'premio_maestro');
 perform public.reclamar_recompensa_temporada(s,'premio_maestro');
 v:=public.equipar_cosmetico('interaccion','archivo_lanzamiento_libro');
 if jsonb_array_length(v->'inventario')<>3 or v->'equipamiento'->>'interaccion'<>'archivo_lanzamiento_libro'
 or jsonb_array_length(v->'catalogo')<>12 then raise exception 'Inventario/loadout/catalogo'; end if;
 perform public.equipar_cosmetico('interaccion',null);
end $$;
reset role;
do $$ begin
 if (select cardinality(cosmetic_ids) from private.pass_rewards
 where season_id=private.registrar_temporada(now()+interval '3 months') and id='premio_maestro')<>3
 then raise exception 'Los meses nuevos no usan el catálogo definitivo'; end if;
 if (select xp from public.profiles where id='76000000-0000-0000-0000-000000000002')<>0
 or (select points from private.pass_progress where user_id='76000000-0000-0000-0000-000000000002')<>4500
 or (select count(*) from private.pass_claims where user_id='76000000-0000-0000-0000-000000000002')<>1
 then raise exception 'Claim duplicada o XP extra'; end if;
 if (select count(*) from private.cosmetics_inventory where user_id='76000000-0000-0000-0000-000000000001')<>3
 or (select xp from public.profiles where id='76000000-0000-0000-0000-000000000001')<>0
 or (select count(*) from private.pass_claims where user_id='76000000-0000-0000-0000-000000000001')<>1
 then raise exception 'Migración no respeta set previamente reclamado'; end if;
 if exists(select 1 from pg_trigger where tgname in ('pase_recompensa_inmutable','pase_plantilla_inmutable') and tgenabled<>'O')
 then raise exception 'Guardas no restaurados'; end if;
 if (select count(*) from private.pass_reward_templates where catalog_version=1)<>10
 or (select count(*) from private.cosmetics_catalog)<>12 then raise exception 'Catálogo inicial'; end if;
end $$;
rollback;
delete from auth.users where id='76000000-0000-0000-0000-000000000001';
