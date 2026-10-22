-- Run with an administrative connection. All fixtures and mutations roll back.
begin;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into public.minigame_rooms(code,host_client_id) values('TST234','test-host');
insert into public.characters(user_id,name) values(auth.uid(),'Security regression fixture');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$ begin
 if exists(select 1 from public.minigame_rooms where code='TST234') then raise exception 'Outsider reads room'; end if;
 if exists(select 1 from public.characters where user_id='00000000-0000-4000-8000-000000000001') then raise exception 'Outsider reads character'; end if;
 update public.minigame_rooms set status='closed' where code='TST234';
 if found then raise exception 'Outsider updates room'; end if;
 begin
  insert into public.minigame_rooms(code,host_client_id,owner_id) values('TST235','fake','00000000-0000-4000-8000-000000000001');
  raise exception 'Forged room owner accepted';
 exception when insufficient_privilege then null; end;
end $$;
select public.join_minigame_room('WRONG1');
do $$ begin
 if exists(select 1 from public.minigame_rooms where code='TST234') then raise exception 'Wrong invite accepted'; end if;
end $$;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select public.join_minigame_room('TST234');
do $$ begin
 if not exists(select 1 from public.minigame_rooms where code='TST234') then raise exception 'Invited member cannot read'; end if;
 update public.minigame_rooms set data='{"joined":true}' where code='TST234';
 if not found then raise exception 'Invited member cannot update'; end if;
 begin
  update public.minigame_rooms set owner_id=auth.uid() where code='TST234';
  raise exception 'Owner can be reassigned';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.minigame_rooms; raise exception 'Anon can read rooms';
 exception when insufficient_privilege then null; end;
 begin perform public.join_minigame_room('TST234'); raise exception 'Anon can join';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
