begin;
insert into auth.users(id) values('a7b15ea0-953d-4cbb-a081-42b87c69b111'),('a7b15ea0-953d-4cbb-a081-42b87c69b222');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a7b15ea0-953d-4cbb-a081-42b87c69b111","role":"authenticated","is_anonymous":true}',true);
insert into public.tcg_cards(user_id,game,name) values('a7b15ea0-953d-4cbb-a081-42b87c69b111','onepiece','Test owner card');
do $$ begin
 if (select count(*) from public.tcg_cards)<>1 then raise exception 'owner visibility failed'; end if;
 begin
 update public.tcg_cards set user_id='a7b15ea0-953d-4cbb-a081-42b87c69b222';
 raise exception 'ownership reassignment allowed';
 exception when insufficient_privilege then null;
 end;
 perform public.take_oracle_quota(); perform public.take_oracle_quota(); perform public.take_oracle_quota(); perform public.take_oracle_quota();
 if public.take_oracle_quota()<>0 then raise exception 'quota counter failed'; end if;
 begin
 perform public.take_oracle_quota(); raise exception 'quota exceeded without failure';
 exception when raise_exception then
 if sqlerrm not like 'Quota giornaliera%' then raise; end if;
 end;
end $$;
insert into public.community_activity(user_id,activity) values('a7b15ea0-953d-4cbb-a081-42b87c69b111','game_started');
do $$ begin
 begin
 perform public.community_metrics(); raise exception 'nonmanager can read metrics';
 exception when raise_exception then
 if sqlerrm <> 'Accesso riservato alla gestione.' then raise; end if;
 end;
 begin
 insert into public.community_activity(user_id,day,activity) values('a7b15ea0-953d-4cbb-a081-42b87c69b111',current_date-2,'game_started');
 raise exception 'past activity allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"a7b15ea0-953d-4cbb-a081-42b87c69b222","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 if exists(select 1 from public.community_activity) then raise exception 'foreign activity visible'; end if;
 if exists(select 1 from public.tcg_cards) then raise exception 'foreign cards visible'; end if;
 begin
 insert into public.tcg_cards(user_id,game,name) values('a7b15ea0-953d-4cbb-a081-42b87c69b111','pokemon','Foreign insert');
 raise exception 'foreign insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
