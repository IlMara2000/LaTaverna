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
