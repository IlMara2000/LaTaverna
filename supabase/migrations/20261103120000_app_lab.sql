-- APP LAB: libreria APK privata, sessioni Android remote, progetti di porting iOS.
-- Gli APK non vengono mai eseguiti su Vercel: qui restano solo metadati, file privati
-- e il registro delle sessioni gestite da un gateway esterno.

create table public.app_lab_apps (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(btrim(name)) between 1 and 120),
    package_name text not null check (char_length(package_name) between 1 and 200),
    version_name text not null default '' check (char_length(version_name) <= 80),
    version_code bigint check (version_code is null or version_code >= 0),
    platform text not null default 'android' check (platform in ('android')),
    original_name text not null check (char_length(original_name) between 1 and 255),
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 209715200),
    min_sdk integer check (min_sdk is null or min_sdk between 1 and 100),
    target_sdk integer check (target_sdk is null or target_sdk between 1 and 100),
    architectures text[] not null default '{}',
    icon_data_url text check (icon_data_url is null or char_length(icon_data_url) <= 120000),
    compatibility text not null default 'pending' check (compatibility in ('pending', 'ready', 'limited', 'blocked')),
    status text not null default 'analyzing' check (status in ('analyzing', 'ready', 'failed', 'archived')),
    analysis jsonb not null default '{}'::jsonb,
    storage_path text not null unique,
    rights_confirmed_at timestamptz,
    last_launched_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index app_lab_apps_owner_package_idx on public.app_lab_apps(owner_id, lower(package_name));
create index app_lab_apps_owner_updated_idx on public.app_lab_apps(owner_id, updated_at desc);

create table public.app_lab_sessions (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.app_lab_apps(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    provider text not null default 'applab-gateway' check (char_length(provider) <= 60),
    provider_session_id text check (provider_session_id is null or char_length(provider_session_id) <= 200),
    status text not null default 'requested' check (status in ('requested', 'running', 'stopped', 'expired', 'failed')),
    started_at timestamptz,
    ended_at timestamptz,
    expires_at timestamptz,
    resource_limits jsonb not null default '{}'::jsonb,
    error_code text check (error_code is null or char_length(error_code) <= 80),
    created_at timestamptz not null default now()
);

create index app_lab_sessions_owner_status_idx on public.app_lab_sessions(owner_id, status, created_at desc);
create index app_lab_sessions_app_idx on public.app_lab_sessions(app_id);

create table public.app_lab_porting_projects (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references public.app_lab_apps(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,
    mode text not null check (mode in ('apk_only', 'source')),
    framework text not null default 'unknown' check (char_length(framework) <= 40),
    status text not null default 'analysis' check (status in (
        'analysis', 'source_uploaded', 'queued', 'building', 'build_failed', 'ipa_ready', 'not_feasible'
    )),
    feasibility text not null default 'unknown' check (feasibility in ('high', 'medium', 'low', 'very_low', 'unknown')),
    report jsonb not null default '{}'::jsonb,
    source_path text check (source_path is null or char_length(source_path) <= 400),
    ipa_path text check (ipa_path is null or char_length(ipa_path) <= 400),
    ipa_size_bytes bigint check (ipa_size_bytes is null or ipa_size_bytes > 0),
    build_job_id text check (build_job_id is null or char_length(build_job_id) <= 200),
    error_code text check (error_code is null or char_length(error_code) <= 80),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index app_lab_porting_owner_idx on public.app_lab_porting_projects(owner_id, created_at desc);
create index app_lab_porting_app_idx on public.app_lab_porting_projects(app_id);

alter table public.app_lab_apps enable row level security;
alter table public.app_lab_sessions enable row level security;
alter table public.app_lab_porting_projects enable row level security;

revoke all on public.app_lab_apps, public.app_lab_sessions, public.app_lab_porting_projects from anon, authenticated;
grant select, insert, update, delete on public.app_lab_apps to authenticated;
grant select, insert, update on public.app_lab_sessions to authenticated;
grant select, insert, update, delete on public.app_lab_porting_projects to authenticated;
grant all on public.app_lab_apps, public.app_lab_sessions, public.app_lab_porting_projects to service_role;

create policy app_lab_apps_read on public.app_lab_apps for select to authenticated
    using (owner_id = (select auth.uid()));
create policy app_lab_apps_insert on public.app_lab_apps for insert to authenticated
    with check (owner_id = (select auth.uid()) and rights_confirmed_at is not null and status = 'ready');
create policy app_lab_apps_update on public.app_lab_apps for update to authenticated
    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy app_lab_apps_delete on public.app_lab_apps for delete to authenticated
    using (owner_id = (select auth.uid()));

create policy app_lab_sessions_read on public.app_lab_sessions for select to authenticated
    using (owner_id = (select auth.uid()));
create policy app_lab_sessions_insert on public.app_lab_sessions for insert to authenticated
    with check (owner_id = (select auth.uid())
        and exists (select 1 from public.app_lab_apps a where a.id = app_id and a.owner_id = (select auth.uid())));
create policy app_lab_sessions_update on public.app_lab_sessions for update to authenticated
    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy app_lab_porting_read on public.app_lab_porting_projects for select to authenticated
    using (owner_id = (select auth.uid()));
create policy app_lab_porting_insert on public.app_lab_porting_projects for insert to authenticated
    with check (owner_id = (select auth.uid())
        and exists (select 1 from public.app_lab_apps a where a.id = app_id and a.owner_id = (select auth.uid())));
create policy app_lab_porting_update on public.app_lab_porting_projects for update to authenticated
    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy app_lab_porting_delete on public.app_lab_porting_projects for delete to authenticated
    using (owner_id = (select auth.uid()));

-- Storage privato: APK originali, archivi sorgente, IPA prodotti da build firmate.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('app_lab_apks', 'app_lab_apks', false, 209715200, array['application/vnd.android.package-archive', 'application/octet-stream']),
    ('app_lab_sources', 'app_lab_sources', false, 524288000, array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
    ('app_lab_builds', 'app_lab_builds', false, 524288000, array['application/octet-stream']);

create policy app_lab_apk_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'app_lab_apks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-[0-9]+)?\.apk$');
create policy app_lab_apk_read on storage.objects for select to authenticated
    using (bucket_id = 'app_lab_apks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy app_lab_apk_delete on storage.objects for delete to authenticated
    using (bucket_id = 'app_lab_apks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy app_lab_source_upload on storage.objects for insert to authenticated
    with check (bucket_id = 'app_lab_sources'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and name ~ '^[0-9a-f-]{36}/sources/[0-9a-f-]{36}\.zip$');
create policy app_lab_source_read on storage.objects for select to authenticated
    using (bucket_id = 'app_lab_sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy app_lab_source_delete on storage.objects for delete to authenticated
    using (bucket_id = 'app_lab_sources' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy app_lab_build_read on storage.objects for select to authenticated
    using (bucket_id = 'app_lab_builds' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
