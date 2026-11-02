-- Il bucket delle mappe è pubblico per necessità di visualizzazione, ma non
-- deve diventare un hosting generico di file arbitrari.
update storage.buckets
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'vtt_assets';

-- Le policy esistenti continuano a richiedere owner_id = auth.uid().
-- Il vincolo MIME e la dimensione sono applicati dal bucket anche alle
-- richieste dirette all'API Storage, non solo dal client.

-- Le mappe restano leggibili tramite URL pubblico, ma l'elenco dei file
-- altrui non deve essere enumerabile via API Storage.
drop policy if exists vtt_assets_public_read on storage.objects;
drop policy if exists vtt_assets_owner_read on storage.objects;
create policy vtt_assets_owner_read on storage.objects for select to authenticated
    using (bucket_id = 'vtt_assets' and owner_id = (select auth.uid())::text);

notify pgrst, 'reload schema';
