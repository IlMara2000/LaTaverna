# Game design

Prima di progettare o costruire un minigioco (nuovo gioco, nuova modalità, variazione di un gioco esistente) si segue `docs/game-design-taverna.md`: scheda di progetto, checklist di design, soglie di leggibilità misurate a 390×844 e 844×390, registrazione in `src/services/experienceCatalog.js` e verifica finale con misure riportate.

# Card-game symbols

The user requires original game icons instead of letter/number approximations for game resources. Use `src/services/cardSymbols.js` for inline symbols. Magic's original Scryfall SVG artwork is bundled locally, including generic mana numbers, hybrids, Phyrexian, tap/untap and energy symbols. Keep actual quantities, statistics and machine-readable export values as numbers/text.

When adding Pokémon, Yu-Gi-Oh!, One Piece or another TCG interface, obtain that game's original artwork for its energy/types/attributes/levels/ranks/costs as applicable. Record the source, bundle it under the game's own asset directory, and register its vocabulary separately. Do not reuse Magic symbols, replace them with emoji or invent approximations. Do not label an unimplemented game as supported. Preserve accessible text alternatives and escape card text before embedding icons. See `docs/card-symbols.md`.
