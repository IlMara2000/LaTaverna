-- Limiti dell'aggiornamento prezzi configurabili per ambiente.
--
-- I valori arrivano dall'handler (variabili PRICE_REFRESH_PAUSE_SECONDS,
-- PRICE_REFRESH_USER_HOURLY_LIMIT, PRICE_REFRESH_IP_HOURLY_LIMIT), ma la
-- funzione li riporta comunque nella scala ammessa: una configurazione
-- sbagliata non può azzerare la protezione contro gli abusi verso Scryfall.
-- I parametri hanno un valore predefinito, quindi una chiamata con i soli
-- p_user e p_ip_hash continua a comportarsi come prima.

drop function if exists public.take_price_refresh_quota(uuid, text);
drop function if exists private.take_price_refresh_quota(uuid, text);

create or replace function private.take_price_refresh_quota(
  p_user uuid,
  p_ip_hash text,
  p_pause_seconds integer default 30,
  p_user_limit integer default 10,
  p_ip_limit integer default 30
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_wait_seconds integer;
  v_last timestamptz;
  v_user_hour integer;
  v_ip_hour integer;
  v_max_user integer;
  v_max_ip integer;
  v_pause interval;
begin
  if p_user is null then
    raise exception 'Utente non valido per l’aggiornamento prezzi.';
  end if;
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Identificatore di rete non valido.';
  end if;

  -- Difesa in profondità: valori assenti o fuori misura restano nella scala
  -- ammessa anche se il chiamante non li avesse già limitati.
  v_max_user := least(greatest(coalesce(p_user_limit, 10), 1), 1000);
  v_max_ip := least(greatest(coalesce(p_ip_limit, 30), 1), 10000);
  v_pause := make_interval(secs => least(greatest(coalesce(p_pause_seconds, 30), 0), 3600));

  perform pg_advisory_xact_lock(hashtext('price_refresh:' || p_user::text));

  delete from private.price_refresh_log where created_at < now() - interval '1 day';

  if v_pause > interval '0' then
    select max(created_at) into v_last
      from private.price_refresh_log
     where user_id = p_user;

    if v_last is not null and v_last > now() - v_pause then
      v_wait_seconds := greatest(1, ceil(extract(epoch from (v_last + v_pause - now())))::integer);
      raise exception 'Hai appena aggiornato i prezzi: attendi % secondi.', v_wait_seconds;
    end if;
  end if;

  select count(*) into v_user_hour
    from private.price_refresh_log
   where user_id = p_user and created_at > now() - interval '1 hour';

  if v_user_hour >= v_max_user then
    raise exception 'Troppi aggiornamenti prezzi in un’ora: riprova più tardi.';
  end if;

  select count(*) into v_ip_hour
    from private.price_refresh_log
   where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';

  if v_ip_hour >= v_max_ip then
    raise exception 'Troppe richieste di aggiornamento prezzi da questa rete.';
  end if;

  insert into private.price_refresh_log (user_id, ip_hash) values (p_user, p_ip_hash);

  return v_max_user - v_user_hour - 1;
end;
$$;

revoke all on function private.take_price_refresh_quota(uuid, text, integer, integer, integer)
  from public, anon, authenticated;

create or replace function public.take_price_refresh_quota(
  p_user uuid,
  p_ip_hash text,
  p_pause_seconds integer default 30,
  p_user_limit integer default 10,
  p_ip_limit integer default 30
)
returns integer
language sql
security definer
set search_path to ''
as $$
  select private.take_price_refresh_quota(p_user, p_ip_hash, p_pause_seconds, p_user_limit, p_ip_limit);
$$;

-- Come per il budget AI: chi ha la chiave anon potrebbe altrimenti passare
-- limiti enormi e aggirare il tetto. La funzione resta solo per service_role.
revoke all on function public.take_price_refresh_quota(uuid, text, integer, integer, integer) from public;
revoke all on function public.take_price_refresh_quota(uuid, text, integer, integer, integer) from anon;
revoke all on function public.take_price_refresh_quota(uuid, text, integer, integer, integer) from authenticated;
grant execute on function public.take_price_refresh_quota(uuid, text, integer, integer, integer) to service_role;
