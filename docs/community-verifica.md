# Verifica community — 20 ottobre 2026

Anteprima Vercel: https://lataverna-79tpxqboj-ilmara2000s-projects.vercel.app
Deployment: `dpl_3wyutS27oYU9RaWJobVZzxQ2SjNU`, stato READY. Protezione Vercel mantenuta. Non promosso in produzione. L’anteprima include il checkout corrente, comprese modifiche preesistenti a dungeon, navigazione e simboli.

## Esiti

- 118 test Node superati (`npm run test:cards`).
- Build Vercel riuscita, 210 moduli. Restano avvisi di dimensione del lettore PDF e import misti di lobby/AudioManager.
- SQL transazionale: isolamento collezioni per utente, divieto di trasferire proprietà, quota ospite, blocco metriche per non gestori e rifiuto di eventi retrodatati. Rollback completato.
- Nel browser: creazione campagna, uscita e ripresa dello stesso tavolo; scena e chat persistenti; risposta reale Oracolo alla richiesta di un giocatore, con compagno contestuale. Corretto il doppio rendering fra risposta insert e realtime.
- Nel browser: aggiunta manuale di una carta One Piece; solo il relativo filtro attivato, altri filtri disabilitati. Rimossa la riga di collaudo.
- Ultima anteprima: `/carte` restituisce HTTP 200 tramite accesso Vercel autorizzato.
- Nel browser: Bottega senza prodotti fumo, con categorie future chiaramente indicate come in preparazione.
- Nel browser: Scala quaranta avvia una mano, pesca, selezione/scarto, risposta del computer e restituzione del turno.
- API dell’anteprima precedente dello stesso intervento: richiesta senza sessione respinta; richiesta autenticata completata con risposta Groq e quota residua. Account API di collaudo eliminato. Nell’ultima versione migliorate le istruzioni per impedire affermazioni non fondate sulle capacità della board.
- Nessuna chiave Groq rilevata nel bundle browser verificato; `.env.local` e `.vercel` esclusi da Git, segreti esclusi dall’upload sorgenti.
- Review 21st: 14 segnalazioni informative sui colori CSS espliciti; nessun errore bloccante. L’identità visiva esistente è mantenuta.

## Limiti e seguito

La lettura fotografica necessita ancora di un dataset rappresentativo dei quattro giochi: non è certificata l’accuratezza del riconoscimento. Solo MTG usa un catalogo per validare il nome; gli altri giochi sono collezioni di metadati confermati, non simulatori completi. Non vengono mostrate risorse o icone inventate per tali giochi.

L’Oracolo narra e suggerisce, ma le azioni su schede, dadi, inventario e token restano esplicite. Le due campagne di collaudo sono nell’account ospite del browser; le prove possono incidere sulle metriche aggregate iniziali.

Lettura editoriale, ulteriori minigiochi, pagamenti automatici, offerte reali dei partner, sponsorizzazioni, eventi, gestione delegata e valutazione dell’asset restano sviluppi successivi descritti nella mente della Taverna. Prima di un lancio ampio servono una revisione delle policy Supabase preesistenti e un limite economico concordato per l’AI: la quota implementata conta richieste, non euro.
