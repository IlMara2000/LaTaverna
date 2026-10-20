# La mente della Taverna

Briefing del fondatore raccolto il 17 ottobre 2026. Documento di visione e pianificazione, non descrizione di funzionalità già pubblicate. Le decisioni del fondatore sono distinte dalle raccomandazioni da validare. Le indicazioni commerciali precedenti incompatibili con questa visione sono superate come direzione futura, non come descrizione tecnica dello stato attuale.

## Identità e risultato desiderato

La Taverna è un luogo online gratuito in cui passare tempo da soli o insieme: giochi, carte, avventure, lettura e community. La Bottega trasforma l'appartenenza e gli interessi in acquisti pertinenti.

Obiettivo del fondatore: costruire un asset che produca reddito e sia eventualmente cedibile, con gestione progressivamente delegata a persone e AI. L'indipendenza dal fondatore è un requisito operativo da misurare, non una conseguenza automatica dell'uso dell'AI.

Posizionamento proposto: «Entra in Taverna: trovi sempre qualcosa da giocare e qualcuno con cui condividerlo». Brand di community, con estetica fantasy e prodotti utilizzabili anche fuori dalla piattaforma. La varietà da sola non dimostra un vantaggio competitivo.

## Decisioni espresse dal fondatore

- Accesso gratuito all'hub e ai giochi come principio; modelli premium ancora da discutere.
- Riorientare completamente la Bottega. Ritirare l'attuale offerta legata a bocchini e fumo; eventuale ritorno solo dopo un accordo specifico con il produttore. In implementazione conservare storico ordini e dati necessari, ritirando i prodotti dalla vendita.
- Prevedere brand partner, sponsorizzazioni e merchandise La Taverna: accessori gaming e giochi da tavolo, abbigliamento e gadget accessibili economicamente. Adeguare l'offerta agli interessi osservati nei giochi realmente utilizzati.
- Unificare le carte collezionabili sotto Carte: Magic/MTG, Pokémon, Yu-Gi-Oh! e One Piece.
- Classificare le carte caricate per gioco; mostrare le proprie carte e filtri attivi solo per i giochi posseduti. I filtri senza carte restano riconoscibili ma disabilitati, con spiegazione e possibilità di caricare nuove carte.
- Collocare anche Solitario, Scopa e Scala quaranta nella sezione Carte, distinguendo chiaramente giochi classici e collezioni.
- Migliorare i minigiochi e ampliare Lettura.
- Inserire D&D dentro Giochi di ruolo. Preparare campagne avviabili da soli con AI come master e compagni.
- Creare L'Oracolo, assistente inizialmente richiesto su Grok/xAI, poi integrato con la chiave Groq fornita per carte, effetti, immagini, regolamenti e videogiochi, con ricerca quando servono informazioni aggiornate.
- Costruire un sistema di misurazione dell'utenza, dell'economia e del valore trasferibile della piattaforma.

## Stato realizzato e limiti (19 ottobre 2026)

Implementazione locale, con migrazioni già applicate al database LaTaverna; la pubblicazione va verificata separatamente.

- Carte riunisce MTG, Pokémon, Yu-Gi-Oh! e One Piece come collezioni personali. I filtri vuoti sono disabilitati. Foto analizzata da Groq con conferma prima del salvataggio; MTG verificato per nome su Scryfall, gli altri giochi conservano metadati confermati dall’utente. Non sono implementati motori di partita o cataloghi ufficiali degli altri tre TCG; riconoscimento della stampa esatta e relative icone restano da integrare.
- Solitario e Scopa conservati; aggiunta Scala quaranta contro computer, singola smazzata. Nessun multiplayer Scala quaranta ancora.
- Giochi di ruolo contiene D&D e due scenari originali pronti. L’Oracolo usa scena, iniziativa, token e chat; narra e interpreta un compagno. Schede, tiri, inventario e token restano gestiti dai controlli della board, non aggiornati automaticamente dall’AI. Le campagne sono riprendibili dalle sessioni D&D.
- Il fondatore ha fornito una chiave **Groq**, servizio diverso da **Grok/xAI**. L’integrazione effettiva usa Groq. Chat dedicata, immagini, ricerca esplicita e Oracolo sulla board condividono autenticazione e quote server: 5 richieste giornaliere per ospite, 30 per registrato, 300 globali. Sono limiti di richieste, non un tetto monetario garantito; anche i tentativi falliti consumano quota. Le quote per ospite non impediscono creazione di nuovi account, mentre il tetto globale limita il consumo totale.
- Ritirati i quattro vecchi prodotti legati al fumo, conservando lo storico. Bottega predisposta per accessori, abbigliamento e partner, senza inventare prodotti acquistabili. Gli ordini restano richieste da concordare, non un checkout automatizzato.
- Gestione riservata ai gestori Bottega: account registrati/ospiti, partecipanti osservati a 7/30 giorni, richieste AI giornaliere, esportazione e simulatore commissioni. Eventi aggregati per account/attività/giorno; nessuna cronologia anteriore alla strumentazione. Gli account non equivalgono a persone uniche; bot, interni e prove non sono ancora esclusi. Il simulatore non è una valutazione aziendale né un rendiconto.
- Lettura conserva la libreria PDF e ora registra l’apertura; guide, racconti, eventi e nuovi minigiochi non di carte restano in roadmap.

