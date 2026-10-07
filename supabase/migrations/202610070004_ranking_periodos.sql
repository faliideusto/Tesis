-- Ranking histórico, social y por ventanas civiles españolas. No reinicia perfiles.
begin;
create index ranking_resultados_fecha on private.matches(completed_at);
create index ranking_misiones_fecha on private.mission_claims(claimed_at,user_id);

create function private.ventana_ranking(p_ambito text,p_ahora timestamptz)
returns table(id text,inicio timestamptz,fin timestamptz)
language sql stable set search_path = '' as $$
    with civil as (select date_trunc(case p_ambito when 'semanal' then 'week' else 'month' end,
        p_ahora at time zone 'Europe/Madrid') principio)
    select p_ambito || ':' || to_char(principio,case p_ambito when 'semanal' then 'YYYY-MM-DD' else 'YYYY-MM' end),
        principio at time zone 'Europe/Madrid',
        (principio + case p_ambito when 'semanal' then interval '1 week' else interval '1 month' end) at time zone 'Europe/Madrid'
    from civil where p_ambito in ('semanal','temporada');
$$;
revoke all on function private.ventana_ranking(text,timestamptz) from public,anon,authenticated;

create function public.ranking_periodo(p_criterio text default 'xp',p_ambito text default 'global') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb; ventana record; periodo jsonb := null;
begin
    if p_criterio is null or p_criterio not in ('xp','victorias','partidas') then
        raise exception 'Criterio de ranking inválido' using errcode = '22023';
    end if;
    if p_ambito is null or p_ambito not in ('global','amigos','semanal','temporada') then
        raise exception 'Ámbito de ranking inválido' using errcode = '22023';
    end if;
    select * into ventana from private.ventana_ranking(p_ambito,now());
    if p_ambito in ('semanal','temporada') then
        periodo := jsonb_build_object('id',ventana.id,'inicio',ventana.inicio,'fin',ventana.fin,'zonaHoraria','Europe/Madrid');
    end if;
    with juego as (
        select mp.user_id,count(*) partidas,count(*) filter(where mp.winner) victorias
        from private.match_participants mp join private.matches m on m.id = mp.match_id
        where mp.user_id is not null and m.completed_at >= ventana.inicio and m.completed_at < ventana.fin and m.completed_at <= now()
        group by mp.user_id
    ), premios as (
        select r.user_id,sum(r.xp) xp from private.reward_ledger r join private.matches m on m.id = r.match_id
        where m.completed_at >= ventana.inicio and m.completed_at < ventana.fin and m.completed_at <= now() group by r.user_id
    ), misiones as (
        select mc.user_id,sum(mc.xp) xp from private.mission_claims mc
        where mc.claimed_at >= ventana.inicio and mc.claimed_at < ventana.fin and mc.claimed_at <= now() group by mc.user_id
    ), datos as (
        select p.id,p.friend_code,p.display_name,least(2147483647::bigint,1 + p.xp / 500) nivel,
            case when p_ambito in ('global','amigos') then p.xp else coalesce(pr.xp,0) + coalesce(mi.xp,0) end xp,
            case when p_ambito in ('global','amigos') then p.wins else coalesce(j.victorias,0) end victorias,
            case when p_ambito in ('global','amigos') then p.games_finished else coalesce(j.partidas,0) end partidas
        from public.profiles p left join juego j on j.user_id = p.id left join premios pr on pr.user_id = p.id left join misiones mi on mi.user_id = p.id
        where p_ambito <> 'amigos' or p.id = actor or exists(select 1 from private.friendships f
            where f.user_low = least(actor,p.id) and f.user_high = greatest(actor,p.id) and f.accepted)
    ), clasificacion as (
        select d.*,rank() over(order by case p_criterio when 'xp' then xp when 'victorias' then victorias else partidas end desc) posicion,
            row_number() over(order by case p_criterio when 'xp' then xp when 'victorias' then victorias else partidas end desc,friend_code) orden from datos d
    ), vistas as (
        select orden,id,jsonb_build_object('posicion',posicion,'codigo',friend_code,'nombre',display_name,'nivel',nivel,
            'xp',xp,'victorias',victorias,'partidas',partidas,'yo',id = actor) v from clasificacion
    ) select jsonb_build_object('criterio',p_criterio,'ambito',p_ambito,'periodo',periodo,
        'entradas',coalesce(jsonb_agg(v order by orden) filter(where orden <= 50),'[]'::jsonb),
        'propia',(select v from vistas where id = actor)) into resultado from vistas;
    return resultado;
end $$;
revoke all on function public.ranking_periodo(text,text) from public,anon,authenticated;
grant execute on function public.ranking_periodo(text,text) to authenticated;
commit;
