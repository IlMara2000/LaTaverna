# APP LAB — gateway Android

Implementazione del contratto descritto in [`docs/app-lab.md`](../../docs/app-lab.md).
Gira su una macchina che ha `adb`, un emulatore Android e `ffmpeg`; **non** su Vercel.

## Come funziona

```
browser ──WebRTC (solo video)──► mediamtx (WHEP) ◄── RTSP ◄── ffmpeg ◄── adb screenrecord
   │                                                                          ▲
   └──WebSocket /signal/{id}──► gateway ──adb shell input tap/swipe/text──────┘
```

- `POST /sessions` scarica l'APK dall'URL firmato, lo installa con `adb install -r`,
  apre l'activity di lancio, avvia la cattura e restituisce `signalingUrl`.
- Il video arriva in WebRTC tramite mediamtx: il gateway inoltra l'offerta SDP del
  browser a `http://127.0.0.1:8889/applab/whep` e rimanda l'answer.
- I comandi di tocco, scroll, tasto e testo viaggiano sul WebSocket di signaling
  (`input: "ws"`), perché mediamtx non negozia canali dati. Il player supporta
  entrambe le modalità: `datachannel` resta il default del contratto.
- Una sola sessione per volta: l'emulatore è condiviso e ogni nuova sessione
  reinstalla l'APK. Alla scadenza (`SESSION_MINUTES`) il flusso viene fermato.

## Setup macOS (questo Mac)

```bash
brew install openjdk@17 mediamtx
npm install --prefix runtime/applab-gateway
APPLAB_ROOT="/Volumes/HIKSEMI 1/File Temp/Server LaTaverna" ./runtime/applab-gateway/setup-macos.sh
```

Tre processi, in tre terminali:

```bash
mediamtx runtime/applab-gateway/mediamtx.yml

export ANDROID_HOME="/Volumes/HIKSEMI 1/File Temp/Server LaTaverna/android-sdk"
export ANDROID_AVD_HOME="/Volumes/HIKSEMI 1/File Temp/Server LaTaverna/android-home/avd"
"$ANDROID_HOME/emulator/emulator" -avd applab -no-window -no-audio -gpu swiftshader_indirect

APP_LAB_RUNTIME_TOKEN=... node runtime/applab-gateway/server.js
```

Nel progetto, in `.env.local` (mai committato):

```
APP_LAB_RUNTIME_URL=http://127.0.0.1:8790
APP_LAB_RUNTIME_TOKEN=<lo stesso token>
```

`npm run dev` espone `/api/applab/session`, che inoltra al gateway; la pagina
`/app-lab` mostra "Runtime Android collegato" e AVVIA funziona.

## Limiti noti

- `adb screenrecord` si ferma a 170 s: il ciclo riprende da solo e il video può
  avere una pausa di circa un secondo ogni tanto. È accettabile per una demo,
  non per un servizio.
- Solo tocco singolo e trascinamento: il pinch a due dita non è implementato
  (`adb shell input` non gestisce multi-touch senza root).
- Un utente per volta, nessun isolamento tra sessioni: non usarlo esposto su
  Internet. Per la produzione serve un host Linux con KVM e un container per
  sessione.
- `127.0.0.1` funziona solo in locale. Per raggiungerlo dal telefono serve un
  dominio HTTPS pubblico e la CSP di `vercel.json` aggiornata.
