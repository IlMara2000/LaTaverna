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
- D&D 5e: Biblioteca dei Manuali con ricerca OCR, filtri per parte/capitolo/argomento, sintesi AI basata sulle fonti, lettore pagina per pagina, personaggi e sessioni.
- AI di sessione: bot testuale in chat, attivabile con `@oste` o dal pannello AI del tavolo, servito da function Vercel e Groq.
- Libreria musicale con playlist tematiche e upload file audio locale.
- Lettura: upload di PDF privati, consenso esplicito alla pubblicazione in Bacheca, elenco alfabetico con ricerca per titolo/autore, lettore PDF, preferiti e raccolte salvati per account.

## Sezione Lettura

La voce **Lettura** è disponibile nella home e nel menu laterale. Per un nuovo ambiente applica anche `supabase/migrations/20260916102901_reading_library.sql` dopo lo schema iniziale (sul progetto LaTaverna è già stata applicata).

- Ogni PDF (massimo 50 MB) viene salvato nel bucket privato `reading_books`. Il titolo viene suggerito dal nome del file ed è modificabile prima dell'upload; l'autore è facoltativo.
- Solo dopo il completamento dell'upload compare il popup. La casella è inizialmente vuota: chiudere il popup o confermare senza spunta lascia il libro privato. Con la spunta il libro viene indicizzato automaticamente nella bacheca, in ordine alfabetico italiano.
- La ricerca per titolo/autore e la paginazione vengono eseguite sul database. Non viene estratto o indicizzato il testo interno del PDF.
- Preferiti, nomi delle raccolte e appartenenza dei libri alle raccolte sono protetti da RLS e salvati per account. Una raccolta può essere rinominata o eliminata senza cancellare i libri.
- Il proprietario può rendere nuovamente privato un libro. Ogni apertura verifica nuovamente i permessi nel database; i libri revocati non sono più visibili nelle liste degli altri utenti. Le copie già aperte/scaricate e le risposte già autorizzate in cache non sono richiamabili.
- Gli account ospite Supabase hanno dati separati, legati al loro accesso temporaneo. Gli ospiti locali senza autenticazione possono solo consultare la bacheca.

Verifica locale: `node --test scripts/tests/reading.test.mjs`. Verifica d'integrazione facoltativa: `node scripts/verify-reading-live.mjs --confirm-live` (crea due account ospite temporanei e rimuove i libri di prova; al termine stampa gli ID degli account da eliminare tramite amministrazione).

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
```

L'applicazione distribuita usa solo i JSON generati e non richiede OCR lato server o lato browser.
