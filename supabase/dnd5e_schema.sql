-- La Taverna - D&D 5e
-- Esegui questo script nel SQL editor Supabase per abilitare la sezione D&D completa.

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

alter table public.characters
    add column if not exists system_id text default 'dnd5e',
    add column if not exists hp integer default 10,
    add column if not exists hp_max integer default 10,
    add column if not exists data jsonb not null default '{}'::jsonb;

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
alter table public.dnd_tokens enable row level security;
alter table public.dnd_chat enable row level security;

create policy "dnd_sessions_owner_all"
on public.dnd_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
create index if not exists dnd_tokens_session_id_idx on public.dnd_tokens(session_id);
create index if not exists dnd_chat_session_id_created_at_idx on public.dnd_chat(session_id, created_at);
