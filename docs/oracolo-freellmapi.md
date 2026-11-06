# L’Oracolo su FreeLLMAPI

Dal 5 novembre 2026 le funzioni AI della Taverna non chiamano più direttamente Groq: passano dal
gateway locale **FreeLLMAPI**, un’API OpenAI-compatibile che inoltra la richiesta a modelli gratuiti
con failover automatico.

## Catena delle richieste

```
browser (account Supabase)
  → function Vercel /api/oracle/chat, /api/rpg/*, /api/magic/*
      → controllo sessione + quota Supabase (invariati)
      → gateway FreeLLMAPI  POST {BASE_URL}/v1/chat/completions
          → provider gratuito scelto/instradato dal gateway
```

Il browser non vede mai la chiave del gateway, né il modello effettivamente servito oltre al campo
`model` della risposta.

## Variabili server

| Variabile | Default | Note |
| --- | --- | --- |
| `FREELLMAPI_BASE_URL` | `http://127.0.0.1:31415` | Radice o `/v1`, entrambe accettate; l’adapter aggiunge `/v1/chat/completions` |
| `FREELLMAPI_API_KEY` | — | Chiave unificata `freellmapi-…`; solo server, mai `VITE_*` |
| `FREELLMAPI_MODEL` | `nemotron-3-ultra-550b` | Modello per chat, board RPG e traduzioni |
| `FREELLMAPI_VISION_MODEL` | valore di `FREELLMAPI_MODEL` | Modello per scan carte e foto dell’Oracolo |
| `FREELLMAPI_TEMPERATURE` | `0.6` | Temperatura chat |
| `FREELLMAPI_MAX_TOKENS` | `420` | Tetto risposte board; l’Oracolo usa 1800 |
| `FREELLMAPI_TIMEOUT_MS` | `55000` | Timeout per richiesta |

In locale i valori stanno in `.env.local`; `npm run dev` li copia in `process.env` tramite
`scripts/local-api-plugin.js`. Su Vercel vanno in Project Settings → Environment Variables.

## Modello predefinito

Con i provider gratuiti collegati il 5 novembre 2026, `nemotron-3-ultra-550b` è risultato l’unico
modello stabile in italiano senza “thinking” nel corpo della risposta:

- `nemotron-3-ultra-550b` — risposta pulita, ~1,5 s;
- `nemotron-3.5-lightning`, `free-router` — riversano il ragionamento in `content`;
- `auto` — ha instradato su `dots-3-note-preview`, che ha lo stesso problema;
- `fusion` — pannello di modelli + giudice: più lento, utile solo per risposte critiche.

Se il modello cambia disponibilità, basta aggiornare `FREELLMAPI_MODEL` senza toccare il codice.
Il gateway espone `GET /v1/models` per verificare cosa è `available: true`.

## Nessuna ricerca web

Il gateway non offre un equivalente del tool `browser_search` di Groq. La casella «Cerca sul web» è
stata rimossa dall’Oracolo e il prompt di sistema vieta al modello di dichiarare di aver cercato
online. Per ripristinare la ricerca serve un servizio di search separato, non FreeLLMAPI.

## Tunnel verso il Mac (solo se la Taverna resta su Vercel)

Vercel non può raggiungere `127.0.0.1` del tuo computer. Se vuoi che l’app pubblica usi il gateway
del Mac:

```bash
# App FreeLLMAPI aperta e in ascolto su 127.0.0.1:31415
npm run tunnel          # ngrok http 31415 --log stdout
```

Poi su Vercel (ambiente Preview e/o Production):

```bash
FREELLMAPI_BASE_URL=https://<dominio-riservato>.ngrok-free.dev/v1
FREELLMAPI_API_KEY=freellmapi-...
FREELLMAPI_MODEL=nemotron-3-ultra-550b
```

Redeploy dopo aver cambiato le variabili: i deployment già creati continuano a usare i valori con
cui sono stati costruiti.

Con un dominio riservato (dashboard ngrok → Domains) l’URL resta lo stesso a ogni riavvio del
tunnel, quindi riavviare ngrok non richiede di toccare Vercel. Senza dominio riservato l’URL cambia a
ogni avvio e la variabile va aggiornata insieme al redeploy.

Avvertenze:

- il tunnel espone il gateway a Internet: chi conosce l’URL deve comunque presentare la chiave
  unificata, che resta solo nell’ambiente server, ma conviene non condividere l’URL;
- le richieste di tutti gli account della Taverna finiscono sul tuo Mac e consumano le quote dei tuoi
  provider gratuiti (le quote per account restano quelle Supabase: 5 ospite / 30 registrato / 300
  globali al giorno, più un tetto di 60 richieste al giorno per rete);
- se l’app FreeLLMAPI si chiude, il Mac va in stop o il tunnel cade, l’Oracolo risponde 503 a tutti;
  per distinguere «tunnel giù» da «chiave sbagliata»: `curl -s -o /dev/null -w '%{http_code}'
  https://<dominio>/v1/models` risponde `401` quando il gateway è raggiungibile (la chiave manca
  nell’header) e non risponde affatto quando il tunnel è caduto;
- i prompt vengono inviati a provider terzi: va dichiarato nell’informativa privacy;
- l’uso di un account personale come backend di un servizio pubblico va verificato con i ToS dei
  provider collegati.

