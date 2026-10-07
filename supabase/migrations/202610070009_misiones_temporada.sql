-- Misiones mensuales reales. Conserva recibos, IDs diarios/semanales y puntos del pase 1:1.
begin;
create function private.misiones_temporada_actuales(p_actor uuid, p_ahora timestamptz default now())
returns table(id text, titulo text, objetivo integer, progreso integer, xp integer, completada boolean, reclamada boolean, periodo text)
language sql stable security definer set search_path = '' as $$
    with ventana as (
        select t.*, c.activated_at from private.metadatos_temporada(p_ahora) t
        cross join private.community_settings c
    ), catalogo(clave,titulo,objetivo,xp,victoria) as (values
        ('jugar10','Completa diez partidas de temporada',10,100,false),
        ('ganar5','Gana cinco partidas de temporada',5,150,true)
    ), datos as (
        select 'temporada:' || c.clave || ':' || substring(v.id from 11) id, c.titulo,c.objetivo,c.xp,
            least(c.objetivo,(select count(*) from private.match_participants p
                join private.matches m on m.id = p.match_id
                where p.user_id = p_actor and (not c.victoria or p.winner)
                and m.completed_at >= greatest(v.inicio,v.activated_at)
                and m.completed_at < v.fin and m.completed_at <= p_ahora)::integer) progreso
        from catalogo c cross join ventana v
    ) select d.id,d.titulo,d.objetivo,d.progreso,d.xp,d.progreso >= d.objetivo,
        exists(select 1 from private.mission_claims c where c.user_id = p_actor and c.mission_id = d.id),'temporada'::text
    from datos d;
$$;

create or replace function public.misiones() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb;
begin
    with actuales as (
        select * from private.misiones_actuales(actor)
        union all select * from private.misiones_temporada_actuales(actor)
    ), vistas as (
        select m.*, (to_jsonb(m)-'periodo') || jsonb_build_object('puntosPase',m.xp,'descripcion',
            case when split_part(m.id,':',2) like 'ganar%' then
                'Consigue ' || m.objetivo || case when m.objetivo = 1 then ' victoria' else ' victorias' end || ' en partidas completadas.'
            else 'Completa ' || m.objetivo || case when m.objetivo = 1 then ' partida' else ' partidas' end || ' en cualquier modo de juego.' end) v
        from actuales m
    ) select jsonb_build_object(
        'diarias',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='diarias'),'[]'::jsonb),
        'semanales',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='semanales'),'[]'::jsonb),
        'temporada',coalesce(jsonb_agg(v order by xp,id) filter(where periodo='temporada'),'[]'::jsonb),
        'reinicioDiario',(date_trunc('day',now() at time zone 'UTC') + interval '1 day') at time zone 'UTC',
        'reinicioSemanal',(date_trunc('week',now() at time zone 'UTC') + interval '1 week') at time zone 'UTC',
        'reinicioTemporada',(select fin from private.metadatos_temporada(now())))
    into resultado from vistas;
    return resultado;
end $$;

create or replace function public.reclamar_mision(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); m record; insertada text;
begin
    if p_id is null or length(p_id) > 64 then raise exception 'Misión inválida' using errcode='22023'; end if;
    perform 1 from public.profiles where id=actor for update;
    select * into m from (
        select * from private.misiones_actuales(actor)
        union all select * from private.misiones_temporada_actuales(actor)
    ) actuales where id=p_id;
    if not found then raise exception 'La misión no existe o ha caducado' using errcode='22023'; end if;
    if not m.completada then raise exception 'La misión todavía no está completada' using errcode='22023'; end if;
    insert into private.mission_claims(user_id,mission_id,xp) values(actor,p_id,m.xp)
    on conflict(user_id,mission_id) do nothing returning mission_id into insertada;
    -- El trigger existente del recibo aporta puntos al pase una sola vez.
    if insertada is not null then update public.profiles set xp=xp+m.xp where id=actor; end if;
    return public.misiones();
end $$;

revoke all on function private.misiones_temporada_actuales(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.misiones(),public.reclamar_mision(text) from public,anon,authenticated;
grant execute on function public.misiones(),public.reclamar_mision(text) to authenticated;
commit;
