# Avvio e collegamento Supabase

## 1. Variabili ambiente

Crea `.env` nella root:

```bash
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=la-tua-anon-key
```

Dopo ogni modifica al file `.env`, riavvia `npm run dev`.

## 2. Database e storage

Nel progetto Supabase apri SQL Editor ed esegui:

```sql
-- contenuto di supabase/dnd5e_schema.sql
```

Lo schema crea:

- `user_profiles` per profilo e aspetto utente.
- `user_preferences` per preferenze persistenti come la musica.
- `characters` per le schede D&D 5e.
- `dnd_sessions` per campagne e tavoli live.
- `dnd_tokens` per token sulla mappa.
- `dnd_chat` per chat e log tiri.
- bucket storage pubblico `vtt_assets` per mappe e asset.

## 3. Auth

In Supabase Auth abilita:

- Email/Password per login classico e registrazione.
- Anonymous Sign-Ins per ospiti e fallback automatico delle sezioni D&D.
- Discord OAuth se vuoi usare il pulsante Discord.

Per Discord, configura nel provider Supabase il Client ID e Client Secret della tua app Discord. Come redirect URL usa l'URL indicato da Supabase Auth per il provider Discord.

## 4. Avvio locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`.

## 5. Build

```bash
npm run build
npm run preview
```

La build produce `dist/`.

## 6. Deploy

Per Vercel o hosting statico:

- Build command: `npm run build`
- Output directory: `dist`
- Variabili ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Se usi Discord OAuth in produzione, aggiungi anche il dominio finale tra gli URL autorizzati in Supabase Auth e nella Discord Developer Console.
