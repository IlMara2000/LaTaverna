# LaTaverna - Server (TypeScript + Appwrite)

Breve: backend boilerplate per LaTaverna usando Appwrite. Fornisce registrazione, login e funzione cloud per verificare Discord.

Prerequisiti
- Node.js 18+ (consigliato)
- Appwrite (server + project)
- Collezione `users` in Appwrite (ID da inserire in .env)
- Variabili ambiente configurate (vedi `.env.example`)

Setup
1. Copia `server/.env.example` → `server/.env` e inserisci i valori reali.
2. Dal progetto root:
   - npm install
   - cd server && npm install
3. Avvia in sviluppo:
   - npm run dev (o `npm run dev:server` per solo server)

Script utili (root package.json)
- npm run dev:client — avvia Vite frontend
- npm run dev:server — avvia server TypeScript
- npm run dev — avvia client + server (con currently configured scripts)
- npm run build:server — compila TypeScript (server/dist)
- npm run start:server — avvia server compilato

Endpoint principali
- POST /api/auth/register
  - body: { email, password, username, gdprAccepted }
  - Crea account Appwrite, document in collection users, e sessione (login automatico).
- POST /api/auth/login
  - body: { email, password }
  - Crea sessione e ritorna i dati utente.

Appwrite Function
- src/functions/verifyDiscord/index.ts
  - Riceve { code, appwrite_user_id }, scambia OAuth code con Discord, ottiene discord_id e aggiorna documento users (campo discord_id).
  - Deployare/adattare come Appwrite Cloud Function (runtime Node/TS).

File principali
- server/package.json
- server/tsconfig.json
- server/.env.example
- server/src/index.ts
- server/src/routes/auth.routes.ts
- server/src/controllers/auth.controller.ts
- server/src/services/auth.service.ts
- server/src/functions/verifyDiscord/index.ts
- server/src/utils/validators.ts
- server/src/types/index.d.ts

Note
- Non committare il file `server/.env` (aggiungere a .gitignore).
- Errori e log sono scritti su console; frontend deve gestire le risposte JSON per mostrare alert.
- Adatta il runtime della function per l'environment Appwrite (handler export/format se necessario).

Per assistenza su deploy Appwrite o integrazione frontend, indica cosa vuoi fare e fornisci i file frontend (login.js / register.js).