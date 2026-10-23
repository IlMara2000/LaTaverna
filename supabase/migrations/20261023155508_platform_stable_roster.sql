-- Preserve seats when another participant joins or leaves.
create or replace function public.join_platform_room(p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.minigame_rooms%rowtype; u uuid:=auth.uid(); roster jsonb;
begin
 if u is null then raise exception 'Accedi per collegarti.'; end if;
 perform public.join_minigame_room(p_code);
 select * into r from public.minigame_rooms where code=p_code and data->>'scope'='platform' and status<>'closed' and expires_at>now() for update;
 if not found then return; end if;
 if r.owner_id<>u and not exists(select 1 from public.minigame_room_members where room_id=r.id and user_id=u) then return; end if;
 select coalesce(jsonb_agg(uid order by ordering,coalesce((select ord from jsonb_array_elements_text(case when jsonb_typeof(r.data->'participants')='array' then r.data->'participants' else '[]'::jsonb end) with ordinality p(id,ord) where id=uid limit 1),9999),uid),'[]'::jsonb) into roster from (
   select r.owner_id::text uid,0 ordering union all select user_id::text,1 from public.minigame_room_members where room_id=r.id and user_id<>r.owner_id
 ) members;
 update public.minigame_rooms set data=jsonb_set(coalesce(data,'{}'::jsonb),'{participants}',roster),
 guest_client_id=coalesce(roster->>1,''),status=case when jsonb_array_length(roster)>1 then 'connected' else 'waiting' end where id=r.id;
end $$;

create or replace function public.leave_platform_room(p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.minigame_rooms%rowtype; u uuid:=auth.uid(); roster jsonb;
begin
 if u is null then raise exception 'Accedi per scollegarti.'; end if;
 select * into r from public.minigame_rooms where code=p_code for update;
 if not found then return; end if;
 if r.owner_id=u then
   update public.minigame_rooms set status='closed',dnd_session_id=null where id=r.id;
 elsif exists(select 1 from public.minigame_room_members where room_id=r.id and user_id=u) then
   delete from public.minigame_room_members where room_id=r.id and user_id=u;
   select coalesce(jsonb_agg(uid order by ordering,coalesce((select ord from jsonb_array_elements_text(case when jsonb_typeof(r.data->'participants')='array' then r.data->'participants' else '[]'::jsonb end) with ordinality p(id,ord) where id=uid limit 1),9999),uid),'[]'::jsonb) into roster from (
     select r.owner_id::text uid,0 ordering union all select user_id::text,1 from public.minigame_room_members where room_id=r.id and user_id<>r.owner_id
   ) members;
   update public.minigame_rooms set data=jsonb_set(coalesce(data,'{}'::jsonb)-'onlineMatch','{participants}',roster),guest_client_id=coalesce(roster->>1,''),
   status=case when jsonb_array_length(roster)>1 then 'connected' else 'waiting' end where id=r.id;
 end if;
end $$;
