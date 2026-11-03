-- Victoria = 200 XP extra: 400 al ganador, 200 al resto; invitados sin recibos. Rollback completo.
begin;
insert into auth.users(id,raw_user_meta_data) values
('89000000-0000-0000-0000-000000000001','{"display_name":"Ana"}'),
('89000000-0000-0000-0000-000000000002','{"display_name":"Bea"}');
select public.registrar_resultado('90000000-0000-0000-0000-000000000001',repeat('f',64),now(),
'[{"seat":0,"user_id":"89000000-0000-0000-0000-000000000001","display_name":"Ana","prestige":9,"winner":true},
{"seat":1,"user_id":"89000000-0000-0000-0000-000000000002","display_name":"Bea","prestige":4,"winner":false},
{"seat":2,"user_id":null,"display_name":"Invitado","prestige":2,"winner":false}]');
-- Reenviar el mismo resultado no vuelve a sumar.
select public.registrar_resultado('90000000-0000-0000-0000-000000000001',repeat('f',64),now(),
'[{"seat":0,"user_id":"89000000-0000-0000-0000-000000000001","display_name":"Ana","prestige":9,"winner":true},
{"seat":1,"user_id":"89000000-0000-0000-0000-000000000002","display_name":"Bea","prestige":4,"winner":false},
{"seat":2,"user_id":null,"display_name":"Invitado","prestige":2,"winner":false}]');
do $$ begin
 if (select xp from public.profiles where id='89000000-0000-0000-0000-000000000001')<>400
 or (select xp from public.profiles where id='89000000-0000-0000-0000-000000000002')<>200
 or (select xp from private.reward_ledger where match_id='90000000-0000-0000-0000-000000000001' and user_id='89000000-0000-0000-0000-000000000001')<>400
 or (select count(*) from private.reward_ledger where match_id='90000000-0000-0000-0000-000000000001')<>2
 then raise exception 'La victoria no suma 200 XP'; end if;
end $$;
rollback;
