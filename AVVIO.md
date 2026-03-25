# Come avviare La Taverna e collegare tutte le funzionalità

## 1. Requisiti

- **Node.js** (v18+)
- **Account Appwrite** (cloud o locale)
- **App Discord** (Developer Portal) per il login con Discord

---

## 2. Variabili d’ambiente (`.env`)

Il file `.env` nella root del progetto è già presente. Controlla che contenga:

- **Appwrite (frontend)**  
  - `VITE_APPWRITE_ENDPOINT` – URL dell’API (es. `https://nyc.cloud.appwrite.io/v1`)  
  - `VITE_APPWRITE_PROJECT` – ID del progetto Appwrite  
  - `VITE_DATABASE_ID` – ID del database  
  - `VITE_USERS_COLLECTION_ID` – ID della collection utenti  

- **Discord (frontend)**  
  - `VITE_DISCORD_CLIENT_ID` – Client ID dell’app Discord  
  - `VITE_DISCORD_REDIRECT_URI` – Deve essere **uguale** alla callback configurata in Appwrite (OAuth) e nel Developer Portal Discord  

- **Discord (backend / funzione)**  
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` – usati dalla funzione `verifyDiscord` su Appwrite  

Se modifichi `.env`, riavvia il server di sviluppo.

---

## 3. Configurazione Appwrite

1. **Console Appwrite** → [cloud.appwrite.io](https://cloud.appwrite.io) (o la tua istanza).

2. **Progetto**  
   - Crea o seleziona il progetto.  
   - Copia **Project ID** e **Endpoint** e mettili in `.env` come sopra.

3. **Database**  
   - Crea un database e una collection (es. `users`).  
   - Nella collection `users` previsti almeno: `username`, `discord_id`, `role`, `appwrite_user_id`, `gdpr_accepted`, `gdpr_accepted_at` (o adatta il codice in `auth.js` / `createUserProfile`).  
   - Imposta i permessi di lettura/scrittura in base alle tue regole (es. utenti autenticati).

4. **Auth**  
   - Abilita **Email/Password** (per registrazione e login classico).  
   - Aggiungi **OAuth2 – Discord**:  
     - Client ID e Client Secret dell’app Discord.  
     - Redirect URI **identico** a `VITE_DISCORD_REDIRECT_URI` e a quello configurato su Discord (es.  
       `https://nyc.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/69a85edc001553a4b931`).

5. **Funzione `verifyDiscord`** (per “Login con Discord” con il flusso custom)  
   - Nella console Appwrite: **Functions** → crea funzione (es. `verifyDiscord`).  
   - Carica il codice da `functions/verifyDiscord/index.js` (e le dipendenze, se necessario).  
   - Nelle **Variables** della funzione imposta:  
     - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT`, `APPWRITE_API_KEY`  
     - `DATABASE_ID`, `USERS_COLLECTION_ID`  
     - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`  
   - La frontend chiama `${APPWRITE_ENDPOINT}/functions/verifyDiscord/executions` (vedi `redirectDiscord.js`).

---

## 4. Configurazione Discord (Developer Portal)

