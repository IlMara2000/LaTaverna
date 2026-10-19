# Card-game symbols

The user requires original game icons instead of letter/number approximations for game resources. Use `src/services/cardSymbols.js` for inline symbols. Magic's original Scryfall SVG artwork is bundled locally, including generic mana numbers, hybrids, Phyrexian, tap/untap and energy symbols. Keep actual quantities, statistics and machine-readable export values as numbers/text.

When adding Pokémon, Yu-Gi-Oh!, One Piece or another TCG interface, obtain that game's original artwork for its energy/types/attributes/levels/ranks/costs as applicable. Record the source, bundle it under the game's own asset directory, and register its vocabulary separately. Do not reuse Magic symbols, replace them with emoji or invent approximations. Do not label an unimplemented game as supported. Preserve accessible text alternatives and escape card text before embedding icons. See `docs/card-symbols.md`.
