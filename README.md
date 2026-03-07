# LaTaverna - dev README

Quick start:
1. Creare i file sopra nella struttura indicata.
2. Nel browser, aprire `src/index.html` servito da un semplice server statico:
   - installa `serve` (`npm i -g serve`) e poi `serve .` nella root
3. In Functions di :contentReference[oaicite:4]{index=4}:
   - creare Function `createUserProfile` con index.js e package.json
   - creare Function `verifyDiscord` con index.js e package.json
   - impostare environment variables (see config/env.js + note in files)
4. Testa createUserProfile via execution (payload: `{ "appwrite_user_id": "...", "username":"Den", "gdprAccepted": true }`).
5. Testa verifyDiscord con payload: `{ "appwrite_user_id": "...", "discord_id": "..." }`.
6. Per il frontend, usa il browser per registrare/login e lascia che il codice JS chiami Appwrite.

Notes:
- Non committare API keys pubblicamente.
- Per produzione: mettere HTTPS, limitare execution permissions, mettere rate limit, proteggere functions.