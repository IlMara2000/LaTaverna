# APP LAB — architettura, stato e infrastruttura

Documento operativo della sezione **APP LAB** (`/app-lab`). Descrive ciò che è
realmente implementato, ciò che richiede servizi esterni e come collegarli.

## 1. Stato per fase

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 1 — Libreria e upload | Sezione, upload drag & drop, analisi APK nel browser, libreria privata, aggiornamento/rinomina/eliminazione, ricerca, filtri, ordinamento | **implementata** |
| 2 — Esecuzione online | Player fullscreen, WebRTC + canale input, proxy API autenticato, registro sessioni, riconnessione | **codice pronto**, richiede un gateway Android (non provisionabile su Vercel) |
| 3 — Porting iOS | Analisi di fattibilità, caricamento sorgenti, riconoscimento framework, coda di build, scaricamento IPA | **analisi e orchestrazione implementate**, richiede un servizio di build macOS con Xcode |
| 4 — Ottimizzazione | Prestazioni streaming, gestione sessioni, costi, PWA | **non implementata**: dipende dal runtime della fase 2 |

La priorità dichiarata (APK in libreria + apertura dal browser Apple) è
raggiunta per la parte client e per tutto il percorso di caricamento/analisi.
L'apertura interattiva richiede il gateway descritto al §4: **non è possibile
eseguire un APK dentro una funzione serverless Vercel**, quindi la sezione
mostra un messaggio esplicito finché `APP_LAB_RUNTIME_URL` non è configurato.
Nessuna sessione viene simulata.

## 2. Architettura

```
Browser (Vite SPA)
 ├─ analisi APK locale: ZIP + AndroidManifest (AXML) + resources.arsc + icona
 ├─ upload con progresso → Supabase Storage privato
 ├─ libreria → Supabase Postgres (RLS per utente)
 ├─ player fullscreen (WebRTC video + canale dati input)
 └─ /api/applab/session · /api/applab/porting (Vercel, same-origin)
        │
        ├─ verifica JWT Supabase, proprietà dell'app, limiti
        ├─ URL firmato (15 min) dell'APK
        └─ token server-side → Gateway Android esterno
                                    └─ container Android + emulatore + scrcpy/WebRTC
```

L'APK non viene mai eseguito da La Taverna. Il gateway è l'unico componente che
installa ed esegue il pacchetto, in una VM/container isolato e temporaneo.

## 3. Attivazione (una volta sola)

### 3.1 Database e storage

Nel SQL Editor di Supabase esegui
`supabase/migrations/20261103120000_app_lab.sql`. Crea:

- `app_lab_apps` — metadati, analisi JSON, icona, stato di compatibilità.
- `app_lab_sessions` — sessioni richieste/attive/chiuse con limiti di risorse.
- `app_lab_porting_projects` — valutazioni, sorgenti, stato build, IPA.
- bucket privati `app_lab_apks` (200 MB), `app_lab_sources` (500 MB), `app_lab_builds` (500 MB).

Tutte le tabelle hanno RLS per `auth.uid()`; i bucket sono privati e leggibili
solo dal proprietario tramite URL firmati.

### 3.2 Variabili server (Vercel → Settings → Environment Variables)

Frontend (già esistenti): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Server per le sessioni:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `SUPABASE_URL` | sì (o `VITE_SUPABASE_URL`) | progetto Supabase |
| `SUPABASE_ANON_KEY` | sì (o `VITE_SUPABASE_ANON_KEY`) | chiave anon, usata con il JWT dell'utente |
| `APP_LAB_RUNTIME_URL` | per AVVIA | base URL HTTPS del gateway Android |
| `APP_LAB_RUNTIME_TOKEN` | per AVVIA | token server→gateway, mai nel browser |
| `APP_LAB_SESSION_MINUTES` | no (20) | durata massima sessione |
| `APP_LAB_MAX_SESSIONS` | no (1) | sessioni concorrenti per utente |
| `APP_LAB_SESSION_CPU` | no (2) | CPU assegnata dal gateway |
| `APP_LAB_SESSION_MEMORY_MB` | no (2048) | RAM assegnata dal gateway |

Server per il porting:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `APP_LAB_BUILD_SERVICE_URL` | per build iOS | base URL del servizio macOS/Xcode |
| `APP_LAB_BUILD_SERVICE_TOKEN` | per build iOS | token server→builder |

