# Multiplayer e MTCG

## Collegamento

La sezione `/multiplayer` crea o raggiunge un tavolo tramite un codice di sei caratteri. Il collegamento dura fino alla scadenza della stanza (quattro ore), al cambio di account o all'uscita esplicita. Navigare tra sezioni non lo chiude. Ogni partecipante apre lo stesso gioco e preme Online; restano validi i limiti di posti del gioco. Scala quaranta usa ora la stessa connessione degli altri giochi.

Le stanze platform usano l'identità autenticata anche per i posti di gioco. L'invito registra l'appartenenza sul server, mantiene l'ordine dei posti e non usa il codice come autorizzazione permanente. Gli ascoltatori Realtime hanno nomi distinti; la sessione viene assegnata al collegamento Realtime prima dell'ascolto. Il controllo periodico recupera aggiornamenti dopo interruzioni di rete.

## D&D

Il Master crea il collegamento Multiplayer, apre una propria sessione salvata e preme Online. Gli invitati entrano dal pannello Multiplayer o dal pulsante Online in D&D. La chat, i dadi e i movimenti sono condivisi. “La mia pedina” crea o recupera una pedina controllata dall'utente; gli ospiti possono muovere solo quella. La gestione del tavolo rimane al Master.

Le migrazioni `20261023155021_platform_multiplayer.sql` e `20261023155508_platform_stable_roster.sql` sono necessarie. Le sessioni degli ospiti vengono lette da una funzione che espone solo i campi pubblici del tavolo, senza appunti privati o configurazione AI. Uscire dal collegamento revoca l'accesso. Il test `scripts/tests/sql/platform-multiplayer.sql` verifica i confini di accesso in una transazione annullata.

## MTCG

`/carte` contiene i giochi di carte classici. `/mtcg` raccoglie Magic, Segnapunti e MTG Proxy Printer. Il segnapunti resta raggiungibile dal menu laterale. I mazzi Magic raggruppano le carte per tipo e possono passare direttamente la lista al Proxy Printer.

Il Proxy Printer accetta liste con quantità e nomi, carica le immagini Scryfall e impagina nove carte da 63 × 88 mm per foglio A4. I retro bifronte possono essere aggiunti su fogli separati. Attende il caricamento delle immagini e segnala i nomi non risolti prima di abilitare la stampa. La finestra di stampa del browser consente anche il salvataggio PDF; usare scala 100% senza intestazioni. Questa implementazione non include gli importatori URL o la traduzione automatica del riferimento esterno.

## Segnapunti

Il formato Magic parte da 40 PV. Ogni giocatore conserva i danni ricevuti da ciascun comandante, con due contatori distinti per gestire partner; non si sommano comandanti diversi per la soglia di 21. Si possono aggiornare automaticamente anche i PV. Guadagnare vite non cancella i danni da comandante.

Scorrere verso l'alto sul numero dei PV apre i danni da comandante; scorrere verso il basso torna ai PV. Rotella/trackpad, frecce su/giù e pulsante visibile offrono accessi alternativi. Lo scorrimento non modifica il punteggio. Le pressioni consecutive di +/− mostrano variazione totale e numero di pressioni per 1,8 secondi; cambiare segno o contatore avvia una nuova sequenza.

## Verifica del 23 ottobre 2026

- 124 test automatici superati.
- Test DOM del segnapunti: pressioni, inversione, danni/PV, tastiera, trackpad, swipe e scadenza dell'indicatore.
- Test PostgreSQL locale: invito, revoca, campi pubblici, identità chat, movimento della sola pedina propria, limiti delle coordinate.
- Test SQL sul progetto collegato, con rollback: accesso e isolamento D&D.
- Due sessioni anonime indipendenti: invito tramite codice, ricezione Realtime nel secondo client e revoca dopo l'uscita. Stanze di prova chiuse.
