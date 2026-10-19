# Original card-game symbols

User preference (2026-10-17): use the actual game icons throughout card costs and rules text, including future Pokémon, Yu-Gi-Oh! and One Piece interfaces. Counts and ordinary statistics remain legible numbers; an official generic-mana icon can itself contain a number.

## Magic

84 SVGs are bundled under `public/assets/symbols/mtg`. Source: https://api.scryfall.com/symbology, downloaded 2026-10-17. Each registry entry in `src/services/magicSymbolCatalog.js` records the original `https://svgs.scryfall.io/card-symbols/` URL and accessible description. These are original symbol assets served by Scryfall, not newly drawn approximations. Artwork/trademarks remain with their respective owners; no affiliation is implied.

`renderCardSymbols(text, 'mtg')` renders recognized brace tokens as local images, escaping all other text. It covers mana colors, generic values, hybrids, Phyrexian, snow, colorless, tap, untap and energy, plus other symbols returned by the catalog. Costs in the collection, decks, wantlist and card detail, including asynchronously localized rules text, use the same renderer. TXT/CSV/JSON keep canonical textual codes for import compatibility.

## Other games

`registerCardSymbols` accepts separate Pokémon, Yu-Gi-Oh! and One Piece registries with local assets, provenance and accessible labels. Those dedicated gameplay screens are not implemented by this change. Their icons must be sourced from their own original artwork when their resource/level UI is introduced; the renderer never substitutes Magic's artwork for another game.

## Wantlist downloads

Exports use the currently filtered rows and preserve the selected format/language across filtering. They are synchronous and work offline, avoiding translation calls that could hang or consume the browser's download gesture. Italian uses a known Italian printed name; otherwise the original name is retained and the status explains this. It never guesses or invents a translated card name. Empty exports are disabled. CSV includes a UTF-8 BOM, quoting and protection against spreadsheet formula interpretation. Download URLs are retained long enough for mobile browsers to start reading them.