1. Vai su [Discord Developer Portal](https://discord.com/developers/applications) → la tua applicazione.

2. **OAuth2 → Redirects**  
   - Aggiungi esattamente lo stesso URL usato in Appwrite e in `VITE_DISCORD_REDIRECT_URI` (es.  
     `https://nyc.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/69a85edc001553a4b931`).

3. **OAuth2**  
   - Copia **Client ID** e **Client Secret** e usali in `.env` e nelle variabili della funzione Appwrite.

---

## 5. Avviare l’app in locale

```bash
# Dalla root del progetto (dove c’è package.json)
npm install
npm run dev
```

- Vite avvia il frontend (di solito su **http://localhost:5174**).  
- Apri quel URL nel browser.

Comportamento atteso:

- **Non loggato**: viene mostrato il form di **Login** (email/password + pulsante “Login con Discord”) e il link “Registrati”.
- **Loggato**: viene mostrata la **Dashboard** (benvenuto, Collega Discord, Esci, ecc.).
- Dopo il redirect da Discord (con `?code=...`), la pagina gestisce il `code` e chiama la funzione `verifyDiscord`; in caso di successo vedrai il messaggio in `#message`.

---

## 6. Riepilogo “collegare tutto”

| Cosa | Dove |
|------|------|
| Endpoint e Project ID Appwrite | `.env` (VITE_*) e variabili funzione `verifyDiscord` |
| Database e collection utenti | Appwrite Console + `.env` (VITE_DATABASE_ID, VITE_USERS_COLLECTION_ID) |
| Auth Email/Password + OAuth Discord | Appwrite Console → Auth |
| Redirect URI Discord | Uguale in: Discord Developer Portal, Appwrite OAuth, `.env` (VITE_DISCORD_REDIRECT_URI e DISCORD_REDIRECT_URI) |
| Funzione verifyDiscord | Deploy su Appwrite con variabili d’ambiente impostate |
| Avvio frontend | `npm run dev` dalla root |

Se qualcosa non funziona, controlla la console del browser (errori di rete, CORS, 401/403) e i log della funzione `verifyDiscord` nella console Appwrite.

---

## 7. Deploy su Vercel e collegamento al tuo dominio

### 7.1 Primo deploy

1. **Collega il repo a Vercel**  
   - Vai su [vercel.com](https://vercel.com) → **Add New** → **Project** e importa il repository Git (GitHub/GitLab/Bitbucket) del progetto.  
   - Framework: Vercel rileva **Vite** da `vercel.json`.  
   - **Build Command**: `npm run build`  
   - **Output Directory**: `dist`  
   - Non avviare ancora il deploy.

2. **Variabili d’ambiente su Vercel**  
   - Nella pagina del progetto: **Settings** → **Environment Variables**.  
   - Aggiungi **le stesse variabili che usi in locale** (solo quelle che il frontend deve vedere, con prefisso `VITE_`):

   | Nome | Valore | Ambiente |
   |------|--------|----------|
   | `VITE_APPWRITE_ENDPOINT` | `https://nyc.cloud.appwrite.io/v1` | Production, Preview |
   | `VITE_APPWRITE_PROJECT` | Il tuo Project ID | Production, Preview |
   | `VITE_DATABASE_ID` | ID database | Production, Preview |
   | `VITE_USERS_COLLECTION_ID` | ID collection (es. `users`) | Production, Preview |
   | `VITE_DISCORD_CLIENT_ID` | Client ID Discord | Production, Preview |
   | `VITE_DISCORD_REDIRECT_URI` | **Vedi sotto** | Production, Preview |

   **Importante:** `VITE_DISCORD_REDIRECT_URI` in produzione può restare l’URL di callback **Appwrite** (es. `https://nyc.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/TUO_PROJECT_ID`). Il redirect dopo il login Discord va verso Appwrite, non verso il tuo dominio. Il frontend che l’utente vede può essere sul tuo dominio Vercel.

3. **Deploy**  
   - Salva le variabili e fai **Deploy** (o push sul branch collegato).  
   - Una volta completato avrai un URL tipo `https://tuo-progetto.vercel.app`.

### 7.2 Collegare il tuo dominio (custom domain)

1. **Aggiungi il dominio**  
   - Nel progetto Vercel: **Settings** → **Domains**.  
   - Clicca **Add** e inserisci il tuo dominio (es. `lataverna.it` o `www.lataverna.it`).

2. **Configurazione DNS**  
   - Vercel mostra quali record DNS aggiungere (solitamente un record **A** o **CNAME**).  
   - Nel pannello del tuo registrar (Aruba, Register, GoDaddy, Cloudflare, ecc.):  
     - Per il **root** (es. `lataverna.it`): di solito un record **A** con il valore indicato da Vercel (es. `76.76.21.21`).  
     - Per **www** (es. `www.lataverna.it`): un record **CNAME** che punta a `cname.vercel-dns.com` (o il valore mostrato da Vercel).  
   - Salva e attendi la propagazione DNS (da pochi minuti a 24–48 ore).

3. **SSL**  
   - Vercel rilascia automaticamente il certificato HTTPS per il dominio aggiunto. Non serve configurare nulla in più.

4. **Redirect Discord / Appwrite (se serve)**  
   - Se usi solo login **email/password**, non devi cambiare nulla.  
   - Se usi **Login con Discord**: il redirect dopo l’OAuth è verso **Appwrite** (`VITE_DISCORD_REDIRECT_URI`). L’utente torna poi sulla tua app (anche sul dominio Vercel) quando fai il redirect lato client. Quindi di di solito **non** devi mettere il tuo dominio Vercel nei redirect URI di Discord/Appwrite, a meno che tu non abbia un flusso che rimanda esplicitamente al tuo dominio. In quel caso aggiungi anche `https://tuodominio.it` (o il path esatto) nei redirect consentiti in Discord e, se previsto, in Appwrite.

### 7.3 Riepilogo dominio Vercel

| Step | Dove |
|------|------|
| Variabili `VITE_*` | Vercel → Project → Settings → Environment Variables |
| Aggiunta dominio | Vercel → Project → Settings → Domains → Add |
| Record DNS | Registrar (A / CNAME come indicato da Vercel) |
| HTTPS | Gestito da Vercel |

---

## 8. Verificare che Appwrite sia collegato

### Test da terminale (endpoint e, opzionale, progetto/database)

Dalla root del progetto:

```bash
node scripts/test-appwrite.js
```

Lo script:
- legge `.env` (usa `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT`, `VITE_DATABASE_ID`);
- controlla che l’**endpoint** Appwrite risponda (health);
- se in `.env` hai impostato `APPWRITE_API_KEY` (solo in locale, **mai** nel frontend), prova anche progetto e database.

Se vedi `✅ Endpoint raggiungibile` allora il collegamento all’istanza Appwrite funziona.

### Test dal browser (login/dashboard)

1. Avvia l’app: `npm run dev`.  
2. Apri http://localhost:5174.  
3. Apri gli **Strumenti per sviluppatori** (F12) → scheda **Rete/Network**.  
4. Ricarica la pagina: dovresti vedere richieste verso `nyc.cloud.appwrite.io` (o il tuo endpoint).  
5. Prova **Registrati** con email/password: se la registrazione va a buon fine, Appwrite (Auth + Database) è collegato.  
6. Prova **Login** con le stesse credenziali: se entri in dashboard, Auth è corretta.
