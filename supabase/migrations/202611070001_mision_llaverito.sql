-- Tesis: misión especial «Llaverito» (petición del profesor Choquet).
--   especial:llaverito  Llega al rango Catedrático (nivel 25, 12.000 XP) -> Choquet entrega un llavero
--                       físico en persona. En el juego no da XP, puntos de pase ni cosméticos: reclamarla
--                       deja constancia (mission_claims con xp 0) para enseñársela a Choquet.
-- El nivel se deriva del XP del perfil en el servidor (1 + xp / 500), igual que el resto de RPC.
-- El progreso muestra el nivel actual hasta 25. Aplicar una vez tras 202611050001.
begin;
alter table private.mission_claims drop constraint mission_claims_xp_check;
alter table private.mission_claims add constraint mission_claims_xp_check check(xp in (0,50,75,100,150,200,300,400,500,1000,1500));

create or replace function private.misiones_especiales_actuales(p_actor uuid)
returns table(id text, titulo text, descripcion text, objetivo integer, progreso integer, xp integer,
              completada boolean, reclamada boolean, recompensa text)
language sql stable security definer set search_path = '' as $$
    with ganadas as (
        select p.prestige,
            p.prestige - coalesce((select max(o.prestige) from private.match_participants o
                                   where o.match_id = p.match_id and o.seat <> p.seat), 0) ventaja
        from private.match_participants p join private.matches m on m.id = p.match_id
        cross join private.community_settings c
        where p.user_id = p_actor and p.winner
          and m.completed_at >= c.activated_at and m.completed_at <= now()
    ), nivel as (
        select least(25, 1 + coalesce((select pr.xp from public.profiles pr where pr.id = p_actor), 0) / 500)::integer n
    ), catalogo(id,titulo,descripcion,xp,recompensa,objetivo,progreso) as (values
        ('especial:cumlaude','Cum Laude','Gana una partida con 20 o más puntos de prestigio.',0,'especial_cum_laude',1,
            case when exists(select 1 from ganadas where prestige >= 20) then 1 else 0 end),
        ('especial:paliza5','Victoria aplastante','Gana una partida sacando 5 o más puntos de prestigio al segundo.',500,null::text,1,
            case when exists(select 1 from ganadas where ventaja >= 5) then 1 else 0 end),
        ('especial:llaverito','Llaverito','Llega al rango Catedrático (nivel 25). El profesor Choquet te entregará un llavero en persona.',0,null::text,25,
            (select n from nivel))
    ) select c.id,c.titulo,c.descripcion,c.objetivo,c.progreso,c.xp,c.progreso >= c.objetivo,
        case when c.recompensa is null
             then exists(select 1 from private.mission_claims mc where mc.user_id = p_actor and mc.mission_id = c.id)
             else exists(select 1 from private.cosmetics_inventory i where i.user_id = p_actor and i.cosmetic_id = c.recompensa) end,
        c.recompensa
    from catalogo c;
$$;
revoke all on function private.misiones_especiales_actuales(uuid) from public,anon,authenticated;
commit;