Non usare prefisso `VITE_` per token o URL interni: finirebbero nel bundle.

### 3.3 CSP

`vercel.json` consente già `https://*.lataverna.xyz` e `wss://*.lataverna.xyz`
per `connect-src`, `media-src` e `frame-src`. Se il gateway vive su un altro
dominio, aggiungilo a quelle direttive: altrimenti il browser bloccherà il
WebSocket di signaling.

## 4. Contratto del gateway Android (fase 2)

Il gateway deve offrire:

| Metodo | Percorso | Risposta |
| --- | --- | --- |
| `POST` | `/sessions` | `{sessionId, signalingUrl, iceServers?, expiresAt?}` |
| `POST` | `/sessions/{id}/resume` | `{signalingUrl, iceServers?, expiresAt?}` |
| `DELETE` | `/sessions/{id}` | `204` |
| `GET` | `/health` (facoltativo) | stato del pool |

Richiesta `POST /sessions` inviata dal proxy:

```json
{
  "app": { "id": "uuid", "name": "Demo", "packageName": "com.example.demo" },
  "apk": { "url": "https://…/storage/v1/object/sign/app_lab_apks/…", "filename": "com.example.demo.apk" },
  "limits": { "minutes": 20, "cpu": "2", "memoryMb": 2048 },
  "owner": { "id": "uuid" }
}
```

Il gateway scarica l'APK dall'URL firmato, avvia un ambiente isolato, installa
(`adb install -r`), apre l'activity di lancio e restituisce un `signalingUrl`
WebSocket. Il browser invia l'offer SDP e riceve `answer` + `ice`:

```json
{ "type": "offer", "sdp": { "type": "offer", "sdp": "v=0…" } }
{ "type": "answer", "sdp": { "type": "answer", "sdp": "v=0…" } }
{ "type": "ice", "candidate": { "candidate": "…", "sdpMid": "0" } }
```

Sul canale dati `control` il browser invia:

```json
{ "type": "touch", "action": "down|move|up|cancel", "points": [{ "id": 0, "x": 0.42, "y": 0.61 }] }
{ "type": "scroll", "x": 0.5, "y": 0.5, "deltaX": 0, "deltaY": 120 }
{ "type": "key", "key": "Back", "code": "Back", "action": "down|up" }
{ "type": "text", "value": "ciao" }
{ "type": "ping", "at": 1730000000000 }
```

Coordinate normalizzate `0…1` sul rettangolo video (letterbox escluso). Ogni
pointer attivo è un dito: i pinch arrivano come più punti nello stesso evento.

Requisiti minimi del gateway: HTTPS, TURN/STUN per WebRTC, un ambiente per
sessione, distruzione alla scadenza, nessun accesso alla rete interna di
La Taverna, log delle risorse. Riferimenti di partenza: emulatore Android in
container con KVM (`android-emulator-container-scripts`), `scrcpy` per il
capture, un piccolo servizio Node che espone signaling WebRTC e comandi ADB.

**Su macOS senza KVM** l'emulatore Android è molto lento e non adatto alla
produzione: per l'esecuzione reale serve un host Linux con virtualizzazione
annidata. Su un Mac Apple Silicon sono utilizzabili emulatori ARM, ma non come
servizio multiutente.

## 5. Contratto del servizio di build iOS (fase 3)

`POST /jobs` (autenticato con `APP_LAB_BUILD_SERVICE_TOKEN`):

```json
{
  "projectId": "uuid",
  "appId": "uuid",
  "packageName": "com.example.demo",
  "appName": "Demo",
  "versionName": "1.2.3",
  "framework": "flutter",
  "sourceUrl": "https://…/app_lab_sources/…zip",
  "ipaUploadUrl": "https://…/app_lab_builds/…ipa (signed upload)",
  "ipaPath": "uuid/builds/uuid.ipa",
  "requirements": ["macOS", "Xcode", "Apple Developer Program", "certificato e provisioning profile"]
}
```

Risposta: `{ "jobId": "…" }`. `GET /jobs/{jobId}`:

```json
{ "status": "queued|building|succeeded|failed", "ipaUploaded": true, "ipaPath": "…", "ipaSizeBytes": 1234, "errorCode": null }
```

