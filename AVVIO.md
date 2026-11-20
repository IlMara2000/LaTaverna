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

## 6. Server locale permanente

Su questo Mac l'ambiente locale non passa da `npm run dev`: un LaunchAgent
(`~/Library/LaunchAgents/xyz.lataverna.devserver.plist`) avvia al login
`~/Library/Application Support/LaTaverna/run-devserver.sh`, che serve la build
statica su `http://localhost:3000` con `scripts/serve-dist.mjs` — un processo
Node senza dipendenze, senza watcher e senza trasformazioni a runtime — e monta
le rotte `/api/*` con lo stesso bridge dello sviluppo
(`scripts/local-api-bridge.js`, guardia sull'`Origin` inclusa).

Il wrapper ricostruisce `dist/` solo se un sorgente è più recente di
`dist/index.html`: dopo una modifica al codice il riavvio può richiedere una
ventina di secondi prima che la porta risponda. Log: `/tmp/lataverna-devserver.log`.

```bash
launchctl list | grep devserver                                  # stato e pid
launchctl kickstart -k gui/$(id -u)/xyz.lataverna.devserver      # riavvio (ricostruisce se serve)
launchctl bootout gui/$(id -u)/xyz.lataverna.devserver           # fermarlo
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/xyz.lataverna.devserver.plist  # riavviarlo
```

Con `KeepAlive` attivo uccidere il processo non lo spegne: launchd lo rilancia
entro pochi secondi, quindi per fermarlo serve `bootout`. Se all'avvio della
sessione il disco esterno non è ancora montato, il wrapper attende due minuti e
poi esce senza riavvii a vuoto: lo si rilancia con `kickstart`.

Per servire la build a mano, in primo piano:

```bash
npm run build
npm run serve                  # porta 3000; altrimenti PORT=3100 npm run serve
```

## 7. Deploy

Per Vercel o hosting statico:

- Build command: `npm run build`
- Output directory: `dist`
- Variabili ambiente frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Variabili ambiente server/function: `FREELLMAPI_API_KEY` e `FREELLMAPI_BASE_URL`, opzionali `FREELLMAPI_MODEL`, `FREELLMAPI_VISION_MODEL`, `FREELLMAPI_TEMPERATURE`, `FREELLMAPI_MAX_TOKENS`, `FREELLMAPI_TIMEOUT_MS` (vedi `docs/oracolo-freellmapi.md`)

Se usi Discord OAuth in produzione, aggiungi anche il dominio finale tra gli URL autorizzati in Supabase Auth e nella Discord Developer Console.

Le function AI vivono in `/api/rpg/*` e `/api/oracle/*`: in produzione le esegue la piattaforma (Cloudflare Worker o Vercel), in locale le serve il bridge condiviso (`scripts/local-api-plugin.js` con `npm run dev`, `scripts/serve-dist.mjs` con `npm run serve`), quindi si possono provare end-to-end anche senza `vercel dev`.

## 8. Deploy su Cloudflare

La configurazione è in `wrangler.jsonc`: il Worker `worker/index.js` rimonta gli
stessi handler di `api/` e riproduce redirect, rewrite SPA e header di
`vercel.json`; gli asset di `dist/` vengono serviti da Cloudflare senza invocare
il Worker, usando `public/_headers` per gli header di sicurezza.

Serve un account Cloudflare; perché il dominio risponda dal Worker la zona
`lataverna.xyz` deve esistere nell'account (vedi ultimo paragrafo).

```bash
npx wrangler login
npm run build
npx wrangler deploy
npx wrangler dev --port 8787   # anteprima locale su workerd
```

I secret del server si impostano una volta (non stanno in `wrangler.jsonc`):

```bash
npx wrangler secret put FREELLMAPI_API_KEY
npx wrangler secret put FREELLMAPI_BASE_URL
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put BW_SECRET
npx wrangler secret put BW_PASSWORD
```

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` restano variabili di build: finiscono
nel bundle del browser e vanno presenti in `.env` (o nell'ambiente di build) prima
di `npm run build`, esattamente come su Vercel.

Due valori non si possono ricavare dal repository e vanno impostati a mano:

- `FREELLMAPI_BASE_URL`: deve essere l'URL pubblico del tunnel, **non** `127.0.0.1`
  (su Workers il loopback non raggiunge il Mac). Finché manca, `/api/oracle/*` e
  `/api/rpg/*` rispondono 503.
- `SUPABASE_SERVICE_ROLE_KEY`: serve al limite AI per rete e a
  `POST /api/magic/prices`. Senza, entrambi rispondono 503.

Il deploy attuale risponde su `https://lataverna.lataverna.workers.dev`
(sottodominio `workers.dev` dell'account, registrato una volta sola).

### Collegare lataverna.xyz

Il token OAuth creato da `wrangler login` non ha il permesso di creare zone
(serve Zone:Edit): l'aggiunta del sito va fatta dal pannello, **Add a site** →
`lataverna.xyz` → piano Free. Poi si cambiano i nameserver su Name.com con quelli
mostrati da Cloudflare. Quando la zona è attiva, il dominio si collega da
**Workers → lataverna → Settings → Domains & Routes** aggiungendo `lataverna.xyz`
e `www.lataverna.xyz`: Cloudflare crea i record DNS da solo.