## Pubblico, esperienza e differenziazione da validare

Pubblico iniziale consigliato: piccoli gruppi italiani e appassionati di carte e GDR, inclusi principianti che vogliono iniziare senza organizzazione complessa. Il pubblico potenziale può essere più ampio; acquisire tutti contemporaneamente disperderebbe lo sviluppo.

La home deve rispondere a tre intenzioni: gioco subito, trovo/invito compagnia, riprendo ciò che stavo facendo. Percorsi principali: Carte, Minigiochi, Giochi di ruolo, Lettura; Bottega e Oracolo trasversali. Eventi e community diventano una destinazione dedicata quando hanno attività sufficiente.

Vantaggio proposto: continuità fra collezione, spiegazione di una carta, partita, gruppo, evento e accessorio pertinente, con un'identità unica. Da provare con comportamento degli utenti, non da dichiarare già acquisito. Board Game Arena offre già gioco gratuito e vantaggi Premium: la gratuità isolata non basta a distinguersi.

Viralità utile: invito a una partita, ripresa di una campagna con amici, sfida condivisa, evento ricorrente. Premiare partecipazione reale; misurare quante persone invitate completano una prima attività e ritornano. Giveaway possono essere esperimenti di acquisizione, non il motore principale: valutare il costo per nuovo utente trattenuto.

Lettura: sperimentare guide originali ai giochi, racconti della community, diari di campagna, gruppi di lettura e incontri con autori. Selezionare contenuti pubblicabili e autorizzati prima di ampliarli.

Minigiochi candidati da confrontare: sfida logica giornaliera per il ritorno individuale, quiz cooperativo e gioco di disegno/indovinelli per inviti di gruppo. Scegliere un esperimento per volta in base a tempo necessario per iniziare, completamento, ritorno e costo di manutenzione.

## Modello economico consigliato, non ancora approvato

| Canale | Proposta | Condizione per introdurlo |
| --- | --- | --- |
| Merchandise proprio | Pochi prodotti utili: tappetino, sacchetto dadi, maglietta; preordini o produzione su richiesta da confrontare | Domanda verificata, qualità e margine dopo resi e logistica |
| Partner commerciali | Affiliazione o commissione su vendite attribuite | Tracciamento attendibile e accordo su responsabilità, resi e assistenza |
| Sponsorizzazioni | Pacchetti evento o placement con periodo, pubblico e report definiti | Audience attiva dimostrabile; evitare promesse di vendite garantite |
| Abbonamento fornitori | Strumenti, vetrina ed eventi ricorrenti; pubblicità come servizio distinto | Valore ricorrente per il partner e primi rinnovi verificati |
| Membership utenti | Eventuale unico livello sostenitore, vantaggi estetici e comodità | Domanda reale; giochi base gratuiti |
| AI ad uso intensivo | Quota gratuita sostenibile, eventuali crediti o piano con limiti chiari | Costo per sessione misurato e budget controllato |
| Abbonamento shop | Eventuale club con benefici sostenibili | Acquisti ripetuti e margini sufficienti; evitare sconti che cancellano il profitto |

Sequenza consigliata: esperienza che genera ritorno → piccolo esperimento Bottega → partner pilota → ricavi ricorrenti. Non partire con numerosi piani Pro/Plus/Premium né con un magazzino ampio.

La «fumetteria online» è una buona immagine per community, incontri, tavoli ed esposizione di partner. Un magazzino proprio e uno spazio fisico sono attività aggiuntive, con lavoro e costi distinti. Valutarli dopo aver provato domanda e gestione delegata online. Eventi fisici iniziali preferibilmente con organizzatori e sedi partner.