Il builder esegue la pipeline reale (`flutter build ipa`, `xcodebuild archive`
+ export con provisioning, `npx cap sync ios`, ecc.), carica l'IPA con l'URL
firmato e riporta l'esito. Solo `succeeded` con `ipaUploaded: true` porta il
progetto a `ipa_ready`; nessun altro stato produce un download.

Servono: Mac fisico o runner macOS, Xcode, Apple Developer Program attivo,
certificati e provisioning profile, App Store Connect per TestFlight. Queste
credenziali non possono essere gestite da Vercel: vanno configurate sul builder.

## 6. Sicurezza

- Tutte le tabelle e i bucket sono protetti da RLS/policy per proprietario.
- L'APK caricato è trattato come non attendibile: formato, dimensione, ZIP,
  manifest e `resources.arsc` sono validati; nessuna esecuzione lato server.
- Il runtime riceve solo URL firmati a scadenza (15 minuti) e un token interno.
- Limiti di durata, CPU, RAM e sessioni concorrenti sono applicati dal proxy e
  devono essere imposti anche dal gateway (il client non è affidabile).
- La conferma dei diritti è obbligatoria prima del salvataggio.
- La cancellazione rimuove file e metadati; le sessioni chiuse restano solo
  come registro con stato e orari.
- La CSP non è stata allargata oltre i domini necessari.

## 7. Fullscreen e iOS

- Desktop/Android: Fullscreen API reale (`requestFullscreen`) e blocco
  orientamento quando supportato.
- iPhone/iPad Safari: il fullscreen di un elemento non è disponibile; APP LAB
  usa un overlay a schermo pieno con `100dvh`, safe-area, blocco dello scroll e
  wake lock (dove concesso). La barra di stato iOS resta visibile.
- iOS non consente il blocco dell'orientamento: il pulsante ⟳ mostra un avviso
  e l'utente ruota il dispositivo.
- La modalità PWA installabile esiste già (`apple-mobile-web-app-capable`); una
  esperienza più immersiva si ottiene aggiungendo la Taverna alla schermata Home.
  Non è possibile rimuovere gli elementi di sistema iOS.

## 8. Test

Automatici: `npm run test:cards` (include `scripts/tests/applab.test.mjs`), che
verifica ZIP, AXML, deflate, metadati, permessi, compatibilità, porting e
riconoscimento dei sorgenti su pacchetti sintetici.

Manuale consigliato:

1. Desktop: carica APK, verifica icona/permessi, rinomina, sostituisci, elimina.
2. Controlla che un secondo account non veda l'app né possa scaricarla.
3. iPhone Safari: apertura sezione, upload, dettagli, sessione fullscreen;
   verifica touch, swipe, tastiera e ritorno alla libreria.
4. iPad: rotazione, safe area, multitouch.
5. Con gateway attivo: avvio, riconnessione dopo interruzione, chiusura,
   scadenza della sessione, limite di sessioni concorrenti.
6. Con builder attivo: build riuscita, build fallita, download IPA, build senza
   sorgenti rifiutata.

## 9. Limiti dichiarati

- Un APK senza sorgenti non produce un `.ipa`: la sezione lo dice e non mostra
  mai un finto download.
- Nessuna app può essere eseguita finché il gateway non è provisionato.
- La qualità dello streaming dipende da rete, TURN e potenza dell'host.
- Le app con protezioni anti-emulatore, DRM, Play Integrity o dipendenze Google
  Play possono non funzionare nell'ambiente remoto.
- La distribuzione iOS fuori da TestFlight/App Store richiede canali Apple
  autorizzati (firma aziendale, dispositivi registrati).

## Gateway incluso nel repository

`runtime/applab-gateway/` è un'implementazione del contratto qui sopra:
emulatore Android + mediamtx per il WebRTC + `adb shell input` per i comandi.
Setup e limiti sono in `runtime/applab-gateway/README.md`.

Il gateway dichiara `input: "ws"` perché mediamtx non negozia canali dati: il
player invia tocchi, tasti e testo sul WebSocket di signaling. `datachannel`
resta il comportamento predefinito quando il gateway non dichiara nulla, così
il contratto originale non cambia per gli altri runtime.