Per un uso pubblico stabile la strada corretta è un host sempre acceso (VPS o mini-server) con
FreeLLMAPI, oppure un provider API dedicato; il tunnel è adatto a uso personale e demo.

## Avvio automatico al login (macOS)

Due LaunchAgent in `~/Library/LaunchAgents` tengono in piedi la catena quando il Mac si accende:

- `xyz.lataverna.freellmapi` — lancia `/usr/bin/open -gja /Applications/FreeLLMAPI.app` al login e
  riprova ogni 5 minuti: se l’app è già aperta `open` non fa nulla, se è stata chiusa la riapre.
- `xyz.lataverna.ngrok` — avvia `ngrok http 31415 --url https://hearted-galina-artesian.ngrok-free.dev`
  con `KeepAlive`, quindi se il tunnel cade `launchd` lo riavvia da solo; log in
  `/tmp/lataverna-ngrok.log`.

```bash
launchctl print gui/$(id -u)/xyz.lataverna.ngrok           # stato e pid del tunnel
launchctl kickstart -k gui/$(id -u)/xyz.lataverna.ngrok    # riavvio forzato
launchctl bootout gui/$(id -u)/xyz.lataverna.ngrok         # fermarlo per sempre
```

I plist non contengono segreti: ngrok usa l’authtoken in `~/Library/Application Support/ngrok/ngrok.yml`
e la chiave del gateway resta solo nelle variabili server di Vercel. Con il tunnel sotto `launchd`
`npm run tunnel` non serve più: l’avvio manuale resta utile solo per diagnosi.

## Sorveglianza automatica

`npm run watch:gateway` controlla la catena completa e avvisa **solo quando lo stato cambia**, così
tunnel caduto o app chiusa non producono una notifica a ogni giro:

```bash
npm run watch:gateway                 # un controllo; exit 1 se qualcosa è giù
npm run watch:gateway -- --loop 120   # controlla ogni 120 s (Ctrl+C per fermare)
npm run watch:gateway -- --quiet      # solo log, senza notifiche di sistema
```

Sonde: gateway locale (`FREELLMAPI_LOCAL_URL`, default `http://127.0.0.1:31415`), tunnel pubblico
(`FREELLMAPI_BASE_URL`, saltato se punta a loopback) e health dell'app (`TAVERNA_HEALTH_URL`,
default `https://www.lataverna.xyz/api/rpg/ai-health`). Un `401` su `/v1/models` conta come
**raggiungibile**: è la risposta attesa quando la sonda non presenta la chiave.

Gli avvisi usano una notifica macOS (`osascript`). Se impostate `TAVERNA_ALERT_WEBHOOK_URL` le
stesse righe partono anche come `POST` JSON `{"text": "…"}`, formato accettato da Slack e da molti
altri servizi. Lo stato precedente è in `output/gateway-watch-state.json` (cartella in `.gitignore`),
quindi un controllo lanciato da cron ricorda cosa era già stato segnalato.

Per farlo partire da solo all'accesso, con `launchd` (file da creare tu, fuori dal progetto):

```xml
<!-- ~/Library/LaunchAgents/xyz.lataverna.gateway-watch.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>xyz.lataverna.gateway-watch</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/env</string><string>npm</string><string>run</string><string>watch:gateway</string><string>--</string><string>--loop</string><string>120</string>
  </array>
  <key>WorkingDirectory</key><string>/percorso/di/LaTaverna</string>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/lataverna-gateway-watch.log</string>
  <key>StandardErrorPath</key><string>/tmp/lataverna-gateway-watch.log</string>
</dict></plist>
```

Poi `launchctl load ~/Library/LaunchAgents/xyz.lataverna.gateway-watch.plist`. Il watchdog dice se
tunnel e gateway rispondono; **non** riavvia ngrok né FreeLLMAPI, che restano manuali.

## Perché non passare da Claude Code

La richiesta iniziale prevedeva di far parlare l’Oracolo con il terminale Claude Code aperto sul Mac.
Non è la scelta giusta per un’app multiutente:

- Claude Code è un agente interattivo, non un endpoint stateless: non regge richieste concorrenti di
  più account né attribuisce le risposte a un utente;
- un solo processo/terminale diventa un collo di bottiglia e un punto di rottura unico;
- i prompt di tutti gli utenti finirebbero nella stessa sessione personale, con risposte intrecciate;
- non c’è isolamento per utente né possibilità di applicare quote per account lato Claude Code;
- il gateway HTTP di FreeLLMAPI espone già lo stesso modello con failover, ed è la cucitura corretta:
  auth e quote restano in Supabase, il gateway fa solo inferenza.

## Diagnostica rapida

```bash
curl -s http://127.0.0.1:31415/v1/models -H "Authorization: Bearer $FREELLMAPI_API_KEY"
curl -s https://<dominio>/api/rpg/ai-health
```

- `503` con «L’Oracolo non è ancora configurato» → manca `FREELLMAPI_API_KEY` nell’ambiente della
  function;
- `503` «non riesce a raggiungere il gateway» → app chiusa, porta diversa o tunnel non attivo;
- `429` → quota FreeLLMAPI/provider esaurita: il gateway fa failover, ma se tutti i modelli sono in
  rate limit la richiesta fallisce;
- `401`/`403` dal gateway → chiave unificata ruotata nella dashboard: aggiorna `FREELLMAPI_API_KEY`.