Progetti futuri possibili: servizio eventi per negozi/associazioni, accessori proprietari, campagne originali, strumenti per collezionisti, spazi community per partner. Sono opzioni future, non impegni dell'attuale roadmap.

## Misurazione di utenza, margine e valore

Non assegnare un prezzo fisso a ogni iscritto. Registrazioni, pubblico attivo, acquirenti e utenti trattenuti sono grandezze diverse. Nessun dato attuale di traffico, ricavi o profitto è stato verificato per questo briefing.

Cruscotto mensile proposto:

- Registrati cumulativi e nuovi registrati, senza confonderli con gli attivi.
- WAU/MAU: utenti unici che completano un'attività significativa negli ultimi 7/30 giorni; definire gli eventi per gioco, lettura e collezioni ed escludere bot/account interni.
- Attivazione: quota dei nuovi utenti che completa la prima attività entro 7 giorni.
- Ritorno per coorte: quota attiva nei giorni 7–13 e 28–34 dalla prima attività, calcolata solo per coorti mature. Mantenere identiche finestre nei confronti.
- Sessioni concluse, gruppi che ritornano, inviti inviati/accettati e invitati poi attivati.
- Acquirenti/MAU, ordini, valore medio ordine, riacquisto; visualizzazioni sponsor valide, clic e conversioni attribuite con finestra dichiarata.
- Ricavi propri distinti dal GMV: quando si è intermediari, il valore totale venduto dai partner non coincide con il ricavo della Taverna.
- Costi AI, hosting, pagamenti, assistenza, produzione, logistica, resi e acquisizione; costo del lavoro delegato e ore del fondatore.
- Quota di operazioni risolte senza fondatore, interventi urgenti, incidenti e concentrazione dei ricavi sui principali partner.

Formule di gestione:

```
attivi_finali = attivi_mantenuti + riattivati + nuovi_attivati
ricavi_commerciali = margini/ricavi propri contabilizzati secondo il ruolo + commissioni + sponsorizzazioni + membership
margine_contribuzione = ricavi - costi_variabili_attribuibili
risultato_operativo_normalizzato = margine_contribuzione - costi_fissi - costo_di_sostituzione_del_lavoro_del_fondatore
CAC = spesa_acquisizione_attribuita / nuovi_utenti_attivati_attribuiti
valore_coorte_osservato_per_utente = margine_cumulato_della_coorte / utenti_iniziali_della_coorte
```

L'ultima formula misura valore osservato, non un LTV futuro garantito. Per un LTV previsionale servono scenari di ritorno, acquisto e costo; non usare la formula da abbonamento per tutti gli utenti gratuiti.

Esempio puramente illustrativo: 10.000 MAU × 2% acquirenti × 1 ordine/mese × 30 € = 6.000 € di vendite mensili. Se la commissione fosse 10%, il ricavo intermediato sarebbe 600 € prima dei propri costi. Se fosse merchandise proprio, si sottrarrebbero produzione, logistica, resi e altri costi. Audience elevata non implica automaticamente redditività.

Per un'eventuale cessione preparare scenari prudente/base/espansione e un dossier con coorti, conti, contratti trasferibili, diritti sugli asset, documentazione tecnica e procedure operative. Una possibile analisi a regime è il risultato annuo normalizzato moltiplicato per un multiplo ricavato da transazioni effettivamente comparabili; nessun multiplo viene assunto qui. Il passaggio da valore operativo a prezzo delle quote richiede considerare anche cassa, debiti e condizioni della vendita. Prima della redditività, documentare domanda e asset senza inventare una valutazione certa.

## Specifiche essenziali da conservare

### Carte multigioco

Separare il catalogo delle carte dalle copie possedute. Ogni riferimento deve avere gioco, identificativo della fonte, espansione, numero, lingua e variante; ogni copia posseduta deve mantenere proprietario e quantità. Non confondere riconoscimento del gioco con identificazione esatta della stampa.

Flusso: caricamento → candidati di riconoscimento → validazione con catalogo del gioco → conferma/correzione → salvataggio → filtro aggiornato. Se ambiguo, chiedere conferma senza assegnare silenziosamente il gioco sbagliato. Conservare tutte le collezioni Magic esistenti durante l'estensione. Verificare disponibilità e termini delle fonti per ciascun gioco prima dell'integrazione.

Criterio di accettazione: chi possiede solo One Piece vede le sue carte e il filtro One Piece attivo; gli altri filtri sono disabilitati ma comprensibili. Rimuovendo l'ultima carta, lo stato si aggiorna senza perdere l'accesso al caricamento.

