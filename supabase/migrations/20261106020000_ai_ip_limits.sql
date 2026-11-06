-- Limite di richieste AI per rete: protegge il gateway da un singolo indirizzo
-- che apre decine di account ospite. Si conserva solo un HMAC dell'IP (mai
-- l'indirizzo in chiaro) e per non più di 90 giorni, come le quote Oracolo.

create table if not exists private.ai_ip_usage (
    day date not null,
    ip_hash text not null check (char_length(ip_hash) = 64),
    requests integer not null default 0 check (requests >= 0),
    primary key (day, ip_hash)
);

create index if not exists ai_ip_usage_day_idx on private.ai_ip_usage (day);

revoke all on private.ai_ip_usage from public, anon, authenticated;

create or replace function private.take_ai_ip_quota(p_ip_hash text) returns integer
language plpgsql security definer set search_path='' as $$
declare
    v_day date := (now() at time zone 'UTC')::date;
    v_limit integer := 60;
    v_count integer;
begin
    if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'Identificatore di rete non valido.';
    end if;
    -- Serializza solo le richieste della stessa rete: un lock globale qui
    -- rallenterebbe tutti gli utenti per un abuso localizzato.
    perform pg_advisory_xact_lock(hashtext('ai_ip:' || p_ip_hash));
    delete from private.ai_ip_usage where day < v_day - 90;
    select requests into v_count from private.ai_ip_usage where day = v_day and ip_hash = p_ip_hash;
    if coalesce(v_count, 0) >= v_limit then
        raise exception 'Troppe richieste AI da questa rete. Riprova domani.';
    end if;
    insert into private.ai_ip_usage (day, ip_hash, requests) values (v_day, p_ip_hash, 1)
    on conflict (day, ip_hash) do update set requests = private.ai_ip_usage.requests + 1
    returning requests into v_count;
    return v_limit - v_count;
end;
$$;

-- Solo il server (chiave service role) può eseguirla. Se fosse aperta al client,
-- l'IP sarebbe un parametro falsificabile e il limite si aggirerebbe in un giro.
revoke all on function private.take_ai_ip_quota(text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.take_ai_ip_quota(text) to service_role;

create or replace function public.take_ai_ip_quota(p_ip_hash text) returns integer
language sql security invoker set search_path='' as $$
    select private.take_ai_ip_quota(p_ip_hash);
$$;

revoke all on function public.take_ai_ip_quota(text) from public, anon, authenticated;
grant execute on function public.take_ai_ip_quota(text) to service_role;

notify pgrst, 'reload schema';
