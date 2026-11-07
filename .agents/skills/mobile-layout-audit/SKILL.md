---
name: mobile-layout-audit
description: Misura e corregge l'impaginazione della Taverna sul telefono. Usa questa skill quando una pagina o un minigioco va controllato a 390x844 (verticale) e 844x390 (orizzontale), quando un tavolo non riempie lo schermo, quando ci sono comandi troppo piccoli o testi illeggibili, o quando bisogna verificare che una correzione CSS non abbia rotto altre pagine.
---

# Audit impaginazione mobile

La piattaforma è pensata per il telefono: ogni modifica va misurata, non guardata a occhio.

## Comandi

```bash
# tutti i minigiochi a 390x844
node scripts/audit-mobile.mjs

# solo alcuni giochi
node scripts/audit-mobile.mjs scacchi dama blocchi

# altre misure di viewport
BASE=http://localhost:3000 SIZE=844x390 node scripts/audit-mobile.mjs scacchi
```

Il runner apre `http://localhost:3000` con `agent-browser`, avvia ogni partita da solo
(scheda del catalogo → primo livello disponibile) e salva il report completo in
`scripts/audit-mobile.json`. Il motore di misura è `scripts/mobile-audit.js`, che gira
anche dentro la pagina:

```js
window.__mobileAudit(['scacchi', 'dama'])      // tavoli di gioco
window.__pageAudit(['/carte', '/shop'])         // pagine della piattaforma
window.__magicLayout()                          // scheda carta Magic
```

## Scheda carta Magic

`npm run test:layout` (con il dev server attivo) misura la dashboard Magic a sei
larghezze — 390x844, 651x900, 768x1024, 834x1112, 1024x768, 1180x900 — e **esce con
codice 1** se una misura esce dalle soglie: colonne della collezione (2 / 3 / 4 / 6),
carte mai sotto i 140px, mazzi impilati con lista orizzontale fino a 900px, arte
centrata nel palco e tendina che a riposo copre solo la carta e aperta arriva a
56px dal bordo lasciando libero il comando chiudi. Con pointer sintetici verifica anche
i gesti della maniglia (inseguimento 1:1, aggancio sopra e sotto metà, tocco singolo,
soglia dei 5px) e lo swipe sull'arte: orizzontale e verticale, ordine della collezione
contro quello del mazzo e arresto ai capi.

Le misure vere stanno in `window.__magicLayout()` (`scripts/mobile-audit.js`); il
driver è `scripts/test-magic-layout.mjs`. Il test monta una collezione di prova e
disattiva rete e cloud, quindi non tocca i dati della Taverna.

## Cosa significa ogni numero

| Campo | Soglia | Significato |
| --- | --- | --- |
| `riempieSchermo` | deve essere vero | il tavolo deve occupare tutto lo spazio visibile |
| `fuoriDalTavolo` | 0 | elementi che escono dal riquadro del tavolo (tagliati) |
| `comandiSotto32px` | 0 | bersagli touch più piccoli di 32px sul lato corto |
| `testiSotto9px` | 0 | etichette illeggibili su un telefono |
| `overflowOrizzontale` | 0 | contenuto più largo del tavolo |
| `guscio.scrolla` | falso | il contenuto chiede più altezza di quella disponibile |

## Come funziona il tavolo ruotato

`src/services/tableOrientation.js` mette su `<html>` le classi `table-mode`,
`table-rotated`, `table-compact`, `table-fit` e imposta `--stage-w` / `--stage-h`
(le misure del tavolo **dopo** la rotazione). Le regole stanno in
`src/dashboards/minigames/table-landscape.css`.

Conseguenze da ricordare:

- dentro il tavolo `vw` è il lato corto del telefono e `vh` è quello lungo: **non usarli**
  per dimensionare scacchiere o mani, usa `--stage-w` / `--stage-h`;
- una scacchiera va dimensionata con `width: min(calc(var(--stage-h) - X), ...)` e
  `height: auto; aspect-ratio: 1` (`height` + `width: auto` non risolve l'aspect-ratio);
- `.game-master-wrapper` ha `max-width: 100%` e l'animazione `fadeInUp` riscrive
  `transform`: la rotazione deve dichiarare `max-width: none` e `animation: none`;
- i comandi devono restare ≥ 32px e i testi ≥ 9px anche in modalità compatta.

## Ciclo di lavoro

1. `node scripts/audit-mobile.mjs <giochi>` e leggi `scripts/audit-mobile.json`.
2. Correggi **solo** `table-landscape.css` (o il CSS del gioco), con selettori
   `html.table-compact …` per il telefono ruotato.
3. Rilancia l'audit sugli stessi giochi e confronta i numeri, non le impressioni.
4. `npm run build` e `npm run test:cards`.
5. Screenshot solo quando serve un giudizio estetico: `agent-browser screenshot`.

## Regole di igiene

- Non introdurre `!important` nuovi se un selettore più specifico basta; se serve,
  spiegalo in un commento.
- Non nascondere contenuti per far passare l'audit: se un pannello non entra, va
  ridimensionato o reso scorrevole, non rimosso.
- Ogni correzione va verificata anche a 844x390 (telefono ruotato davvero) e su desktop
  (1280x800): il tavolo non deve cambiare misura.
