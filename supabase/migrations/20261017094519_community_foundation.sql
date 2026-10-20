-- Existing orders remain immutable. Retire the previous public assortment.
update public.shop_products set status='draft', updated_at=now()
where id in ('bruno-antico','spirale-chiara','ametista-regale','ossidiana-corvo');

create table public.tcg_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check(game in ('pokemon','yugioh','onepiece')),
 name text not null check(length(trim(name)) between 1 and 160),
 set_name text not null default '' check(length(set_name)<=160),
 card_number text not null default '' check(length(card_number)<=80),
 language text not null default 'it' check(length(language)<=20),
 quantity integer not null default 1 check(quantity between 1 and 999),
 created_at timestamptz not null default now()
);
alter table public.tcg_cards enable row level security;
revoke all on public.tcg_cards from anon, authenticated;
grant select,insert,update,delete on public.tcg_cards to authenticated;
create index tcg_cards_owner_game on public.tcg_cards(user_id,game);
create policy tcg_cards_owner on public.tcg_cards for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- No prompts, images or chat content are stored in the usage ledger.
create schema if not exists private;
create table private.oracle_daily_usage (
 day date not null, user_id uuid not null references auth.users(id) on delete cascade,
 requests integer not null default 0, primary key(day,user_id)
);
alter table private.oracle_daily_usage enable row level security;
revoke all on private.oracle_daily_usage from public,anon,authenticated;
create function private.take_oracle_quota() returns integer
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid();
 v_day date := (now() at time zone 'UTC')::date;
 v_limit integer := case when coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then 5 else 30 end;
 v_count integer;
begin
 if v_user is null then raise exception 'Accedi per usare l’Oracolo.'; end if;
 perform pg_advisory_xact_lock(781739241);
 select requests into v_count from private.oracle_daily_usage where day=v_day and user_id=v_user;
 if coalesce(v_count,0)>=v_limit then raise exception 'Quota giornaliera Oracolo esaurita. Riprova domani.'; end if;
 if (select coalesce(sum(requests),0) from private.oracle_daily_usage where day=v_day)>=300 then
 raise exception 'L’Oracolo ha raggiunto il limite giornaliero della Taverna. Riprova domani.'; end if;
 insert into private.oracle_daily_usage(day,user_id,requests) values(v_day,v_user,1)
 on conflict(day,user_id) do update set requests=private.oracle_daily_usage.requests+1
 returning requests into v_count;
 return v_limit-v_count;
end;
$$;
revoke all on function private.take_oracle_quota() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.take_oracle_quota() to authenticated;
create function public.take_oracle_quota() returns integer language sql security invoker set search_path='' as $$
 select private.take_oracle_quota();
$$;
revoke all on function public.take_oracle_quota() from public,anon;
grant execute on function public.take_oracle_quota() to authenticated;
