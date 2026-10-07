-- Cierre del catálogo inicial; conserva IDs, progreso, reclamaciones y equipamiento.
begin;
-- El mismo orden que las RPC: primero perfiles. Evita carreras con reclamaciones.
lock table public.profiles in share row exclusive mode;
insert into private.cosmetics_catalog(id,kind,name,asset,rarity) values
('archivo_lanzamiento_libro','interaccion','Lanzamiento de libro',
 '/assets/Tesis-assets/season-pass-placeholder/cosmetic-placeholder.svg','legendario');

-- Corrección administrativa explícita del catálogo provisional, solo en esta transacción.
-- Los guardas de inmutabilidad vuelven a quedar activos antes del commit.
alter table private.pass_reward_templates disable trigger pase_plantilla_inmutable;
update private.pass_reward_templates
set cosmetic_ids=array['archivo_maestro_marco','archivo_maestro_insignia','archivo_lanzamiento_libro']
where catalog_version=1 and id='premio_maestro' and level=10;
alter table private.pass_reward_templates enable trigger pase_plantilla_inmutable;

alter table private.pass_rewards disable trigger pase_recompensa_inmutable;
update private.pass_rewards r
set cosmetic_ids=t.cosmetic_ids,
    cosmetic_snapshot=(select jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.kind,'nombre',c.name,'rareza',c.rarity)
                      order by array_position(t.cosmetic_ids,c.id))
                      from private.cosmetics_catalog c where c.id=any(t.cosmetic_ids))
from private.pass_reward_templates t,private.pass_seasons s
where r.season_id=s.id and s.catalog_version=1 and s.name='Crónicas del Archivo'
 and t.catalog_version=s.catalog_version and t.id=r.id and r.id='premio_maestro' and r.level=10;
alter table private.pass_rewards enable trigger pase_recompensa_inmutable;

-- Quienes ya reclamaron el set conservan sus derechos; se entrega solo la pieza nueva.
insert into private.cosmetics_inventory(user_id,cosmetic_id,kind)
select c.user_id,'archivo_lanzamiento_libro','interaccion'
from private.pass_claims c join private.pass_rewards r on r.season_id=c.season_id and r.id=c.reward_id
where 'archivo_lanzamiento_libro'=any(r.cosmetic_ids)
on conflict(user_id,cosmetic_id) do nothing;
commit;
