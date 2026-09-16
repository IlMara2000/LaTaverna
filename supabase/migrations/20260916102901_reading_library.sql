-- Reading library: files are private by default, even before metadata is saved.
create table public.reading_books (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text collate "it-x-icu" not null check (char_length(btrim(title)) between 1 and 200),
    author text not null default '' check (char_length(author) <= 160),
    original_name text not null check (char_length(original_name) between 1 and 255),
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
    storage_path text generated always as (owner_id::text || '/' || id::text || '.pdf') stored unique,
    search_text text generated always as (title || ' ' || author) stored,
    is_public boolean not null default false,
    created_at timestamptz not null default now()
);

create table public.reading_favorites (
    user_id uuid not null references auth.users(id) on delete cascade,
    book_id uuid not null references public.reading_books(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, book_id)
);

create table public.reading_collections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text collate "it-x-icu" not null check (char_length(btrim(name)) between 1 and 80),
    created_at timestamptz not null default now(),
    unique (id, user_id)
);

create unique index reading_collections_name_idx on public.reading_collections(user_id, lower(btrim(name)));

create table public.reading_collection_books (
    collection_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    book_id uuid not null references public.reading_books(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (collection_id, book_id),
    foreign key (collection_id, user_id) references public.reading_collections(id, user_id) on delete cascade
);

create index reading_books_owner_title_idx on public.reading_books(owner_id, title, id);
create index reading_books_board_title_idx on public.reading_books(title, id) where is_public;
create index reading_favorites_book_idx on public.reading_favorites(book_id);
create index reading_collection_books_user_idx on public.reading_collection_books(user_id);
create index reading_collection_books_book_idx on public.reading_collection_books(book_id);
create index reading_collection_books_owner_idx on public.reading_collection_books(collection_id, user_id);

alter table public.reading_books enable row level security;
alter table public.reading_favorites enable row level security;
alter table public.reading_collections enable row level security;
alter table public.reading_collection_books enable row level security;

-- Explicit grants also support projects without automatic Data API privileges.
revoke all on public.reading_books, public.reading_favorites, public.reading_collections, public.reading_collection_books from anon, authenticated;
grant select on public.reading_books to anon, authenticated;
grant insert, delete on public.reading_books to authenticated;
grant update (title, author, is_public) on public.reading_books to authenticated;
grant select, insert, update, delete on public.reading_favorites, public.reading_collections, public.reading_collection_books to authenticated;
grant all on public.reading_books, public.reading_favorites, public.reading_collections, public.reading_collection_books to service_role;

create policy reading_books_read on public.reading_books for select to anon, authenticated
    using (is_public or owner_id = (select auth.uid()));
create policy reading_books_insert_private on public.reading_books for insert to authenticated
    with check (owner_id = (select auth.uid()) and not is_public);
create policy reading_books_update_own on public.reading_books for update to authenticated
    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy reading_books_delete_own on public.reading_books for delete to authenticated
    using (owner_id = (select auth.uid()));

create policy reading_favorites_read on public.reading_favorites for select to authenticated
    using (user_id = (select auth.uid()));
create policy reading_favorites_insert on public.reading_favorites for insert to authenticated
    with check (user_id = (select auth.uid()) and exists (select 1 from public.reading_books b where b.id = book_id));
create policy reading_favorites_update on public.reading_favorites for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and exists (select 1 from public.reading_books b where b.id = book_id));
create policy reading_favorites_delete on public.reading_favorites for delete to authenticated
    using (user_id = (select auth.uid()));

create policy reading_collections_read on public.reading_collections for select to authenticated
    using (user_id = (select auth.uid()));
create policy reading_collections_insert on public.reading_collections for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy reading_collections_update on public.reading_collections for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reading_collections_delete on public.reading_collections for delete to authenticated
    using (user_id = (select auth.uid()));

create policy reading_collection_books_read on public.reading_collection_books for select to authenticated
    using (user_id = (select auth.uid()));
create policy reading_collection_books_insert on public.reading_collection_books for insert to authenticated
    with check (user_id = (select auth.uid()) and exists (select 1 from public.reading_books b where b.id = book_id));
create policy reading_collection_books_update on public.reading_collection_books for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and exists (select 1 from public.reading_books b where b.id = book_id));
create policy reading_collection_books_delete on public.reading_collection_books for delete to authenticated
    using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reading_books', 'reading_books', false, 52428800, array['application/pdf']);

create policy reading_files_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'reading_books'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$');
create policy reading_files_read on storage.objects for select to anon, authenticated
    using (bucket_id = 'reading_books' and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or exists (select 1 from public.reading_books b where b.storage_path = name and b.is_public)
    ));
create policy reading_files_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'reading_books' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: a shared file cannot be silently replaced after consent.
notify pgrst, 'reload schema';
