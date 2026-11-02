-- Gli ordini possono essere conservati come documenti contabili anche dopo
-- la cancellazione dell'account, ma non devono bloccare l'esercizio del
-- diritto alla cancellazione.
alter table public.shop_orders alter column user_id drop not null;
alter table public.shop_orders drop constraint if exists shop_orders_user_id_fkey;
alter table public.shop_orders
    add constraint shop_orders_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Accedi per eliminare l’account.';
    end if;

    -- Le foreign key con on delete cascade rimuovono profilo, giochi,
    -- biblioteca, collezioni e stanze. Gli ordini restano come documenti
    -- contabili con user_id nullo.
    delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
