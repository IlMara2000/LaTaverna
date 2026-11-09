# STENCIL LAB

Percorso nascosto: `/bw` (e `/bw/login`). Non linkato, `noindex`, `nofollow`.

## Accesso
- Password singola (`BW_PASSWORD`) + cookie firmato HMAC (`BW_SECRET`).
- TTL sessione da `BW_SESSION_TTL` (es. `7d`, `12h`, `45s`; clamp 60s–90g, default 7g).
- Scadenza visibile in alto a destra; avviso 5 min prima.
- Rinnovo automatico su attività (focus/visibility) e sliding a ogni poll (30s).
- Pulsante **Esci** revoca il cookie.

## Flusso utente
1. `/bw` → pagina login se non autenticato.
2. Password corretta → cookie `bw_session` (HttpOnly, Secure, SameSite=Lax, path=/).
3. App: dark mode, palette bianco/nero/grigio.
4. Upload (drag&drop o click) → JPEG/PNG/WebP ≤ 6 MB.
5. **TRASFORMA** → POST `/api/bw/stencil` (JSON: `imageBase64`, `mimeType`).
6. Risultato + comparatore before/after (slider).
7. **SCARICA PNG** → download blob.
8. **RIGENERA** → nuova chiamata provider.
9. **NUOVA IMMAGINE** → reset upload.

## Provider AI
- Priorità: `IMAGINE_API_KEY` (ImagineArt `images/edits`, multipart).
- Fallback: FreeLLMAPI vision (`FREELLM_API_KEY` + `FREELLM_VISION_MODEL`).
- Se nessuno configurato → 503 `no_ai_provider` (nessun falso successo).
- Immagine **non persistita** (solo memoria richiesta).

## Sicurezza
- `isSameOriginRequest` su `/api/bw/stencil` (403 altrimenti).
- Rate limit IP su `/api/bw/login` (5/15min, in-memory).
- Quota IP AI via `assertAiIpBudget` (RPC Supabase `take_ai_ip_quota`).
- CSP: `script-src 'self' 'wasm-unsafe-eval'` (niente inline).
- Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<TTL>`.

## Variabili ambiente (Vercel → Production + Preview)
| Var | Obbligatoria | Note |
|-----|:---:|------|
| `BW_PASSWORD` | Sì | Password accesso |
| `BW_SECRET` | Sì | Chiave HMAC (≥32 char casuali) |
| `BW_SESSION_TTL` | No | Default `7d`; formati: `7d`, `12h`, `45m`, `90s` |
| `IMAGINE_API_KEY` | No | Per ImagineArt (preferito) |
| `FREELLM_API_KEY` | No | Fallback vision |
| `FREELLM_VISION_MODEL` | No | Default `nemotron-3-ultra-550b` |
| `FREELLM_API_BASE_URL` | No | Default `http://127.0.0.1:31415/v1` |

## Deploy
1. Imposta le 4+ variabili su Vercel (Production **e** Preview).
2. `git push origin main` → Vercel build automatico.
3. Testa `/bw` e `/bw/login` (devono servire HTML, non 404).
4. Login → app → upload → TRASFORMA → risultato.

## Note
- `robots.txt` **non** toccato (Disallow: /bw pubblicherebbe il percorso).
- Nessun link interno a `/bw`.
- Logout + scadenza visibile + rinnovo senza re-login.
