-- I conteggi delle quote AI non devono essere conservati più a lungo del
-- necessario: l'informativa privacy indica un massimo di 90 giorni.
create or replace function private.take_oracle_quota() returns integer
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid();
 v_day date := (now() at time zone 'UTC')::date;
 v_limit integer := case when coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then 5 else 30 end;
 v_count integer;
begin
 if v_user is null then raise exception 'Accedi per usare l’Oracolo.'; end if;
 perform pg_advisory_xact_lock(781739241);
 delete from private.oracle_daily_usage where day < v_day - 90;
 select requests into v_count from private.oracle_daily_usage where day=v_day and user_id=v_user;
 if coalesce(v_count,0)>=v_limit then raise exception 'Quota giornaliera Oracolo esaurita. Riprova domani.'; end if;
 if (select coalesce(sum(requests),0) from private.oracle_daily_usage where day=v_day)>=300 then
  raise exception 'L’Oracolo ha raggiunto il limite giornaliero della Taverna. Riprova domani.';
 end if;
 insert into private.oracle_daily_usage(day,user_id,requests) values(v_day,v_user,1)
 on conflict(day,user_id) do update set requests=private.oracle_daily_usage.requests+1
 returning requests into v_count;
 return v_limit-v_count;
end;
$$;
revoke all on function private.take_oracle_quota() from public,anon;
grant execute on function private.take_oracle_quota() to authenticated;

notify pgrst, 'reload schema';
