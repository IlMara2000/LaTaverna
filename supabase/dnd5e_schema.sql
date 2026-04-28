-- La Taverna - Supabase schema
-- Incolla tutto questo file nel Supabase SQL Editor e premi Run.

create table if not exists public.dnd_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    status text not null default 'attiva',
    party_level integer not null default 1,
    next_date text default '',
    map_url text default '',
    description text default '',
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default 'Viandante',
    title text not null default 'Viandante della Taverna',
    avatar_url text default '',
    accent text not null default 'amethyst',
    glow boolean not null default true,
    compact_cards boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    value jsonb not null default 'null'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
);

create table if not exists public.characters (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    system_id text default 'dnd5e',
    name text not null default '',
    class text default '',
    level integer not null default 1,
    hp integer default 10,
    hp_max integer default 10,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.characters
    add column if not exists user_id uuid references auth.users(id) on delete cascade,
    add column if not exists system_id text default 'dnd5e',
    add column if not exists name text default '',
    add column if not exists class text default '',
    add column if not exists level integer not null default 1,
    add column if not exists hp integer default 10,
    add column if not exists hp_max integer default 10,
    add column if not exists data jsonb not null default '{}'::jsonb,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz not null default now();

create table if not exists public.dnd_tokens (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.dnd_sessions(id) on delete cascade,
    character_id uuid null references public.characters(id) on delete set null,
    name text not null default 'Token',
    img text default '',
    color text default '#c77dff',
    x integer not null default 420,
    y integer not null default 420,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.dnd_chat (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.dnd_sessions(id) on delete cascade,
    sender_id uuid null references auth.users(id) on delete set null,
    sender_name text not null default 'Viandante',
    message text not null,
    is_roll boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.dnd_sessions enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.characters enable row level security;
alter table public.dnd_tokens enable row level security;
alter table public.dnd_chat enable row level security;

drop policy if exists "characters_owner_all" on public.characters;
create policy "characters_owner_all"
on public.characters
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_profiles_owner_all" on public.user_profiles;
create policy "user_profiles_owner_all"
on public.user_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_owner_all" on public.user_preferences;
create policy "user_preferences_owner_all"
on public.user_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "dnd_sessions_owner_all" on public.dnd_sessions;
create policy "dnd_sessions_owner_all"
on public.dnd_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "dnd_tokens_session_owner_all" on public.dnd_tokens;
create policy "dnd_tokens_session_owner_all"
on public.dnd_tokens
for all
using (
    exists (
        select 1 from public.dnd_sessions
        where dnd_sessions.id = dnd_tokens.session_id
        and dnd_sessions.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.dnd_sessions
        where dnd_sessions.id = dnd_tokens.session_id
        and dnd_sessions.user_id = auth.uid()
    )
);

drop policy if exists "dnd_chat_session_owner_all" on public.dnd_chat;
create policy "dnd_chat_session_owner_all"
on public.dnd_chat
for all
using (
    exists (
        select 1 from public.dnd_sessions
        where dnd_sessions.id = dnd_chat.session_id
        and dnd_sessions.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.dnd_sessions
        where dnd_sessions.id = dnd_chat.session_id
        and dnd_sessions.user_id = auth.uid()
    )
);

create index if not exists dnd_sessions_user_id_idx on public.dnd_sessions(user_id);
create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);
create index if not exists dnd_tokens_session_id_idx on public.dnd_tokens(session_id);
create index if not exists dnd_chat_session_id_created_at_idx on public.dnd_chat(session_id, created_at);
create index if not exists characters_user_id_system_id_idx on public.characters(user_id, system_id);

insert into storage.buckets (id, name, public)
values ('vtt_assets', 'vtt_assets', true)
on conflict (id) do update set public = true;

drop policy if exists "vtt_assets_public_read" on storage.objects;
create policy "vtt_assets_public_read"
on storage.objects
for select
using (bucket_id = 'vtt_assets');

drop policy if exists "vtt_assets_owner_write" on storage.objects;
create policy "vtt_assets_owner_write"
on storage.objects
for all
using (bucket_id = 'vtt_assets' and auth.role() = 'authenticated')
with check (bucket_id = 'vtt_assets' and auth.role() = 'authenticated');
