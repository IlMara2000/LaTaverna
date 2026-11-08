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

Le function AI vivono in `/api/rpg/*` e `/api/oracle/*`: in produzione le esegue Vercel, in locale le serve il bridge condiviso (`scripts/local-api-plugin.js` con `npm run dev`, `scripts/serve-dist.mjs` con `npm run serve`), quindi si possono provare end-to-end anche senza `vercel dev`.
