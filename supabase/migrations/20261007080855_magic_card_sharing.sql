create table public.magic_collections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    is_public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.magic_collection_cards (
    collection_id uuid not null references public.magic_collections(id) on delete cascade,
    card_id text not null check (length(card_id) between 1 and 100),
    card_name text not null check (length(btrim(card_name)) between 1 and 120),
    quantity smallint not null check (quantity between 1 and 99),
    card_data jsonb not null check (jsonb_typeof(card_data) = 'object'),
    updated_at timestamptz not null default now(),
    primary key (collection_id, card_id)
);

create table public.magic_decks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (length(btrim(name)) between 1 and 80),
    format text not null default 'commander' check (format in ('commander')),
    commanders jsonb not null default '[]'::jsonb check (jsonb_typeof(commanders) = 'array'),
    is_public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, user_id)
);

create table public.magic_deck_cards (
    deck_id uuid not null references public.magic_decks(id) on delete cascade,
    card_id text not null check (length(card_id) between 1 and 100),
    card_name text not null check (length(btrim(card_name)) between 1 and 120),
    quantity smallint not null check (quantity between 1 and 99),
    card_data jsonb not null check (jsonb_typeof(card_data) = 'object'),
    primary key (deck_id, card_id)
);

create index magic_collection_public_idx on public.magic_collections(id) where is_public;
create index magic_decks_public_idx on public.magic_decks(id) where is_public;
create index magic_decks_owner_idx on public.magic_decks(user_id, updated_at desc);

alter table public.magic_collections enable row level security;
alter table public.magic_collection_cards enable row level security;
alter table public.magic_decks enable row level security;
alter table public.magic_deck_cards enable row level security;

revoke all on public.magic_collections, public.magic_collection_cards, public.magic_decks, public.magic_deck_cards from anon, authenticated;
grant select on public.magic_collections, public.magic_collection_cards, public.magic_decks, public.magic_deck_cards to anon, authenticated;
grant insert, update, delete on public.magic_collections, public.magic_collection_cards, public.magic_decks, public.magic_deck_cards to authenticated;
grant all on public.magic_collections, public.magic_collection_cards, public.magic_decks, public.magic_deck_cards to service_role;

create policy magic_collections_read on public.magic_collections for select to anon, authenticated
    using (is_public or user_id = (select auth.uid()));
create policy magic_collections_insert_own on public.magic_collections for insert to authenticated
    with check (user_id = (select auth.uid()) and not is_public);
create policy magic_collections_update_own on public.magic_collections for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy magic_collections_delete_own on public.magic_collections for delete to authenticated
    using (user_id = (select auth.uid()));

create policy magic_collection_cards_read on public.magic_collection_cards for select to anon, authenticated
    using (exists (
        select 1 from public.magic_collections c
        where c.id = collection_id and (c.is_public or c.user_id = (select auth.uid()))
    ));
create policy magic_collection_cards_insert_own on public.magic_collection_cards for insert to authenticated
    with check (exists (
        select 1 from public.magic_collections c where c.id = collection_id and c.user_id = (select auth.uid())
    ));
create policy magic_collection_cards_update_own on public.magic_collection_cards for update to authenticated
    using (exists (
        select 1 from public.magic_collections c where c.id = collection_id and c.user_id = (select auth.uid())
    )) with check (exists (
        select 1 from public.magic_collections c where c.id = collection_id and c.user_id = (select auth.uid())
    ));
create policy magic_collection_cards_delete_own on public.magic_collection_cards for delete to authenticated
    using (exists (
        select 1 from public.magic_collections c where c.id = collection_id and c.user_id = (select auth.uid())
    ));

create policy magic_decks_read on public.magic_decks for select to anon, authenticated
    using (is_public or user_id = (select auth.uid()));
create policy magic_decks_insert_own on public.magic_decks for insert to authenticated
    with check (user_id = (select auth.uid()) and not is_public);
create policy magic_decks_update_own on public.magic_decks for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy magic_decks_delete_own on public.magic_decks for delete to authenticated
    using (user_id = (select auth.uid()));

create policy magic_deck_cards_read on public.magic_deck_cards for select to anon, authenticated
    using (exists (
        select 1 from public.magic_decks d where d.id = deck_id and (d.is_public or d.user_id = (select auth.uid()))
    ));
create policy magic_deck_cards_insert_own on public.magic_deck_cards for insert to authenticated
    with check (exists (
        select 1 from public.magic_decks d where d.id = deck_id and d.user_id = (select auth.uid())
    ));
create policy magic_deck_cards_update_own on public.magic_deck_cards for update to authenticated
    using (exists (
        select 1 from public.magic_decks d where d.id = deck_id and d.user_id = (select auth.uid())
    )) with check (exists (
        select 1 from public.magic_decks d where d.id = deck_id and d.user_id = (select auth.uid())
    ));
create policy magic_deck_cards_delete_own on public.magic_deck_cards for delete to authenticated
    using (exists (
        select 1 from public.magic_decks d where d.id = deck_id and d.user_id = (select auth.uid())
    ));

notify pgrst, 'reload schema';
