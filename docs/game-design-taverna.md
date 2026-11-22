# Manuale di game design della Taverna

Sintesi operativa di un corso di game design (Jesse Schell, *The Art of Game Design*; MDA; Alexander Brazie sul core loop; la ricerca su juice e game feel; GMTK; Unity Learn) tradotta nelle regole con cui la Taverna progetta, costruisce e verifica i propri giochi.

Si applica a ogni nuovo minigioco, modalità online e variazione di un gioco esistente. Vale insieme a `docs/mente-della-taverna.md` (visione di prodotto) e `docs/mobile-tabletop-layout.md` (layout mobile).

## 1. Le sette lenti che si usano sempre

1. **Il loop prima di tutto.** Ogni gioco è una sequenza `sfida → azione → ricompensa` che riparte. La ricompensa prepara la sfida successiva, altrimenti è una lista di eventi, non un gioco.
2. **Tre scale di tempo.** Secondi (l'azione: pesco, muovo, schivo), minuti (la partita: la smazzata, la manche, il livello), giorni (la progressione: record, livelli, sblocchi). Le tre scale devono tirare nella stessa direzione.
3. **Il feedback non è decorazione.** Ogni azione ha una risposta visibile subito, specifica e utile: cosa è successo, se era buono, cosa fare dopo. Flash, scossa leggera, numero che sale, suono breve, stato che cambia: è il *juice* che rende leggibile il sistema.
4. **Decisioni leggibili, tradeoff veri.** Se un'opzione è sempre la migliore, non c'è decisione. Il giocatore deve poter prevedere l'effetto di ciò che fa.
5. **Curva di difficoltà e flow.** Introduci in sicurezza, sviluppa combinando, twist con una variante, poi respiro. La sfida sale con l'abilità, non con la sorpresa.
6. **S'insegna giocando.** I primi 30 secondi sono il tutorial: un testo lungo non sostituisce una situazione in cui sbagliare costa poco.
7. **Rigore da taverna.** Una partita deve essere comprensibile in 5 secondi su un telefono, anche a chi entra mentre gli altri stanno già giocando.

## 2. Il test di decisione

Per ogni regola, carta, comando o schermata chiedersi: **che cosa noterà, imparerà, sentirà o potrà fare diversamente il giocatore?** Se la risposta non è chiara, la feature non è pronta a guadagnarsi la sua complessità. Questo test vale più di qualsiasi elenco di funzioni.

## 3. Scheda di progetto obbligatoria (prima del codice)

Compilare in poche righe, senza codice, prima di aprire l'editor:

| Campo | Contenuto |
| --- | --- |
| Nome | Come si chiama in lobby |
| Verbo | L'azione che si ripete (pescare, piazzare, schivare, indovinare) |
| Loop | Una frase: `sfida → azione → ricompensa` |
| Partita da 60 secondi | Cosa succede nei primi 60 secondi, dall'apertura alla prima scelta interessante |
| Sconfitta | Come si perde e se il giocatore capisce perché |
| Rigiocabilità | Cosa lo riporta domani: maestria, record, livelli, varietà delle mani |
| Superfici | Solo, contro l'Oste, online, quanti giocatori |
| Durata dichiarata | La stessa che compare in lobby |
| Controlli | Tocco, tastiera, mouse: quali e con quale priorità |
| Tono | Palette, riferimenti, atmosfera (coerente con `docs/dark-fantasy-design.md`) |
| Rischi | La parte che potrebbe non funzionare e come accorgersene presto |

Se la scheda non sta in una pagina, il gioco è troppo grande per un primo esperimento: ridurre a un loop, poi crescere.

## 4. Come si costruisce un minigioco in Taverna

- **Registrazione:** voce in `src/services/experienceCatalog.js` (`id`, `name`, `category`, `icon`, `players`, `duration`, `description`, `initFn`) e modulo `src/dashboards/minigames/<id>.js` con CSS dedicato accanto. La lobby importa il modulo per nome: niente registrazioni sparse altrove.
- **Servizi condivisi:** `recordMinigameResult` per vittorie/sconfitte/pareggi e record, `renderLevelLadder`/`unlockNextLevel` per la scala di livelli, `setExperienceTheme` e `updateSidebarContext` per tema e contesto, `renderOnlineModeButton`/`bindOnlineModeButton` per la modalità online, `seededRandom` per mani riproducibili nelle sfide.
- **Layout:** i due bersagli di riferimento sono **390×844** (telefono in verticale) e **844×390** (telefono in orizzontale). I tavoli di carte ruotano in orizzontale forzato (`src/services/tableOrientation.js`, `table-landscape.css`); gli altri giochi restano dritti. L'avviso di rotazione vive in alto a sinistra e non deve coprire comandi o carte.
- **Soglie misurate, non percepite:** testo di gioco mai sotto 10 px (obiettivo 10,4–11,5 px per etichette e HUD), comandi almeno 40 px di lato, 44 px sui touch quando c'è spazio, nessun overflow orizzontale, nessun comando sotto il bordo o dietro un pannello.

  **Eccezione dichiarata:** nella barra comandi touch della modalità compatta in orizzontale (844×390) i due tasti Riserva e Caduta restano a 34 px di altezza e 8,8 px di etichetta. È una scelta di compattazione precedente a questa soglia, verificata per non coprire il campo; va riaperta solo se si ridisegna quella barra. A 390×844 la soglia dei 10 px vale senza eccezioni.
- **Asset:** originali o con diritti verificati, registrati in `docs/`; per i giochi di carte valgono le regole di `AGENTS.md` sui simboli originali. Niente emoji al posto di icone di gioco.

## 5. Checklist di design (prima)

1. Il verbo è chiaro in una parola?
2. Il loop regge senza storia, senza premi, senza contenuti extra?
3. La prima scelta interessante arriva entro 30 secondi?
4. Il giocatore può perdere per un errore che capisce?
5. C'è un tradeoff reale (rischio/resa, tempo/qualità, informazione/bluff)?
6. La difficoltà ha gradini: si può imparare sbagliando a costo basso?
7. Ogni azione ha feedback immediato e specifico?
8. L'interfaccia mostra solo ciò che serve alla prossima decisione?
9. La partita si legge in un colpo d'occhio a 390 px di larghezza?
10. C'è un motivo per rigiocare diverso dalla fortuna?
11. La modalità online è la stessa partita, non un altro gioco?
12. Cosa tolgo se il tempo è metà?

## 6. Checklist di verifica (dopo)

- Partita reale (non demo) a 390×844 e a 844×390, con misure riportate: altezze di tavolo, larghezza delle carte, testi minimi, comandi coperti.
- `npm run lint`, `npm run test:view`, `npm run build` verdi.
- Nessun testo sotto 10 px, nessun comando fuori schermo o sotto l'avviso di rotazione, nessuno scroll orizzontale.
- La sconfitta spiega il perché; il record e i livelli si aggiornano; il ritorno alla lobby non lascia stato appeso.
- Suoni e animazioni rispettano `prefers-reduced-motion` e restano leggeri su telefono.

## 7. Anti-pattern

- **Sistemi nascosti:** producono superstizione, non profondità. Se il giocatore non può dedurre la regola, la regola non esiste.
- **Opzione dominante:** un comando sempre giusto è una scorciatoia attorno al design.
- **Muri di testo:** il tutorial è la prima situazione di gioco.
- **HUD decorativo:** se un numero non cambia una decisione, va tolto.
- **Difficoltà che punisce senza spiegare:** la frustrazione senza informazione è un bug di design.
- **Contenuto al posto del loop:** più mani, più livelli, più skin non salvano un loop inerte.

## 8. Lezioni dai giochi già in Taverna

| Gioco | Loop | Lezione trattenuta |
| --- | --- | --- |
| Blocchi arcani | vedo il pezzo → incastro → riga pulita | il feedback di riga pulita vale più di qualsiasi progressione; l'HUD deve stare sopra i 10 px per essere utile |
| SCIPPO! | leggo la mano → scelgo la presa → il tavolo risponde | con 390 px di altezza la mano va compattata, non tagliata: le carte 56×81 hanno salvato quattro comandi |
| Scopa / Briscola | gioco una carta → leggo il tavolo → incasso | i tavoli di carte vogliono l'orizzontale: ruotare è meglio che rimpicciolire tutto |
| Scala quaranta | pesco → combino → apro | un pannello online dentro la shell deve nascondersi in modalità compatta |
| Solitario | pesco → sistemo → scopro | spazio fra pile e barra: il vuoto è informazione, non spreco |
| Impostore / Numeri | leggo → parlo/indovino → verifico | i giochi sociali vivono di tempi e turni chiari, non di grafica |
| Scacchi / Dama / Tris | valuto → muovo → l'avversario risponde | i giochi a informazione completa restano dritti: la rotazione confonderebbe la scacchiera |

## 9. Combattimento, duelli e stanze (lezioni Hollow Knight)

Hollow Knight è il riferimento quando un gioco deve *far sentire* un colpo invece di contarlo soltanto.

- **Telegrafo prima del colpo.** Ogni attacco ha un preavviso visibile (posa, colore, suono) e una finestra di reazione onesta: almeno 350 ms su telefono, di più se il colpo toglie molto.
- **Ritmo attacco → finestra → punizione.** Dopo ogni colpo subito il giocatore deve poter dire cosa avrebbe dovuto fare. Danno senza spiegazione = frustrazione.
- **Economia dell'aggressione.** In Hollow Knight curare costa anima, e l'anima si guadagna colpendo: la fuga non è mai la scelta migliore. Lo stesso vale per qualsiasi risorsa di cura in Taverna.
- **Un nemico, una differenza.** Le varianti riusano lo scheletro e cambiano un solo parametro (ritmo, portata, direzione). Insegnano più di nemici nuovi e costano una frazione.
- **La stanza insegna.** Prima la meccanica da sola, in sicurezza; poi la combinazione; poi il twist. Il boss riusa ciò che la stanza ha già insegnato.
- **Coerenza, non prevedibilità.** Stessa mano visiva ovunque, ma il giocatore non deve capire in anticipo quando arriva il riposo o la ricompensa.
- **Atmosfera come informazione.** Buio, suono e spazio dicono dove si è al sicuro: non sono decorazione.
- **Picchi e respiro.** Dopo una prova dura serve una pausa, altrimenti il picco successivo non si sente.

## 10. Difficoltà e accessibilità (Celeste, linee guida Xbox)

- La difficoltà è soggettiva: **preset multipli** (idealmente quattro o più) e cambio **in qualsiasi momento** senza perdere progressi.
- L'aiuto conserva il nucleo — lettura, scelte, percorso — e riduce solo la barriera meccanica: velocità più bassa, tempi più larghi, invulnerabilità. Non "il gioco gioca da solo".
- Etichette non paternalistiche e nessun premio negato a chi usa l'aiuto.
- Ritentare deve costare poco: riavvio immediato, checkpoint ravvicinati, animazioni di sconfitta brevi.
- Nei duelli della Taverna questo si traduce in: livello di difficoltà dichiarato, tempo di risposta visibile, nessuna attesa fra gli scontri.

## 11. Progettare un duello leggibile su un telefono

1. Una sola informazione nuova per scontro: la runa avversaria, il suo tempo, il contraccolpo.
2. Il pericolo è sempre visibile nello stesso punto dello schermo; mai sotto il pollice.
3. Il punteggio del colpo (precisione, tempo, margine) compare **nel momento del contatto**, non dopo.
4. Chi perde uno scambio sa perché: runa sbagliata, troppo lento, tratto impreciso — tre cause, tre messaggi diversi.
5. La partita si chiude in meno di due minuti e la rivincita parte con un tocco.

## 12. Come usare questo manuale

Ogni nuova proposta di gioco parte dalla scheda del punto 3, passa la checklist del punto 5 prima di scrivere codice, e chiude con le misure del punto 6. Le decisioni nuove che funzionano si aggiungono al punto 8, così la prossima volta si parte da lì invece che da zero.

Riferimenti usati per questo manuale: *The Art of Game Design* (Schell), MDA, il lavoro di Alexander Brazie sul core loop, la ricerca su juice e game feel (DiGRA 2018, IEEE ToG 2021), GMTK, Unity Learn, le analisi di Hollow Knight (Team Cherry, GameDev.net, Jason de Heras sul design dei nemici), il modello assist di Celeste e le linee guida Xbox sull'accessibilità (XAG 108).
