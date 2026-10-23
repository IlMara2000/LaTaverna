-- One authenticated invitation connects games and the D&D table.
alter table public.minigame_rooms add column if not exists dnd_session_id uuid references public.dnd_sessions(id) on delete set null;
create index if not exists minigame_rooms_dnd_session_idx on public.minigame_rooms(dnd_session_id) where dnd_session_id is not null;
create policy platform_room_insert_boundary on public.minigame_rooms as restrictive for insert to authenticated
with check(dnd_session_id is null and (data->>'scope' is distinct from 'platform' or host_client_id=(select auth.uid())::text));
alter table public.dnd_tokens add column if not exists controller_id uuid references auth.users(id) on delete set null;
create unique index if not exists dnd_player_pawn_unique on public.dnd_tokens(session_id,controller_id) where controller_id is not null;

create or replace function public.join_platform_room(p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.minigame_rooms%rowtype; u uuid:=auth.uid(); roster jsonb;
begin
 if u is null then raise exception 'Accedi per collegarti.'; end if;
 perform public.join_minigame_room(p_code);
 select * into r from public.minigame_rooms where code=p_code and data->>'scope'='platform' and status<>'closed' and expires_at>now() for update;
 if not found then return; end if;
 if r.owner_id<>u and not exists(select 1 from public.minigame_room_members where room_id=r.id and user_id=u) then return; end if;
 select coalesce(jsonb_agg(uid order by ordering,uid),'[]'::jsonb) into roster from (
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
   select coalesce(jsonb_agg(uid order by ordering,uid),'[]'::jsonb) into roster from (
     select r.owner_id::text uid,0 ordering union all select user_id::text,1 from public.minigame_room_members where room_id=r.id and user_id<>r.owner_id
   ) members;
   update public.minigame_rooms set data=jsonb_set(coalesce(data,'{}'::jsonb)-'onlineMatch','{participants}',roster),guest_client_id=coalesce(roster->>1,''),
   status=case when jsonb_array_length(roster)>1 then 'connected' else 'waiting' end where id=r.id;
 end if;
end $$;

create or replace function public.link_platform_dnd_room(p_code text,p_session_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dnd_sessions where id=p_session_id and user_id=auth.uid()) then raise exception 'Solo il Master può condividere questa sessione.'; end if;
 update public.minigame_rooms set dnd_session_id=p_session_id where code=p_code and owner_id=auth.uid() and status<>'closed' and expires_at>now() and data->>'scope'='platform';
 if not found then raise exception 'Crea il collegamento Multiplayer come Master.'; end if;
end $$;

create or replace function public.is_platform_dnd_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.minigame_rooms r where r.dnd_session_id=p_session_id and r.status<>'closed' and r.expires_at>now()
 and (r.owner_id=auth.uid() or exists(select 1 from public.minigame_room_members m where m.room_id=r.id and m.user_id=auth.uid())))
$$;
-- Players receive only public table fields; private Master notes stay on the server.
create or replace function public.get_platform_dnd_session(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.dnd_sessions%rowtype;
begin
 if not public.is_platform_dnd_member(p_session_id) then return null; end if;
 select * into s from public.dnd_sessions where id=p_session_id;
 if s.user_id=auth.uid() then return to_jsonb(s); end if;
 return jsonb_build_object('id',s.id,'user_id',s.user_id,'system_id',s.system_id,'name',s.name,'status',s.status,'party_level',s.party_level,'next_date',s.next_date,'map_url',s.map_url,'data',
 (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(coalesce(s.data,'{}'::jsonb)) where key in ('initiative','round','turnCount','timeOfDay','fogEnabled','weather','gridVisible','map_grid_size','mapUrl','scene','public_summary','objective_done')));
end $$;
create policy platform_tokens_read on public.dnd_tokens for select to authenticated using(public.is_platform_dnd_member(session_id));
create policy platform_chat_read on public.dnd_chat for select to authenticated using(public.is_platform_dnd_member(session_id));
create policy platform_chat_send on public.dnd_chat for insert to authenticated with check(public.is_platform_dnd_member(session_id) and sender_id=(select auth.uid()) and length(message) between 1 and 4000 and length(sender_name) between 1 and 80);

create or replace function public.ensure_platform_pawn(p_session_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare token_id uuid;
begin
 if not public.is_platform_dnd_member(p_session_id) then raise exception 'Collegamento al tavolo non attivo.'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 80 then raise exception 'Nome non valido.'; end if;
 insert into public.dnd_tokens(session_id,controller_id,name,x,y,color,data) values(p_session_id,auth.uid(),trim(p_name),100,100,'#9c77d5','{}')
 on conflict(session_id,controller_id) where controller_id is not null do update set name=excluded.name returning id into token_id;
 return token_id;
end $$;
create or replace function public.move_platform_pawn(p_token_id uuid,p_x integer,p_y integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_x is null or p_y is null or p_x not between -100000 and 100000 or p_y not between -100000 and 100000 then raise exception 'Posizione non valida.'; end if;
 update public.dnd_tokens set x=p_x,y=p_y where id=p_token_id and controller_id=auth.uid() and public.is_platform_dnd_member(session_id);
 if not found then raise exception 'Puoi muovere solo la tua pedina in un tavolo collegato.'; end if;
end $$;
revoke all on function public.get_platform_dnd_session(uuid),public.join_platform_room(text),public.leave_platform_room(text),public.link_platform_dnd_room(text,uuid),public.is_platform_dnd_member(uuid),public.ensure_platform_pawn(uuid,text),public.move_platform_pawn(uuid,integer,integer) from public,anon;
grant execute on function public.get_platform_dnd_session(uuid),public.join_platform_room(text),public.leave_platform_room(text),public.link_platform_dnd_room(text,uuid),public.is_platform_dnd_member(uuid),public.ensure_platform_pawn(uuid,text),public.move_platform_pawn(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
