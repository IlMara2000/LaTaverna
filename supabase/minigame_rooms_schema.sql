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

drop policy if exists "minigame_rooms_active_read" on public.minigame_rooms;
create policy "minigame_rooms_active_read"
on public.minigame_rooms
for select
to anon, authenticated
using (status <> 'closed' and expires_at > now());

drop policy if exists "minigame_rooms_create" on public.minigame_rooms;
create policy "minigame_rooms_create"
on public.minigame_rooms
for insert
to anon, authenticated
with check (
    length(code) = 6
    and host_client_id <> ''
    and status = 'waiting'
    and expires_at > now()
);

drop policy if exists "minigame_rooms_connect" on public.minigame_rooms;
create policy "minigame_rooms_connect"
on public.minigame_rooms
for update
to anon, authenticated
using (status <> 'closed' and expires_at > now())
with check (
    status in ('waiting', 'connected', 'closed')
    and host_client_id <> ''
    and expires_at > now()
);

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