### Giochi di ruolo e campagne autonome

D&D è una sottosezione di Giochi di ruolo. Primo esperimento: una breve avventura originale guidata, personaggio pronto, un compagno AI, salvataggio e ripresa. Separare narratore AI, regole/risoluzione dei tiri e stato persistente della campagna. Aggiungere più compagni solo dopo aver verificato coerenza, latenza e costi.

Criterio di accettazione: un nuovo utente può iniziare e concludere una sessione senza master umano, riprenderla senza perdere inventario e progressi e capire quando il servizio AI è indisponibile. Usare materiali compatibili con i diritti di utilizzo verificati per il progetto.

### L'Oracolo

Nome pubblico: L'Oracolo. Provider inizialmente richiesto: Grok/xAI; provider effettivamente collegato: Groq. Accesso tramite chat autonoma e contesti carta/campagna. Distinguere spiegazioni, ruling ufficiali, suggerimenti e informazioni di mercato. Per informazioni correnti usare ricerca esplicita e citare fonte/data; il modello da solo non equivale a una ricerca aggiornata. Non presentare un prezzo di carta senza stampa, lingua, condizione e data della fonte.

Requisiti operativi: credenziale server, modello configurabile, quote per utente, limiti di costo, monitoraggio della spesa, gestione degli errori, sessioni private e conferma per azioni che modificano dati. La chiave non va nel browser o nel repository. Verificare account API e disponibilità di fatturazione; l'accesso alla chat Grok non prova che l'API sia configurata. Se necessario chiedere al fondatore di accedere all'account, senza inviare segreti in chat.

Test di accettazione: domanda su un effetto con fonte, immagine ambigua con richiesta di conferma, informazione recente con ricerca, quota esaurita con messaggio comprensibile, nessuna chiave nel bundle. Il collegamento Groq è stato verificato con risposte reali; Grok/xAI non è configurato.

## Roadmap proposta per risultati, senza scadenze inventate

1. **Fondamenta:** ritirare l'offerta fumo dalla Bottega, definire navigazione unificata e misurazione, collaudare i giochi esistenti. Risultato: percorsi coerenti e dati di riferimento affidabili.
2. **Carte:** consolidare Magic, creare modello multigioco e aggiungere progressivamente gli altri tre TCG; ricollocare Scopa e Solitario e implementare Scala quaranta. Risultato: caricamento, filtro e partita verificati sui flussi richiesti.
3. **Oracolo:** consolidare Groq, chat contestuale, ricerca con fonti e budget. Risultato: assistente utilizzabile con qualità e costo misurati.
4. **GDR:** riunire D&D nella sezione, pubblicare una campagna autonoma breve. Risultato: sessione completa e riprendibile senza intervento umano.
5. **Ritorno e conversione:** eventi ricorrenti, un esperimento minigioco/lettura, piccolo assortimento e partner pilota. Risultato: dati su ritorno, conversione e margine per decidere cosa ampliare.
6. **Delega:** procedure, ruoli, automazioni e responsabili. Risultato: operatività ordinaria sostenuta senza interventi quotidiani del fondatore.

AI e automazioni possono assistere supporto, catalogazione, report e moderazione preliminare. Assegnare responsabilità umane per controversie, rimborsi, sicurezza e decisioni commerciali; registrare le azioni e prevedere escalation. Valutare con continuità i diritti su contenuti, l'adeguatezza per utenti minorenni e le condizioni di eventi/premi al momento di progettare le relative funzioni.

## Domande ancora aperte

- Quale pubblico deve trovare per primo un'esperienza completa: collezionisti TCG, gruppi GDR o giocatori occasionali?
- Quale budget mensile e quale disponibilità del fondatore sono sostenibili fino alla copertura dei costi?
- Per accesso gratuito si intende anche AI illimitata o è compatibile una quota gratuita con uso aggiuntivo a pagamento?
- Esistono già partner e produttori interessati con condizioni verificabili?

## Fonti consultate il 17 ottobre 2026

- Board Game Arena, FAQ: https://en.boardgamearena.com/faq — confronto circoscritto su accesso gratuito e Premium; non analisi completa dei competitor.
- xAI, Web Search: https://docs.x.ai/developers/tools/web-search — ricerca esplicita per dati aggiornati.
- xAI, Pricing: https://docs.x.ai/developers/pricing — costi di modello e strumenti da verificare quando si seleziona la configurazione.

Le scelte di business e le priorità di questo documento sono proposte progettuali, non risultati di una ricerca di mercato o di una valutazione aziendale.
