-- Pubblicazione consapevole: nessun libro può essere pubblico senza una
-- dichiarazione esplicita dei diritti registrata lato database.
alter table public.reading_books
    add column if not exists rights_confirmed_at timestamptz;

-- Le pubblicazioni precedenti non hanno una dichiarazione: tornano private.
update public.reading_books
set is_public = false
where is_public and rights_confirmed_at is null;

alter table public.reading_books
    drop constraint if exists reading_books_public_rights;
alter table public.reading_books
    add constraint reading_books_public_rights
    check (not is_public or rights_confirmed_at is not null);

grant update (rights_confirmed_at) on public.reading_books to authenticated;

-- Limite anti-abuso per account: 100 libri e 1 GB di metadati dichiarati.
create or replace function private.reading_within_quota()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(count(*), 0) < 100
       and coalesce(sum(size_bytes), 0) < 1073741824
    from public.reading_books
    where owner_id = (select auth.uid());
$$;

revoke all on function private.reading_within_quota() from public, anon;
grant execute on function private.reading_within_quota() to authenticated;

drop policy if exists reading_books_insert_private on public.reading_books;
create policy reading_books_insert_private on public.reading_books for insert to authenticated
    with check (owner_id = (select auth.uid()) and not is_public and private.reading_within_quota());

notify pgrst, 'reload schema';
