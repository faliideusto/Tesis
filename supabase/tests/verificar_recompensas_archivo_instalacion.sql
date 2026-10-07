-- Solo lectura; no modifica perfiles, reclamaciones ni inventarios.
select '01_interaccion_legendaria' control, case when exists(
 select 1 from private.cosmetics_catalog where id='archivo_lanzamiento_libro' and kind='interaccion'
 and name='Lanzamiento de libro' and rarity='legendario'
) then 'PASS' else 'FAIL' end resultado
union all select '02_plantilla_set', case when exists(
 select 1 from private.pass_reward_templates where catalog_version=1 and id='premio_maestro' and level=10
 and cosmetic_ids=array['archivo_maestro_marco','archivo_maestro_insignia','archivo_lanzamiento_libro']
) then 'PASS' else 'FAIL' end
union all select '03_snapshots_actualizados',case when not exists(
 select 1 from private.pass_rewards r join private.pass_seasons s on s.id=r.season_id
 where s.catalog_version=1 and s.name='Crónicas del Archivo' and r.id='premio_maestro'
 and (cardinality(r.cosmetic_ids)<>3 or jsonb_array_length(r.cosmetic_snapshot)<>3
 or not 'archivo_lanzamiento_libro'=any(r.cosmetic_ids))
) then 'PASS' else 'FAIL' end
union all select '04_derechos_anteriores',case when not exists(
 select 1 from private.pass_claims c join private.pass_rewards r on r.season_id=c.season_id and r.id=c.reward_id
 where 'archivo_lanzamiento_libro'=any(r.cosmetic_ids) and not exists(
 select 1 from private.cosmetics_inventory i where i.user_id=c.user_id and i.cosmetic_id='archivo_lanzamiento_libro')
) then 'PASS' else 'FAIL' end
union all select '05_guardas_activos',case when (
 select count(*) from pg_trigger where tgname in ('pase_plantilla_inmutable','pase_recompensa_inmutable') and tgenabled='O'
)=2 then 'PASS' else 'FAIL' end
union all select '06_diez_premios_doce_piezas',case when
 (select count(*) from private.pass_reward_templates where catalog_version=1)=10
 and (select count(*) from private.cosmetics_catalog)=12
 then 'PASS' else 'FAIL' end
order by control;
