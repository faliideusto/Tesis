-- Empate a prestigio resuelto por desempate del motor, con un invitado en la mesa. Rollback completo.
begin;
insert into auth.users(id,raw_user_meta_data) values
('87000000-0000-0000-0000-000000000001','{"display_name":"Ana"}'),
('87000000-0000-0000-0000-000000000002','{"display_name":"Bea"}');
-- Ana y Bea empatan a 5 de prestigio; el motor da la victoria a Ana por monedas.
select public.registrar_resultado('88000000-0000-0000-0000-000000000001',repeat('d',64),now(),
'[{"seat":0,"user_id":"87000000-0000-0000-0000-000000000001","display_name":"Ana","prestige":5,"winner":true},
{"seat":1,"user_id":"87000000-0000-0000-0000-000000000002","display_name":"Bea","prestige":5,"winner":false},
{"seat":2,"user_id":null,"display_name":"Invitado","prestige":2,"winner":false}]');
do $$ begin
 if (select xp from public.profiles where id='87000000-0000-0000-0000-000000000001')<>300
 or (select wins from public.profiles where id='87000000-0000-0000-0000-000000000001')<>1
 or (select xp from public.profiles where id='87000000-0000-0000-0000-000000000002')<>200
 or (select wins from public.profiles where id='87000000-0000-0000-0000-000000000002')<>0
 or (select games_finished from public.profiles where id='87000000-0000-0000-0000-000000000002')<>1
 then raise exception 'Desempate del motor sin XP'; end if;
end $$;
-- Siguen rechazados: un ganador sin el prestigio máximo y una partida sin ganadores.
do $$ begin
 begin
  perform public.registrar_resultado('88000000-0000-0000-0000-000000000002',repeat('e',64),now(),
  '[{"seat":0,"user_id":null,"display_name":"A","prestige":5,"winner":false},
  {"seat":1,"user_id":null,"display_name":"B","prestige":4,"winner":true},
  {"seat":2,"user_id":null,"display_name":"C","prestige":1,"winner":false}]');
  raise exception 'Aceptó un ganador sin prestigio máximo';
 exception when sqlstate '22023' then null; end;
 begin
  perform public.registrar_resultado('88000000-0000-0000-0000-000000000003',repeat('e',64),now(),
  '[{"seat":0,"user_id":null,"display_name":"A","prestige":5,"winner":false},
  {"seat":1,"user_id":null,"display_name":"B","prestige":5,"winner":false},
  {"seat":2,"user_id":null,"display_name":"C","prestige":1,"winner":false}]');
  raise exception 'Aceptó una partida sin ganadores';
 exception when sqlstate '22023' then null; end;
end $$;
rollback;
