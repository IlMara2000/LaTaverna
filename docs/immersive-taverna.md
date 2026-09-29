# Immersive Taverna — September 2026

The handwritten amethyst direction remains the base. The entrance is now an illustrated facade with an independently hinged wooden door, original logo on glass, brass handle, arrow invitation and slogan plaque. Opening uses finite Web Animations (900 ms door, 360 ms forward blur); reduced motion skips the transition. The login shares the illustrated interior.

## Assets

Original images generated with built-in image_gen, encoded as WebP quality 80:
- `public/assets/entrance/exterior.webp`: symmetrical ink-illustrated medieval tavern facade, lanterns, empty central doorway, amethyst shadows and brass warmth; no text.
- `public/assets/entrance/interior.webp`: candlelit tavern interior, central aisle, fireplace, dark timber and amethyst accents; no text.
- `public/assets/worlds/reading-nook.webp`: engraved reading nook, open book, candle, velvet chair, arched moonlit window and bookshelves. Detail weighted right for a readable left text overlay.

The logo on the door is the existing brand asset. The Bottega emblem and eleven game motifs are original SVGs. Each minigame reuses its motif as a fading backdrop under the card text.

## Navigation and library

`/bottega` opens the department hub; `/bottega/artigiano-rituale` opens the existing shop with its age gate, catalog and cart. Vercel rewrites serve the app on refresh. Additional departments are noninteractive Coming soon tiles.

Home uses natural wheel scrolling, without mandatory snap or shrinking its content container. The extra three-ways caption is removed.

Book deletion is owner-only, including public books, and requires an in-app confirmation. The service verifies the authenticated owner and stored path, unpublishes, removes the Storage file, then removes metadata. Existing foreign-key cascades remove favorites and collection links. Storage failure preserves private metadata so deletion can be retried; partial failures are reported. No new RLS policy is required and no real user books were deleted during verification.

## Dice

A small perspective polygon renderer supplies lit 3D geometry without a new runtime dependency. It rotates monotonically around one fixed axis and decelerates over 1.1 s. New rolls cancel previous animation work; reduced motion draws the final pose immediately. Results still come from the existing roll calculation. Numeric fields and select options have explicit high-contrast amethyst styling in day and night views.

## Card match counter

Accessible from the home dock and sidebar as Segnapunti carte. Shared-device tool for 2–6 players, editable names, preset or custom starting values, quick/manual adjustments, custom named counters with configurable increments, turn tracker, undo, coin, d6, local persistence and history. It does not automatically adjudicate wins or synchronize across devices.

Preset references: [Yu-Gi-Oh! official guide](https://www.yugioh-card.com/en/about/faq-for-parents/), [Magic comprehensive rules](https://media.wizards.com/2020/downloads/MagicCompRules%2020200703.pdf), [Commander introduction](https://magic.wizards.com/en/news/feature/introduction-commander-2016-10-28), [Pokémon rulebook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/rulebook/par_rulebook_en.pdf). Initial values remain configurable for variants. Pokémon counts remaining prizes and separate damage counters, not a single player life total.

## Verification

71 Node tests pass, including new card-counter state/persistence and reading-deletion failure cases. Browser checks cover door/keyboard/reduced-motion entry, desktop mouse wheel scroll, department links and refresh/history, game art, mocked book deletion/cancel, dice final values and rapid repeated rolls, counter presets/undo/custom counters/persistence and 390px mobile layout. Build succeeds with the existing large-chunk warning. 21st review reports informational hardcoded-color findings only; project controls and typography are reused instead of adding a component dependency.
