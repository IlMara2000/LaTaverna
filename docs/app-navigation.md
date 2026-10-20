# Organizzazione dell’app

Home e menu condividono quattro aree principali:

- **Carte** (`/carte`): collezioni, Magic e mazzi, segnapunti, importazione. I giochi classici sono in `/carte/giochi` e tornano alla sezione Carte.
- **Minigiochi** (`/minigames`): giochi da compagnia e strategia; collegamento esplicito a Carte per i classici.
- **Giochi di ruolo** (`/giochi-di-ruolo`): avventure pronte e accesso alle sessioni, personaggi e strumenti D&D.
- **Lettura** (`/library`): biblioteca, bacheca e raccolte.

Oracolo e Bottega sono servizi trasversali. Profilo, impostazioni e musica sono raggruppati nel menu sotto “Il tuo spazio”. Magic, segnapunti e D&D evidenziano l’area genitore nel menu. Il collegamento Riprendi usa il nome della destinazione effettiva.

La home mantiene le illustrazioni esistenti: quattro colonne su desktop, due su tablet, una su telefono. Non aggiungere collegamenti duplicati alla home per ogni filtro o strumento.

## Pulizia locale

Eliminati snapshot/log temporanei `.playwright-cli/` e i file OCR di cache `eng.traineddata`, `ita.traineddata` nella radice. Il riconoscimento browser usa Tesseract e non legge tali file dalla radice. Aggiunte esclusioni Git per impedirne la ricomparsa nei commit. Conservati dipendenze, risorse pubbliche, manuali e documentazione; conservato `output/`, che contiene anche materiali utilizzati dagli script musicali e prove del lavoro.
