-- El navegador nunca obtiene UUID ajenos ni invoca este resolver privilegiado.
begin;
create function public.resolver_amigo_en_linea(p_actor uuid,p_codigo text) returns jsonb
language sql security definer set search_path = '' as $$
    select jsonb_build_object('destino',(
        select p.id from public.profiles p
        join private.friendships f on f.user_low = least(p_actor,p.id) and f.user_high = greatest(p_actor,p.id) and f.accepted
        join private.account_presence a on a.user_id = p.id
        where p.friend_code = upper(p_codigo) and p_actor <> p.id
            and a.last_seen_at > clock_timestamp() - interval '90 seconds'
        limit 1
    ));
$$;
revoke all on function public.resolver_amigo_en_linea(uuid,text) from public,anon,authenticated;
grant execute on function public.resolver_amigo_en_linea(uuid,text) to service_role;
commit;
