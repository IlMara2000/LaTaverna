# La Taverna — current design direction

The latest user direction supersedes the earlier collage/clay/bohemian/glass worlds and Nunito Sans font.

## Identity

60% dark fantasy, 30% medieval core, 10% restrained maximalism. Use blackened violet, amethyst highlights, ivory typography, engraved imagery and thin heraldic borders throughout the platform. Stronger illustrations on entry points; quieter surfaces around reading, gameplay and forms.

## Typography

Alegreya for body text, controls and secondary headings. Unifraktur Maguntia for primary display titles, preferably sentence case. Georgia remains for functional card suits and chess pieces. Never alter PDF content typography.

## Shared implementation

Tokens and section rules: `src/styles/experience-worlds.css`, after base and authentication styles. Reuse existing UI primitives. Every destination retains the dark-fantasy world; section and depth are tracked separately. The original triptych WebP is shared across the three home portals and RPG hero.

## Constraints

Keep the original login logo centered, without a duplicate white brand title or background crystals. Preserve existing gameplay geometry, rules, suit colors, product artwork, account flows and original PDF layout. Keep focus rings, responsive layouts and reduced-motion behavior. No continuous decorative motion or backdrop blur on common surfaces.

## Asset

See `docs/dark-fantasy-design.md` for generation provenance and validation.
