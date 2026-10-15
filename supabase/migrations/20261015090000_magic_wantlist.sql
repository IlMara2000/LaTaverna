create table if not exists public.magic_wantlist_cards (
    user_id uuid not null references auth.users(id) on delete cascade,
    card_id text not null,
    card_name text not null,
    card_data jsonb not null default '{}'::jsonb,
    added_at timestamptz not null default now(),
    primary key (user_id, card_id)
);

alter table public.magic_wantlist_cards enable row level security;

create policy "Users can read their own Magic wantlist"
    on public.magic_wantlist_cards for select
    using (auth.uid() = user_id);

create policy "Users can add to their own Magic wantlist"
    on public.magic_wantlist_cards for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own Magic wantlist"
    on public.magic_wantlist_cards for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can remove from their own Magic wantlist"
    on public.magic_wantlist_cards for delete
    using (auth.uid() = user_id);

grant select, insert, update, delete on public.magic_wantlist_cards to authenticated;
grant select, insert, update, delete on public.magic_wantlist_cards to anon;
