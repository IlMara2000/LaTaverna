# La Taverna VTT

La visione di prodotto, le decisioni del fondatore e la roadmap proposta sono raccolte nella [Mente della Taverna](docs/mente-della-taverna.md) (briefing del 17 ottobre 2026). Il documento distingue la direzione futura dalle funzionalità già implementate descritte qui sotto.

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
- Minigiochi: Briscola, Scopa, Solitario, Solo, Impostore, Burraco, Scacchi, Numeri, Tic Tac Toe e Blocchi Arcani.
- Briscola e Scopa usano 40 carte da poker: A, 2, 3, 4, 5, 6, 7, J, Q, K di cuori, quadri, fiori e picche. Nella Scopa i quadri sostituiscono i denari e il settebello è il 7 di quadri.
- Solitario Klondike con mazzo da poker completo di 52 carte e pesca di una carta alla volta.
- D&D 5e: personaggi, sessioni, dadi, token, mappe e strumenti del tavolo. Non distribuiamo copie non autorizzate di manuali; la Biblioteca personale accetta solo PDF caricati dall'utente con dichiarazione dei diritti, mentre la Bacheca pubblica resta riservata a opere autorizzate.
- AI di sessione: bot testuale in chat, attivabile con `@oracolo` (anche `@oste`) o dal pannello Oracolo del tavolo, servito da function Vercel e Groq.
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

## APP LAB

La voce **APP LAB** (`/app-lab`, sidebar e dock della home) è la sezione per caricare APK, analizzarli, conservarli in una libreria privata e avviarli in un ambiente Android remoto. Non modifica le altre sezioni.

- L'analisi avviene nel browser: ZIP, `AndroidManifest.xml` binario (AXML), `resources.arsc`, icona, permessi, SDK, ABI, firma e framework. Nessun APK viene eseguito su Vercel.
- Gli APK finiscono nel bucket privato `app_lab_apks` (max 200 MB); metadati, sessioni e progetti di porting stanno nelle tabelle `app_lab_*` con RLS per utente. Applica `supabase/migrations/20261103120000_app_lab.sql` su un nuovo ambiente.
- `AVVIA` richiede un gateway Android esterno con WebRTC (`APP_LAB_RUNTIME_URL`, `APP_LAB_RUNTIME_TOKEN`). Senza queste variabili la sezione lo dichiara e non simula sessioni.
- `PORTING iOS` distingue APK-only (mai convertibile in `.ipa`) e progetto sorgente (framework riconosciuto, fattibilità, coda di build). La build richiede un servizio macOS con Xcode (`APP_LAB_BUILD_SERVICE_URL`, `APP_LAB_BUILD_SERVICE_TOKEN`). Un `.ipa` compare solo dopo una build firmata riuscita.
- Dettagli, contratti dei servizi esterni, sicurezza e checklist di test: [docs/app-lab.md](docs/app-lab.md).

Verifica: `npm run test:cards` (include `scripts/tests/applab.test.mjs`).

## Variabili Vercel

Per le function AI configura su Vercel Project Settings:

```bash
GROQ_LLM_API_KEY=...
GROQ_LLM_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
GROQ_LLM_TEMPERATURE=0.75
GROQ_LLM_MAX_TOKENS=420
```

Non usare chiavi Groq con prefisso `VITE_` in produzione: le variabili `VITE_*` vengono incluse nel bundle browser.

## Documenti legali

Le pagine `/privacy`, `/termini`, `/cookie`, `/community`, `/bottega/condizioni` e `/segnala` sono generate da `src/data/legal.js` e `src/components/features/legal/Legal.js`. Prima del lancio sostituisci i segnaposto del titolare (ragione sociale, indirizzo, P.IVA, PEC) e fai validare i testi da un legale/DPO. L'avviso in pagina compare solo in sviluppo; la build di produzione non lo espone, ma i dati vanno comunque completati.

Il checkout della Bottega richiede l'accettazione delle condizioni di vendita e l'informativa privacy. La registrazione richiede Termini, privacy e conferma dell'età minima di 14 anni. L'email di contatto per gli ordini è configurabile con `VITE_SHOP_EMAIL` (default `ordini@lataverna.xyz`).

## Comandi

```bash
npm run dev
npm run build
npm run preview
```

`npm run lint` è al momento un placeholder del progetto.

## Biblioteca dei manuali e copyright

La vecchia raccolta di scansioni e l'indice OCR sono stati rimossi dal repository e dal build. Non pubblicare manuali, carte o altri contenuti senza una licenza che autorizzi la distribuzione. Per una nuova biblioteca usa esclusivamente SRD 5.1/5.2 (CC BY), materiale originale o contenuti con permesso scritto del titolare, e documenta la fonte accanto a ogni opera.

Non sono presenti script di indicizzazione o copie locali dei manuali. Per una nuova biblioteca usa esclusivamente l’upload privato della sezione Lettura e pubblica solo opere di cui possiedi i diritti.

## OCR locale

La lettura dei PDF scansionati usa Tesseract nel browser con asset serviti dal nostro dominio (`public/ocr`, licenze Apache-2.0 documentate nella cartella). Nessun CDN esterno e nessuna CSP permissiva: servono solo `worker-src blob:`, `'wasm-unsafe-eval'` e il fetch same-origin del modello `eng`. Se l'OCR non parte, la scansione passa al fallback AI già dichiarato nell'informativa.

## Community e Oracolo

Percorsi: `/carte`, `/giochi-di-ruolo`, `/oracolo`, `/bottega`; `/gestione` riservato ai gestori Bottega. Visione, monetizzazione e limiti attuali sono in [La mente della Taverna](docs/mente-della-taverna.md).

Per un nuovo database applicare in ordine `20261017094519_community_foundation.sql` e `20261017095644_community_metrics.sql` dopo gli schemi esistenti. Le migrazioni sono già applicate al progetto LaTaverna. Le chiavi Groq vanno solo in `.env.local` oppure nelle variabili server Vercel. Le function richiedono anche `SUPABASE_URL` e `SUPABASE_ANON_KEY` (o gli equivalenti `VITE_SUPABASE_*`).

`npm run dev` serve anche gli endpoint AI locali; `npm run preview` serve soltanto il frontend compilato. Quota condivisa tra chat, board e scansioni: 5 richieste/giorno ospite, 30 registrato, massimo 300 globali (UTC). Impostare anche limiti di spesa presso il provider prima di un lancio pubblico esteso.

Verifica: `npm run test:cards`, `npm run build`; `scripts/tests/sql/community.sql` verifica isolamento, quote e autorizzazione metriche in una transazione annullata. Il piano di business rimane da validare con dati reali: shop partner, pagamenti automatici, eventi, gestione autonoma e valutazione aziendale non sono già operativi.
