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
GROQ_LLM_API_KEY=la-tua-key-groq-server
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
- D&D 5e e Pathfinder 2e: Biblioteca dei Manuali con ricerca OCR, filtri per parte/capitolo/argomento, sintesi AI basata sulle fonti, lettore pagina per pagina, personaggi e sessioni.
- AI di sessione: bot testuale in chat, attivabile con `@oste` o dal pannello AI del tavolo, servito da function Vercel e Groq.
- Libreria musicale con playlist tematiche e upload file audio locale.

## Variabili Vercel

Per le function AI configura su Vercel Project Settings:

```bash
GROQ_LLM_API_KEY=...
GROQ_LLM_MODEL=llama-3.3-70b-versatile
GROQ_LLM_TEMPERATURE=0.75
GROQ_LLM_MAX_TOKENS=420
```

Non usare chiavi Groq con prefisso `VITE_` in produzione: le variabili `VITE_*` vengono incluse nel bundle browser.

## Comandi

```bash
npm run dev
npm run build
npm run preview
npm run index:manuals
```

`npm run lint` e al momento un placeholder del progetto.

## Indice dei manuali

I PDF sono scansioni, quindi la ricerca usa indici OCR statici in `public/manual-index/`. Quando aggiungi o sostituisci pagine, rigenera gli indici su macOS con Swift, Vision e PDFKit:

```bash
npm run index:manuals:dnd
npm run index:manuals:pathfinder
```

L'applicazione distribuita usa solo i JSON generati e non richiede OCR lato server o lato browser.
