# Mobile tabletop layout

The scorekeeper opens its setup screen on every visit: preset, 2–6 players, initial points, start, optional resume, and a small CSS 3D coin. The existing saved match is retained until Start is submitted. The match fills the usable viewport with colored raised panels; only points and +/- are shown in life mode. Each button displays its press burst for 1.8 seconds after the last tap. Commander and poison modes use independent counters; commander combat damage also adjusts life. Partners remain separate.

Swipe **down** on the score to show commander damage, **up** to restore life. Arrow keys and accumulated wheel input offer equivalent controls. The hamburger contains only Commander Damage, Poison Damage and New Match. Re-selecting the active damage mode returns to life. Escape and clicking the backdrop close the menu. New Match returns to setup without discarding the saved scores until Start.

The standalone iPhone shell is detected with `display-mode: standalone` and `navigator.standalone`. Its actual scrolling viewport is inset from system safe areas, avoiding content under the status bar while scrolling. Shared safe-area tokens are cleared inside this inset container to avoid duplicate spacing. Ordinary Safari tabs retain their layout. The draggable global menu stays fully within safe bounds in standalone mode.

MTCG, Multiplayer and Proxy Printer use shared cartoon controls and responsive panels. Proxy previews scale proportionally on screen, while print keeps A4 sheets and 63 × 88 mm cards. Print rules reset the standalone fixed shell.

## Verification

- 127 repository tests passed, including safe viewport geometry.
- DOM integration checks: setup, resume, press bursts and expiry, commander/partner, poison without life loss, down/up gestures, coin.
- Real browser checks: setup, 4-player portrait and landscape, 6 players at 320 × 568; MTCG, Multiplayer and Proxy Printer at 375 × 812; a nine-card preview loaded from Scryfall.
- Physical iPhone Home Screen mode is not available in this environment; the platform-specific safe-area change still requires a device check.

## Browser comments, 26 October 2026

1. Entrance: opaque illustrated walnut leaf with iron straps replaces the gray frosted-glass surface. Existing logo, handle, keyboard access and opening animation remain. `public/assets/entrance/door-wood.jpg` was generated with Imagegen for this project, then encoded as JPEG; the original PNG is retained in the Codex generated-images directory. Prompt requested a frontal medieval walnut door texture, amber highlights, amethyst shadows and iron straps, without text, branding or a handle.
2. Mobile home: caption backgrounds are explicitly transparent, including Safari fallback and high-contrast selectors. A neutral dark image scrim preserves text contrast without purple rectangles.
3. Tabletop hubs: MTCG, Multiplayer and Proxy Printer use translucent amethyst panels, soft inset highlights and raised cartoon buttons. Opaque fallback remains for reduced-transparency preference and high-contrast mode. This is a scoped exception to the older no-blur design rule.

### Collezione: riferimento video del 26 ottobre
La carta aperta su mobile occupa la parte superiore dello schermo, con dettagli su un pannello chiaro arrotondato sotto. Swipe orizzontale sull'immagine o frecce sfogliano le carte filtrate. Pressione di 500 ms seleziona una carta; movimento oltre 10 px annulla il gesto per lasciare scorrere la pagina. Sono disponibili anche selezione da pulsante, selezione di tutti i risultati filtrati, cancellazione delle copie e dei relativi riferimenti nei mazzi, e annullamento dell'ultima eliminazione finché non viene effettuata un'altra modifica. La wantlist resta indipendente.
Verificati nel browser a 375×812: importazione di due carte di prova, apertura, swipe alla carta successiva, pressione prolungata, tondini, seleziona tutti, cancellazione e ripristino. Verifica fisica su iPhone standalone ancora da eseguire.
