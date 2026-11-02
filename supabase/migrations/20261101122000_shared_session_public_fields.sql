-- Gli invitati via link devono ricevere solo i campi del tavolo, non le note
-- private del Master (live_notes, recap, agganci, PNG, tesori, outline).
-- La lettura diretta della tabella e il realtime espongono l'intera riga:
-- gli invitati passano quindi esclusivamente dalla RPC filtrata qui sotto.
drop policy if exists "dnd_sessions_guest_read" on public.dnd_sessions;
create or replace function public.get_shared_dnd_session(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    s public.dnd_sessions%rowtype;
begin
    if not public.is_dnd_session_guest(p_session_id) then
        return null;
    end if;

    select * into s from public.dnd_sessions where id = p_session_id;
    if not found then
        return null;
    end if;

    return jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'system_id', s.system_id,
        'name', s.name,
        'status', s.status,
        'party_level', s.party_level,
        'next_date', s.next_date,
        'map_url', s.map_url,
        'description', s.description,
        'data', (
            select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
            from jsonb_each(coalesce(s.data, '{}'::jsonb))
            where key in (
                'party_name', 'location', 'scene', 'public_summary', 'objective_done',
                'initiative', 'round', 'turnCount', 'timeOfDay', 'fogEnabled',
                'weather', 'gridVisible', 'map_grid_size', 'mapUrl'
            )
        )
    );
end;
$$;

revoke all on function public.get_shared_dnd_session(uuid) from public, anon;
grant execute on function public.get_shared_dnd_session(uuid) to authenticated;

notify pgrst, 'reload schema';
