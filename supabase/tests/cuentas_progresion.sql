-- Ejecutar con psql -v ON_ERROR_STOP=1, como postgres, solo en proyecto de pruebas.
-- Requiere la migración. Toda modificación se revierte al terminar.
begin;
insert into auth.users(id, email, raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000001', 'tesis-sql-1@example.invalid', '{"display_name":"Ada"}'),
 ('10000000-0000-0000-0000-000000000002', 'tesis-sql-2@example.invalid', '{"display_name":"Lin"}');
insert into auth.users(id, email, raw_user_meta_data) values
 ('10000000-0000-0000-0000-000000000003', 'tesis-sql-3@example.invalid', jsonb_build_object('display_name', E'Nombre\ncontrol'));

do $$
begin
 if (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001') <> 'Ada' then
   raise exception 'El trigger no creó el perfil';
 end if;
 if (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000003') <> 'Investigador' then
   raise exception 'El trigger permitió caracteres de control';
 end if;
 if has_function_privilege('anon', 'public.registrar_resultado(uuid,text,timestamp with time zone,jsonb,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.registrar_resultado(uuid,text,timestamp with time zone,jsonb,integer)', 'EXECUTE') then
   raise exception 'RPC expuesto al navegador';
 end if;
 if has_schema_privilege('authenticated', 'private', 'USAGE')
    or has_schema_privilege('anon', 'private', 'USAGE')
    or has_column_privilege('authenticated', 'public.profiles', 'xp', 'UPDATE') then
   raise exception 'Permisos excesivos';
 end if;
end $$;

set local role service_role;
select public.registrar_resultado('20000000-0000-0000-0000-000000000001', repeat('a',64), now(),
 '[{"seat":0,"user_id":"10000000-0000-0000-0000-000000000001","display_name":"Ada","prestige":10,"winner":true},
   {"seat":1,"user_id":"10000000-0000-0000-0000-000000000002","display_name":"Lin","prestige":10,"winner":true},
   {"seat":2,"user_id":null,"display_name":"Invitado","prestige":3,"winner":false}]');
-- Reintento: nueva fecha de entrega, mismo resultado.
select public.registrar_resultado('20000000-0000-0000-0000-000000000001', repeat('a',64), now(),
 '[{"seat":0,"user_id":"10000000-0000-0000-0000-000000000001","display_name":"Ada","prestige":10,"winner":true},
   {"seat":1,"user_id":"10000000-0000-0000-0000-000000000002","display_name":"Lin","prestige":10,"winner":true},
   {"seat":2,"user_id":null,"display_name":"Invitado","prestige":3,"winner":false}]');

do $$
begin
 if (select count(*) from private.reward_ledger) <> 2
    or exists (select 1 from public.profiles where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')
               and (xp <> 150 or games_finished <> 1 or wins <> 1)) then
   raise exception 'Reintento duplicado o empate mal recompensado';
 end if;
 begin
   perform public.registrar_resultado('20000000-0000-0000-0000-000000000001', repeat('b',64), now(),
    '[{"seat":0,"user_id":null,"display_name":"A","prestige":0,"winner":true},
      {"seat":1,"user_id":null,"display_name":"B","prestige":0,"winner":true},
      {"seat":2,"user_id":null,"display_name":"C","prestige":0,"winner":true}]');
   raise exception 'Aceptó resultado contradictorio';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.registrar_resultado('20000000-0000-0000-0000-000000000002', repeat('b',64), now(),
    '[{"seat":0,"user_id":null,"display_name":"A","prestige":10,"winner":false},
      {"seat":1,"user_id":null,"display_name":"B","prestige":0,"winner":true},
      {"seat":2,"user_id":null,"display_name":"C","prestige":0,"winner":false}]');
   raise exception 'Aceptó victoria falsificada';
 exception when invalid_parameter_value then null;
 end;
 if exists (select 1 from private.matches where id = '20000000-0000-0000-0000-000000000002') then
   raise exception 'Validación fallida dejó efectos';
 end if;
 begin
   perform public.registrar_resultado('20000000-0000-0000-0000-000000000003', repeat('c',64), now(),
    '[{"seat":0,"user_id":"10000000-0000-0000-0000-000000000001","display_name":"A","prestige":10,"winner":true},
      {"seat":1,"user_id":"10000000-0000-0000-0000-000000000099","display_name":"B","prestige":0,"winner":false},
      {"seat":2,"user_id":null,"display_name":"C","prestige":0,"winner":false}]');
   raise exception 'Aceptó cuenta inexistente';
 exception when foreign_key_violation then null;
 end;
 if exists (select 1 from private.matches where id = '20000000-0000-0000-0000-000000000003')
    or (select xp from public.profiles where id = '10000000-0000-0000-0000-000000000001') <> 150 then
   raise exception 'Fallo parcial no hizo rollback';
 end if;
end $$;

-- Un invitado gana: las cuentas terminan con 100 XP y sin victoria adicional.
select public.registrar_resultado('20000000-0000-0000-0000-000000000004', repeat('d',64), now(),
 '[{"seat":0,"user_id":"10000000-0000-0000-0000-000000000001","display_name":"Ada","prestige":5,"winner":false},
   {"seat":1,"user_id":"10000000-0000-0000-0000-000000000002","display_name":"Lin","prestige":5,"winner":false},
   {"seat":2,"user_id":null,"display_name":"Invitado","prestige":10,"winner":true}]');
do $$
begin
 if exists (select 1 from public.profiles where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')
            and (xp <> 250 or games_finished <> 2 or wins <> 1))
    or (select count(*) from private.reward_ledger where match_id = '20000000-0000-0000-0000-000000000004') <> 2 then
   raise exception 'Bonus incorrecto o recompensa al invitado';
 end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'RLS revela otro perfil'; end if;
 update public.profiles set display_name = 'Ada nueva' where id = '10000000-0000-0000-0000-000000000001';
 if (select display_name from public.profiles) <> 'Ada nueva' then raise exception 'No permite editar nombre propio'; end if;
 begin
   update public.profiles set xp = 999999 where id = '10000000-0000-0000-0000-000000000001';
   raise exception 'El navegador pudo adjudicar experiencia';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.profiles set display_name = E'Mal\nnombre' where id = '10000000-0000-0000-0000-000000000001';
   raise exception 'Aceptó caracteres de control';
 exception when check_violation then null;
 end;
 update public.profiles set display_name = 'Ataque' where id = '10000000-0000-0000-0000-000000000002';
 if found then raise exception 'RLS permitió editar otro perfil'; end if;
end $$;
reset role;
rollback;
