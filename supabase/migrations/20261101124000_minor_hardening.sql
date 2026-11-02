-- Hardening minore: niente DML anon sulla wantlist, nomi ospite limitati,
-- e nessuna indicizzazione dei vecchi percorsi dei manuali.

revoke all on public.magic_wantlist_cards from anon;
grant select, insert, update, delete on public.magic_wantlist_cards to authenticated;

alter table public.dnd_session_guests
    drop constraint if exists dnd_session_guests_display_name_length;
alter table public.dnd_session_guests
    add constraint dnd_session_guests_display_name_length
    check (char_length(display_name) between 1 and 80);

create or replace function public.join_dnd_session(
    p_session_id uuid,
    p_share_code text,
    p_display_name text default 'Giocatore'
)
returns table(session_id uuid, system_id text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_session public.dnd_sessions%rowtype;
begin
    if v_user_id is null then
        raise exception 'Utente Supabase non autenticato.';
    end if;

    select *
    into v_session
    from public.dnd_sessions
    where id = p_session_id
      and share_enabled = true
      and share_code = p_share_code;

    if not found then
        raise exception 'Invito sessione non valido o disattivato.';
    end if;

    insert into public.dnd_session_guests(session_id, user_id, display_name, role, last_seen)
    values (
        v_session.id,
        v_user_id,
        left(coalesce(nullif(trim(p_display_name), ''), 'Giocatore'), 80),
        'viewer',
        now()
    )
    on conflict on constraint dnd_session_guests_session_id_user_id_key
    do update set
        display_name = excluded.display_name,
        last_seen = now();

    return query select v_session.id, v_session.system_id, 'viewer'::text;
end;
$$;

revoke all on function public.join_dnd_session(uuid, text, text) from public, anon;
grant execute on function public.join_dnd_session(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
