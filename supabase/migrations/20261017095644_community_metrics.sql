-- One participation signal per account/activity/day; no message, URL or card content.
create table public.community_activity (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default ((now() at time zone 'UTC')::date),
 activity text not null check(activity in ('game_started','game_completed','card_saved','reading_opened','rpg_created','oracle_answered')),
 primary key(user_id,day,activity)
);
alter table public.community_activity enable row level security;
revoke all on public.community_activity from anon,authenticated;
grant select,insert on public.community_activity to authenticated;
create policy community_activity_read on public.community_activity for select to authenticated using(user_id=(select auth.uid()));
create policy community_activity_insert on public.community_activity for insert to authenticated
with check(user_id=(select auth.uid()) and day=(now() at time zone 'UTC')::date);
create index community_activity_day on public.community_activity(day);
create function private.community_metrics() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.shop_managers where user_id=auth.uid()) then raise exception 'Accesso riservato alla gestione.'; end if;
 return jsonb_build_object(
 'measured_at',now(),
 'registered_accounts',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
 'guest_accounts',(select count(*) from auth.users where coalesce(is_anonymous,false)),
 'active_30d',(select count(distinct user_id) from public.community_activity where day>=(now() at time zone 'UTC')::date-29),
 'active_7d',(select count(distinct user_id) from public.community_activity where day>=(now() at time zone 'UTC')::date-6),
 'first_activity',(select min(day) from public.community_activity),
 'oracle_requests_today',(select coalesce(sum(requests),0) from private.oracle_daily_usage where day=(now() at time zone 'UTC')::date),
 'activities',(select coalesce(jsonb_object_agg(activity,n),'{}'::jsonb) from (select activity,count(distinct user_id) n from public.community_activity where day>=(now() at time zone 'UTC')::date-29 group by activity) a)
 );
end;
$$;
revoke all on function private.community_metrics() from public,anon;
grant execute on function private.community_metrics() to authenticated;
create function public.community_metrics() returns jsonb language sql security invoker set search_path='' as $$select private.community_metrics();$$;
revoke all on function public.community_metrics() from public,anon;
grant execute on function public.community_metrics() to authenticated;
