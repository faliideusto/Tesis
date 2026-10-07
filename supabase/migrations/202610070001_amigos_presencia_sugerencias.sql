-- Aplicar después de comunidad_misiones. Ningún dato privado se expone por REST.
begin;
create table private.account_presence (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    last_seen_at timestamptz not null
);
alter table private.account_presence enable row level security;
revoke all on private.account_presence from public, anon, authenticated;
grant select, insert, update, delete on private.account_presence to service_role;

-- Una marca por cuenta: cerrar una pestaña no apaga otras sesiones activas.
-- El cliente no puede enviar actor, timestamp ni estado arbitrario.
create function public.presencia() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad();
begin
    insert into private.account_presence(user_id,last_seen_at) values(actor,clock_timestamp())
    on conflict(user_id) do update set last_seen_at = greatest(private.account_presence.last_seen_at,excluded.last_seen_at);
    return jsonb_build_object('activa',true);
end $$;

create or replace function public.comunidad() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); resultado jsonb; propuestas jsonb;
begin
    select jsonb_build_object('codigo', (select friend_code from public.profiles where id = actor),
        'amigos', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where f.accepted), '[]'::jsonb),
        'recibidas', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where not f.accepted and f.requester <> actor), '[]'::jsonb),
        'enviadas', coalesce(jsonb_agg(v order by p.display_name, p.friend_code) filter(where not f.accepted and f.requester = actor), '[]'::jsonb))
    into resultado from private.friendships f
    join public.profiles p on p.id = case when f.user_low = actor then f.user_high else f.user_low end
    left join private.account_presence a on a.user_id = p.id
    cross join lateral (select jsonb_build_object('codigo', p.friend_code, 'nombre', p.display_name,
        'nivel', 1 + p.xp / 500, 'enLinea', f.accepted and coalesce(a.last_seen_at > clock_timestamp() - interval '90 seconds',false)) as v) x
    where actor in (f.user_low, f.user_high);

    select coalesce(jsonb_agg(jsonb_build_object('codigo',q.friend_code,'nombre',q.display_name,
        'nivel',q.nivel,'enLinea',false) order by q.distancia,q.friend_code),'[]'::jsonb)
    into propuestas from (
        select p.friend_code,p.display_name,1 + p.xp / 500 nivel,
            abs((p.xp / 500) - (select xp / 500 from public.profiles where id = actor)) distancia
        from public.profiles p
        where p.id <> actor and not exists(select 1 from private.friendships f
            where f.user_low = least(actor,p.id) and f.user_high = greatest(actor,p.id))
        order by distancia,p.friend_code limit 12
    ) q;
    return resultado || jsonb_build_object('sugerencias', propuestas, 'presenciaDisponible',true);
end $$;
revoke all on function public.presencia() from public, anon, authenticated;
grant execute on function public.presencia() to authenticated;
-- CREATE OR REPLACE preserva los grants de comunidad().
commit;
