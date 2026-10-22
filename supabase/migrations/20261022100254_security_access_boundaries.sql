-- Replace legacy permissive access with ownership and invitation membership.
-- Existing rooms cannot be safely assigned to accounts from client-supplied IDs:
-- they remain inaccessible; players create a new room after this upgrade.
alter table public.minigame_rooms add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid();
create table if not exists public.minigame_room_members (
    room_id uuid not null references public.minigame_rooms(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    primary key(room_id,user_id)
);
alter table public.minigame_room_members enable row level security;
revoke all on public.minigame_room_members from anon, authenticated;
grant select on public.minigame_room_members to authenticated;
drop policy if exists minigame_members_self on public.minigame_room_members;
create policy minigame_members_self on public.minigame_room_members for select to authenticated using(user_id=(select auth.uid()));
alter table public.minigame_rooms enable row level security;
revoke all on public.minigame_rooms from anon, authenticated;
grant select, insert on public.minigame_rooms to authenticated;
grant update(data,guest_client_id,status) on public.minigame_rooms to authenticated;
drop policy if exists minigame_rooms_active_read on public.minigame_rooms;
drop policy if exists minigame_rooms_create on public.minigame_rooms;
drop policy if exists minigame_rooms_connect on public.minigame_rooms;
create policy minigame_rooms_active_read on public.minigame_rooms for select to authenticated
using(expires_at>now() and (owner_id=(select auth.uid()) or exists(select 1 from public.minigame_room_members m where m.room_id=id and m.user_id=(select auth.uid()))));
create policy minigame_rooms_create on public.minigame_rooms for insert to authenticated
with check(owner_id=(select auth.uid()) and status='waiting' and host_client_id<>'' and guest_client_id='' and expires_at>now() and expires_at<=now()+interval '4 hours 1 minute');
create policy minigame_rooms_connect on public.minigame_rooms for update to authenticated
using(status<>'closed' and expires_at>now() and (owner_id=(select auth.uid()) or exists(select 1 from public.minigame_room_members m where m.room_id=id and m.user_id=(select auth.uid()))))
with check(expires_at>now() and (owner_id=(select auth.uid()) or exists(select 1 from public.minigame_room_members m where m.room_id=id and m.user_id=(select auth.uid()))));

create schema if not exists private;
create table if not exists private.minigame_join_attempts(user_id uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null, attempts integer not null);
alter table private.minigame_join_attempts enable row level security;
revoke all on private.minigame_join_attempts from public,anon,authenticated;
create or replace function public.join_minigame_room(p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_room public.minigame_rooms%rowtype; v_attempts integer;
begin
    if v_uid is null then raise exception 'Accedi per entrare nella stanza.'; end if;
    insert into private.minigame_join_attempts values(v_uid,now(),1)
    on conflict(user_id) do update set
      attempts=case when private.minigame_join_attempts.window_start<now()-interval '10 minutes' then 1 else private.minigame_join_attempts.attempts+1 end,
      window_start=case when private.minigame_join_attempts.window_start<now()-interval '10 minutes' then now() else private.minigame_join_attempts.window_start end
    returning attempts into v_attempts;
    -- Return normally on rejected attempts so the counter is committed.
    if v_attempts>30 then return; end if;
    select * into v_room from public.minigame_rooms where code=p_code and status<>'closed' and expires_at>now() and owner_id is not null for update;
    if not found then return; end if;
    if v_room.owner_id=v_uid or exists(select 1 from public.minigame_room_members where room_id=v_room.id and user_id=v_uid) then return; end if;
    if (select count(*) from public.minigame_room_members where room_id=v_room.id)>=(case when v_room.data->>'scope'='magic' then 3 else 7 end) then return; end if;
    if v_room.data->'magic'->'game' is not null and v_room.data->'magic'->'game'<>'null'::jsonb then return; end if;
    insert into public.minigame_room_members values(v_room.id,v_uid) on conflict do nothing;
end;
$$;
revoke all on function public.join_minigame_room(text) from public,anon;
grant execute on function public.join_minigame_room(text) to authenticated;

-- Legacy ALL/true policies are OR'ed with owner policies, so must be removed.
drop policy if exists "Accesso totale per utenti autenticati" on public.characters;
drop policy if exists characters_owner_all on public.characters;
create policy characters_owner_all on public.characters for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- Legacy tables are no longer used by the app, but retain owner access to data.
do $$ begin
 if to_regclass('public.session') is not null then
  execute 'drop policy if exists "Accesso totale per utenti autenticati" on public.session';
  execute 'drop policy if exists legacy_session_owner on public.session';
  execute 'create policy legacy_session_owner on public.session for all to authenticated using(dm_id=(select auth.uid())) with check(dm_id=(select auth.uid()))';
 end if;
 if to_regclass('public.tokens') is not null then
  execute 'drop policy if exists "Accesso totale per utenti autenticati" on public.tokens';
  execute 'drop policy if exists legacy_tokens_owner on public.tokens';
  execute 'create policy legacy_tokens_owner on public.tokens for all to authenticated using(exists(select 1 from public.session s where s.id=session_id and s.dm_id=(select auth.uid()))) with check(exists(select 1 from public.session s where s.id=session_id and s.dm_id=(select auth.uid())))';
 end if;
 if to_regclass('public.chat_messages') is not null then
  execute 'drop policy if exists "Accesso totale per utenti autenticati" on public.chat_messages';
  execute 'drop policy if exists legacy_chat_owner on public.chat_messages';
  execute 'create policy legacy_chat_owner on public.chat_messages for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))';
 end if;
end $$;

-- Uploaded public maps remain publicly readable; only their uploader may mutate.
drop policy if exists vtt_assets_owner_write on storage.objects;
drop policy if exists "Caricamento per Utenti Autenticati" on storage.objects;
drop policy if exists "Eliminazione file propri" on storage.objects;
drop policy if exists vtt_assets_insert_own on storage.objects;
create policy vtt_assets_insert_own on storage.objects for insert to authenticated with check(bucket_id='vtt_assets' and owner_id=(select auth.uid())::text);
drop policy if exists vtt_assets_update_own on storage.objects;
create policy vtt_assets_update_own on storage.objects for update to authenticated using(bucket_id='vtt_assets' and owner_id=(select auth.uid())::text) with check(bucket_id='vtt_assets' and owner_id=(select auth.uid())::text);
drop policy if exists vtt_assets_delete_own on storage.objects;
create policy vtt_assets_delete_own on storage.objects for delete to authenticated using(bucket_id='vtt_assets' and owner_id=(select auth.uid())::text);
notify pgrst,'reload schema';
