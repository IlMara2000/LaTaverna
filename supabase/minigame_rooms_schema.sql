-- La Taverna - Multiplayer minigiochi
-- Eseguire nel SQL Editor Supabase quando il pannello minigiochi mostra
-- "Multiplayer non attivo su Supabase".

create table if not exists public.minigame_rooms (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
    host_client_id text not null,
    guest_client_id text default '',
    status text not null default 'waiting' check (status in ('waiting', 'connected', 'closed')),
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '4 hours')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_minigame_rooms_updated_at on public.minigame_rooms;
create trigger set_minigame_rooms_updated_at
before update on public.minigame_rooms
for each row execute function public.set_updated_at();

alter table public.minigame_rooms enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.minigame_rooms to anon, authenticated;

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


create index if not exists minigame_rooms_code_idx on public.minigame_rooms(code);
create index if not exists minigame_rooms_expires_at_idx on public.minigame_rooms(expires_at);

do $$
begin
    alter publication supabase_realtime add table public.minigame_rooms;
exception
    when duplicate_object then null;
    when undefined_object then null;
end;
$$;

notify pgrst, 'reload schema';
