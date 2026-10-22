# Access control verification

The security access migration binds multiplayer rooms to Supabase account IDs. An authenticated user (including a Supabase anonymous account) creates a room; other accounts gain membership only through `join_minigame_room` with its invitation code. Ordinary REST queries cannot enumerate other rooms. Joining is limited to 30 attempts per account per ten minutes. Room participants still share cooperative game state; this is not an anti-cheat server.

The client must no longer fall back to the shared unauthenticated `anon` role. If Anonymous Sign-Ins are disabled, users must sign in normally. Existing rooms have no trustworthy account owner and become inaccessible after migration; create new rooms. Existing uploaded public maps remain public, while writes and deletes require the uploader's `owner_id`.

Legacy unrestricted policies on characters, sessions, tokens and chat messages are replaced with owner checks. The schema setup scripts also contain the corrected room and storage policies.

Run `scripts/tests/sql/security-access.sql` through an administrative SQL connection after migration. It creates temporary fixture users and rooms inside a transaction and rolls everything back; it verifies owner isolation, successful invitation access, denial of wrong invitations and anonymous callers, and immutable ownership. The Node test suite also covers malformed API bodies and fail-closed multiplayer access.

Scope: source and deployed access-control review, credential-pattern search and project tests/build. This is not a guarantee that every dependency or all application paths are free of vulnerabilities.
