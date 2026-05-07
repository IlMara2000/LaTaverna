# La Taverna VTT

La Taverna e una web app Vite per lobby, minigiochi e tavoli D&D 5e con Supabase per autenticazione, profili, personaggi, sessioni, token, chat e storage mappe.

## Requisiti

- Node.js 20+
- Un progetto Supabase
- Anonymous Sign-Ins abilitato se vuoi permettere accesso ospite e salvataggi automatici
- Provider Discord opzionale in Supabase Auth

## Setup locale

1. Installa le dipendenze:

```bash
npm install
```

2. Crea `.env` partendo da `.env.example`:

```bash
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=la-tua-anon-key
```

3. Esegui lo schema Supabase:

Apri `supabase/dnd5e_schema.sql`, incollalo nel SQL Editor di Supabase e premi Run. Lo script crea le tabelle `dnd_sessions`, `characters`, `dnd_tokens`, `dnd_chat`, `user_profiles`, `user_preferences` e il bucket pubblico `vtt_assets`.

4. Avvia l'app:

```bash
npm run dev
```

Vite usa `http://localhost:3000` con `strictPort: true`.

## Funzioni principali

- Login email/password, registrazione, Discord OAuth e accesso ospite via Supabase.
- Profilo utente con avatar, titolo, conteggio personaggi e sessioni.
- Impostazioni profilo con tema accento, glow e card compatte.
- Minigiochi: Briscola, Solo, Impostore, Burraco, Scacchi e Numeri.
- D&D 5e: manuali PDF, personaggi completi, sessioni, upload mappa, token drag-and-drop, iniziativa, dadi, note live e chat.
- Libreria musicale con playlist tematiche e upload file audio locale.

## Comandi

```bash
npm run dev
npm run build
npm run preview
```

`npm run lint` e al momento un placeholder del progetto.
