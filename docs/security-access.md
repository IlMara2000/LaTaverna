# Access control verification

The security access migration binds multiplayer rooms to Supabase account IDs. An authenticated user (including a Supabase anonymous account) creates a room; other accounts gain membership only through `join_minigame_room` with its invitation code. Ordinary REST queries cannot enumerate other rooms. Joining is limited to 30 attempts per account per ten minutes. Room participants still share cooperative game state; this is not an anti-cheat server.

The client must no longer fall back to the shared unauthenticated `anon` role. If Anonymous Sign-Ins are disabled, users must sign in normally. Existing rooms have no trustworthy account owner and become inaccessible after migration; create new rooms. Existing uploaded public maps remain public, while writes and deletes require the uploader's `owner_id`.

Legacy unrestricted policies on characters, sessions, tokens and chat messages are replaced with owner checks. The schema setup scripts also contain the corrected room and storage policies.

Shared sessions have no direct `SELECT` policy for guests: `get_shared_dnd_session` returns only the table-safe fields, while the client polls that RPC. Direct table access or Realtime would expose the full `data` column, including the Master's private notes.

Uploads are constrained on both client and database: reading PDFs stay private until the owner records a distribution-rights confirmation, the reading quota limits books and bytes per account, `vtt_assets` accepts only JPEG/PNG/WebP up to 8 MB and only its owner can list it, and shop images require the shop-manager role. Public map URLs remain readable by design; private reading files are never public.

## Content Security Policy e terze parti

`vercel.json` applica una CSP stretta a tutte le risposte: script solo same-origin (più `'wasm-unsafe-eval'` per OCR e PDF), niente frame di terzi, `object-src 'none'`, `frame-ancestors 'none'`. Le eccezioni di rete sono limitate a Supabase e Scryfall; Groq viene chiamato solo dalle function server e la chiave non raggiunge mai il browser.

Non carichiamo analytics di terze parti e il browser non contatta servizi di tracking. Gli asset OCR (worker, core WebAssembly e modello inglese) sono self-hosted in `public/ocr`, quindi non servono CDN esterni e la CSP non deve autorizzare script di terzi. Il riconoscimento vocale usa il servizio del browser: la UI e l'informativa dichiarano che l'audio può essere elaborato dal fornitore del browser e non viene salvato da noi.

Le function AI non restituiscono più i messaggi grezzi del provider: i dettagli (chiavi, limiti, parametri) restano lato server e il client riceve messaggi stabili con gli stessi codici HTTP utili (401, 413, 429).

Run `scripts/tests/sql/security-access.sql` through an administrative SQL connection after migration. It creates temporary fixture users and rooms inside a transaction and rolls everything back; it verifies owner isolation, successful invitation access, denial of wrong invitations and anonymous callers, and immutable ownership. The Node test suite also covers malformed API bodies and fail-closed multiplayer access.

Scope: source and deployed access-control review, credential-pattern search and project tests/build. This is not a guarantee that every dependency or all application paths are free of vulnerabilities.
