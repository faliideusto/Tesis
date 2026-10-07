-- Perfil público autenticado. Aplicar después de presencia y sugerencias.
begin;
create function public.perfil_publico(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.actor_comunidad(); perfil public.profiles%rowtype; disponible boolean;
begin
    if p_codigo is null or p_codigo !~ '^[A-Fa-f0-9]{16}$' then
        raise exception 'Código de perfil inválido' using errcode = '22023';
    end if;
    select * into perfil from public.profiles where friend_code = upper(p_codigo);
    if not found then raise exception 'Perfil público no encontrado' using errcode = 'P0002'; end if;
    disponible := perfil.id = actor or exists(select 1 from private.friendships
        where user_low = least(actor,perfil.id) and user_high = greatest(actor,perfil.id) and accepted);
    return jsonb_build_object('codigo',perfil.friend_code,'nombre',perfil.display_name,
        'xp',perfil.xp,'nivel',least(2147483647::bigint,1 + perfil.xp / 500),
        'partidasTerminadas',perfil.games_finished,'victorias',perfil.wins,
        'presenciaDisponible',disponible,'enLinea',disponible and exists(select 1 from private.account_presence
            where user_id = perfil.id and last_seen_at > clock_timestamp() - interval '90 seconds'));
end $$;
revoke all on function public.perfil_publico(text) from public, anon, authenticated;
grant execute on function public.perfil_publico(text) to authenticated;
commit;
