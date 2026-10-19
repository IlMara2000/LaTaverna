# Donjon and the D&D board

Updated 2026-10-16. Reference: https://donjon.bin.sh/ and https://donjon.bin.sh/5e/dungeon/.

## Available locally

D&D → Strumenti → Officina dei dungeon generates an original deterministic dungeon, with 5–36 connected rooms, two corridor orientations, optional loops, normal/mixed/no doors, optional stairs, numbered rooms and Italian narrative notes. It remembers generation settings on the device. Preview supports two palettes and optional grid. Exports: SVG, PNG, full Master JSON and text notes. Player view excludes room numbers, secret-door symbols, special-door colors and notes.

Prepare Session creates an editable draft using a PNG player map, a 20-pixel grid and Master map notes. It does not save or publish a session automatically. Existing session permissions and storage behavior remain applicable; player view is an export/display feature, not a new server-side authorization boundary.

Existing native tools remain the entry points for initiative, encounter difficulty, loot, ability generation, CR estimates, rule lookup and the DM screen.

## Official external catalog

D&D → Strumenti → Catalogo Donjon contains 90 official tool links, grouped and searchable by system, initially filtered to D&D 5e. Each opens the official tool in another tab. This is a curated external directory, not API synchronization or a native reimplementation of every Donjon tool. World/town generation, calendars, weather, name/NPC/adventure generators, magic shops and other game-system variants remain external. The local dungeon does not implement the complete Donjon dungeon options, monster tables, PDF generation or import of Donjon JSON.

No Donjon source code or random-content tables were copied. The catalog stores public tool names and URLs, checked on 2026-10-16.

## Navigation fix

The global menu can be dragged using a primary pointer on desktop or touchscreens. Release preserves position without snapping to an edge; at least half the button remains reachable. Clipped edges display a grip centered within the visible area, including corners. Resize and visual-viewport changes clamp the position. Position uses the existing localStorage key. Navbar owns click handling so Sidebar refreshes cannot replace drag-click suppression.

## Validation

`npm run test:cards` includes connectivity across 60 generated dungeons, seed reproducibility, player-export checks and viewport geometry. Browser checks use WebKit, mobile/desktop viewport sizes, real mouse drag/release/click, navigation, player export to PNG and session draft prefill. No live session was saved during verification.
