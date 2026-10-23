-- Rollback-only regression fixture: no accounts, rooms or chat are retained.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000000');
insert into public.dnd_sessions(id,user_id,name,data) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Multiplayer regression','{"live_notes":"PRIVATE MASTER NOTE","scene":"Visible scene"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.minigame_rooms(code,host_client_id,data) values('TEST99','00000000-0000-4000-8000-000000000001','{"scope":"platform"}');
select public.link_platform_dnd_room('TEST99','10000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
 if public.get_platform_dnd_session('10000000-0000-4000-8000-000000000001') is not null then raise exception 'Stranger can read table';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.join_platform_room('TEST99');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
select public.join_platform_room('TEST99');
do $$ begin
 if (select data->'participants'->>1 from public.minigame_rooms where code='TEST99') is distinct from '00000000-0000-4000-8000-000000000002' then raise exception 'Existing seat changed after join';end if;
end $$;
select public.leave_platform_room('TEST99');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare shared jsonb; pawn uuid; begin
 shared:=public.get_platform_dnd_session('10000000-0000-4000-8000-000000000001');
 if shared->'data'->>'scene' is distinct from 'Visible scene' or shared->'data' ? 'live_notes' then raise exception 'Private notes exposed or shared scene missing';end if;
 if exists(select 1 from public.dnd_sessions where id='10000000-0000-4000-8000-000000000001') then raise exception 'Guest can read unfiltered session';end if;
 insert into public.dnd_chat(session_id,sender_id,sender_name,message) values('10000000-0000-4000-8000-000000000001',auth.uid(),'Test guest','Test shared chat');
 begin
  insert into public.dnd_chat(session_id,sender_id,sender_name,message) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Master','Spoof');
  raise exception 'Impersonation accepted';
 exception when insufficient_privilege then null;end;
 pawn:=public.ensure_platform_pawn('10000000-0000-4000-8000-000000000001','Test guest');
 perform public.move_platform_pawn(pawn,200,250);
 if not exists(select 1 from public.dnd_tokens where id=pawn and x=200 and y=250) then raise exception 'Pawn did not move';end if;
 perform public.leave_platform_room('TEST99');
 if public.get_platform_dnd_session('10000000-0000-4000-8000-000000000001') is not null then raise exception 'Access not revoked';end if;
 begin
  perform public.move_platform_pawn(pawn,0,0);
  raise exception 'Revoked pawn accepted';
 exception when raise_exception then if sqlerrm='Revoked pawn accepted' then raise;end if;end;
end $$;
rollback;
select 'PASS: platform join, shared scene, private notes, chat identity, pawn movement and leave revocation' as result;
