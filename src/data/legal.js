// Dati del titolare: COMPLETARE prima della pubblicazione.
// Le stringhe tra parentesi quadre sono segnaposto voluti: non inventare
// ragione sociale, indirizzo, P.IVA o PEC.
export const LEGAL = Object.freeze({
    serviceName: 'La Taverna',
    owner: '[RAGIONE SOCIALE O NOME E COGNOME DEL TITOLARE]',
    address: '[INDIRIZZO COMPLETO]',
    vat: '[PARTITA IVA / CODICE FISCALE]',
    email: 'privacy@lataverna.xyz',
    pec: '[INDIRIZZO PEC, SE DISPONIBILE]',
    abuse: 'segnalazioni@lataverna.xyz',
    shop: 'ordini@lataverna.xyz',
    updated: '1 novembre 2026'
});

const ownerBlock = `
    <p><strong>${LEGAL.serviceName}</strong><br>
    Titolare del trattamento: ${LEGAL.owner}<br>
    Sede: ${LEGAL.address}<br>
    P.IVA / C.F.: ${LEGAL.vat}<br>
    Email: <a href="mailto:${LEGAL.email}">${LEGAL.email}</a><br>
    PEC: ${LEGAL.pec}</p>
`;

const nav = `
    <nav class="legal-nav" aria-label="Documenti legali">
        <a href="/privacy">Privacy</a>
        <a href="/termini">Termini</a>
        <a href="/cookie">Cookie e terzi</a>
        <a href="/community">Community</a>
        <a href="/bottega/condizioni">Condizioni Bottega</a>
        <a href="/segnala">Segnala contenuto</a>
    </nav>
`;

const privacy = `
    <header class="legal-hero">
        <p class="legal-eyebrow">INFORMATIVA</p>
        <h1>Privacy</h1>
        <p>Come trattiamo i dati personali su ${LEGAL.serviceName}. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Titolare del trattamento</h2>
            ${ownerBlock}
            <p>Per qualsiasi richiesta puoi scrivere a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>.</p>
        </section>

        <section>
            <h2>2. Quali dati raccogliamo</h2>
            <ul>
                <li><strong>Account:</strong> email, password (conservata in forma cifrata dal fornitore di autenticazione), identificativo account, provider di accesso (email o Discord), data di creazione e conferma email.</li>
                <li><strong>Ospite:</strong> se scegli l’accesso ospite, viene creato un account anonimo con un identificativo tecnico. I dati restano separati e legati a quella sessione.</li>
                <li><strong>Profilo:</strong> nome visualizzato, titolo, avatar e preferenze di interfaccia.</li>
                <li><strong>Contenuti di gioco:</strong> personaggi, sessioni, token, mappe, chat, note, collezioni di carte, mazzi, wantlist e metadati dei PDF della biblioteca.</li>
                <li><strong>Bottega:</strong> nome, email, telefono (facoltativo), modalità di consegna, note e riepilogo dell’ordine.</li>
                <li><strong>AI:</strong> il testo delle domande, le immagini allegate e il contesto di sessione che scegli di inviare all’Oracolo. Le quote giornaliere sono registrate come conteggi, senza conservare prompt o immagini nei nostri archivi.</li>
                <li><strong>Dati tecnici:</strong> indirizzo IP, user agent, log di sicurezza e diagnostica conservati dall’infrastruttura di hosting; preferenze salvate nel browser (localStorage).</li>
                <li><strong>Voce facoltativa:</strong> se attivi l’Oracolo vocale, il browser accede al microfono e trascrive la frase tramite il proprio servizio di riconoscimento vocale; l’audio non viene salvato da noi.</li>
            </ul>
        </section>

        <section>
            <h2>3. Finalità e basi giuridiche</h2>
            <ul>
                <li><strong>Erogare il servizio</strong> (account, giochi, sessioni, biblioteca, Bottega): esecuzione del contratto, art. 6.1.b GDPR.</li>
                <li><strong>Sicurezza, prevenzione di abusi e diagnostica</strong>: interesse legittimo del titolare, art. 6.1.f GDPR.</li>
                <li><strong>Obblighi di legge</strong> (ad esempio fiscali o su richiesta dell’autorità): art. 6.1.c GDPR.</li>
                <li><strong>Pubblicazione di un PDF in Bacheca e invio facoltativo di immagini all’Oracolo</strong>: consenso, art. 6.1.a GDPR. Puoi revocare il consenso in qualsiasi momento rendendo privato il libro o non usando la funzione.</li>
                <li><strong>Comunicazioni di servizio</strong>: esecuzione del contratto o interesse legittimo; le comunicazioni promozionali, se introdotte, richiederanno consenso separato.</li>
                <li><strong>Microfono e trascrizione vocale</strong>: consenso, art. 6.1.a GDPR, prestato attivando l’Oracolo vocale; puoi spegnerlo in qualsiasi momento.</li>
            </ul>
        </section>

        <section>
            <h2>4. Destinatari e fornitori</h2>
            <p>Trattiamo i dati con fornitori che agiscono come responsabili del trattamento o titolari autonomi, secondo i rispettivi ruoli:</p>
            <ul>
                <li><strong>Supabase</strong> — autenticazione, database e archiviazione file.</li>
                <li><strong>Vercel</strong> — hosting del sito e funzioni server.</li>
                <li><strong>Groq</strong> — modello AI dell’Oracolo; riceve la domanda, l’immagine allegata e il contesto inviato.</li>
                <li><strong>Servizio vocale del browser</strong> (ad esempio Google o Apple) — trascrizione delle frasi quando attivi l’Oracolo vocale; l’audio non passa dai nostri server.</li>
                <li><strong>Discord</strong> — solo se scegli l’accesso con Discord.</li>
                <li><strong>Scryfall</strong> — dati e immagini delle carte Magic, richiesti dal browser quando usi la sezione carte.</li>
            </ul>
            <p>Non vendiamo dati personali e non li usiamo per pubblicità comportamentale. I fornitori possono trattare dati anche fuori dall’Unione Europea; in tal caso il trasferimento avviene sulla base di clausole contrattuali standard, decisioni di adeguatezza o altri strumenti previsti dagli artt. 44-49 GDPR.</p>
        </section>

        <section>
            <h2>5. Conservazione</h2>
            <ul>
                <li>Dati dell’account e contenuti di gioco: fino alla cancellazione dell’account o del contenuto.</li>
                <li>PDF e metadati della biblioteca: fino alla cancellazione del libro o dell’account.</li>
                <li>Ordini della Bottega: per il tempo necessario a gestire la richiesta e ad adempiere agli obblighi fiscali e contabili applicabili.</li>
                <li>Conteggi delle quote AI: fino a 90 giorni, in forma aggregata per giorno e account.</li>
                <li>Log tecnici: secondo le impostazioni di conservazione dei fornitori di hosting e sicurezza.</li>
            </ul>
            <p>Se un contenuto è oggetto di segnalazione o contenzioso, possiamo conservarlo più a lungo nella misura necessaria a tutelare i nostri diritti.</p>
        </section>

        <section>
            <h2>6. I tuoi diritti</h2>
            <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione, opposizione e portabilità dei dati, oltre a revocare il consenso. Puoi esercitare i diritti dalle Impostazioni (“Esporta i miei dati” e “Elimina account”) o scrivendo a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>. Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>).</p>
        </section>

        <section>
            <h2>7. Minori</h2>
            <p>Il servizio non è destinato a bambini sotto i 14 anni senza il consenso di chi esercita la responsabilità genitoriale. Se hai meno di 14 anni, non creare un account senza l’autorizzazione di un genitore o tutore. La Bottega è riservata a chi ha almeno 18 anni. Se veniamo a conoscenza di un account di un minore di 14 anni creato senza consenso, lo rimuoviamo.</p>
        </section>

        <section>
            <h2>8. Sicurezza</h2>
            <p>Adottiamo misure tecniche e organizzative ragionevoli: isolamento dei dati per account tramite row level security, cifratura in transito, controllo degli accessi e minimizzazione. Nessun sistema è sicuro al 100%; se rilevi una vulnerabilità scrivi a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>.</p>
        </section>

        <section>
            <h2>9. Modifiche</h2>
            <p>Possiamo aggiornare questa informativa. Le modifiche sostanziali saranno comunicate nell’app o via email. La versione vigente è sempre pubblicata a questa pagina.</p>
        </section>
    </div>
`;

const terms = `
    <header class="legal-hero">
        <p class="legal-eyebrow">CONDIZIONI D’USO</p>
        <h1>Termini e condizioni</h1>
        <p>Regole per usare ${LEGAL.serviceName}. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Il servizio</h2>
            <p>${LEGAL.serviceName} offre giochi, strumenti per giochi di ruolo, una biblioteca personale, una Bottega e un assistente AI. Il servizio è fornito “così com’è”; possiamo modificare, sospendere o chiudere funzionalità, avvisando quando ragionevolmente possibile.</p>
        </section>

        <section>
            <h2>2. Account e sicurezza</h2>
            <p>Devi fornire dati corretti, custodire le credenziali e non condividere l’account. Se rilevi un accesso non autorizzato, scrivi subito a <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>. Puoi cancellare l’account dalle Impostazioni.</p>
        </section>

        <section>
            <h2>3. Età</h2>
            <p>Per usare il servizio devi avere almeno 14 anni o il consenso di chi esercita la responsabilità genitoriale. La Bottega è riservata a chi ha almeno 18 anni. Possiamo chiedere una conferma e sospendere account che non rispettano questi requisiti.</p>
        </section>

        <section>
            <h2>4. Condotta</h2>
            <p>Non puoi caricare o condividere contenuti illeciti, diffamatori, minacciosi, molesti, discriminatori, sessualmente espliciti con minori, malware, spam, dati personali di terzi senza base giuridica, opere coperte da copyright senza autorizzazione o contenuti che violino diritti altrui. Non puoi tentare di aggirare le misure di sicurezza, accedere ad account altrui, automatizzare abusivamente il servizio o rivendere l’accesso senza accordo scritto.</p>
        </section>

        <section>
            <h2>5. Contenuti degli utenti</h2>
            <p>Mantieni la titolarità dei tuoi contenuti. Ci concedi una licenza non esclusiva, gratuita e limitata a ospitare, riprodurre tecnicamente, mostrare e moderare i contenuti necessari a erogare il servizio. Sei responsabile di ciò che pubblichi e dichiari di avere i diritti necessari. I PDF pubblicati in Bacheca sono visibili a chiunque: pubblicali solo se hai il diritto di distribuirli. Possiamo rimuovere contenuti segnalati o manifestamente illeciti e sospendere gli account che violano ripetutamente queste regole.</p>
        </section>

        <section>
            <h2>6. Proprietà intellettuale e marchi</h2>
            <p>Il codice, il marchio, l’interfaccia e i contenuti originali di ${LEGAL.serviceName} appartengono ai rispettivi titolari. ${LEGAL.serviceName} non è affiliata a Wizards of the Coast, Hasbro, Nintendo, The Pokémon Company, Konami, Shueisha o Toei. D&amp;D, Dungeons &amp; Dragons, Magic: The Gathering, Pokémon, Yu-Gi-Oh! e One Piece sono marchi dei rispettivi titolari, usati solo per identificare i giochi. Non distribuiamo copie scaricabili di manuali o carte; le immagini delle carte sono fornite da Scryfall e restano dei rispettivi titolari.</p>
        </section>

        <section>
            <h2>7. Oracolo e intelligenza artificiale</h2>
            <p>L’Oracolo è un assistente AI fornito tramite Groq. Le risposte possono essere inesatte, incomplete o non aggiornate e non sostituiscono i manuali ufficiali, un master umano o una consulenza professionale. Non usare l’Oracolo per decisioni legali, mediche, finanziarie o di sicurezza. Quando invii una domanda, un’immagine o il contesto di sessione, quei dati vengono trasmessi al fornitore AI.</p>
        </section>

        <section>
            <h2>8. Bottega</h2>
            <p>La Bottega presenta prodotti e raccoglie richieste d’ordine. Non eseguiamo pagamenti online. Prezzi, disponibilità, spedizione e pagamento sono concordati con il venditore prima della conclusione. Le condizioni applicabili sono nella pagina <a href="/bottega/condizioni">Condizioni Bottega</a>.</p>
        </section>

        <section>
            <h2>9. Sospensione e responsabilità</h2>
            <p>Possiamo sospendere o chiudere un account in caso di violazione, rischio per altri utenti o obbligo di legge. Nei limiti consentiti dalla legge, non siamo responsabili per contenuti di terzi, interruzioni, perdita di dati non salvati o uso improprio del servizio. Restano fermi i diritti inderogabili dei consumatori.</p>
        </section>

        <section>
            <h2>10. Legge applicabile e contatti</h2>
            <p>Si applica la legge italiana, con salvezza delle norme inderogabili a tutela dei consumatori. Per reclami: <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>. Per segnalare contenuti illeciti: <a href="mailto:${LEGAL.abuse}">${LEGAL.abuse}</a>.</p>
        </section>
    </div>
`;

const cookies = `
    <header class="legal-hero">
        <p class="legal-eyebrow">COOKIE E TERZE PARTI</p>
        <h1>Cookie e servizi esterni</h1>
        <p>Cosa salviamo nel browser e quali servizi esterni vengono contattati. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Cookie e analytics</h2>
            <p>Non usiamo cookie di profilazione, pubblicità comportamentale o analytics di terze parti. Non è quindi necessario un banner cookie: nel browser salviamo solo dati tecnici necessari al funzionamento del servizio.</p>
        </section>
        <section>
            <h2>2. Memorizzazione tecnica nel browser</h2>
            <p>Usiamo localStorage per mantenere la sessione Supabase, le preferenze di interfaccia, l’ultima sezione visitata e lo stato del carrello. Sono dati tecnici necessari al funzionamento; puoi cancellarli dalle impostazioni del browser, ma alcune funzioni smetteranno di funzionare.</p>
        </section>
        <section>
            <h2>3. Servizi esterni</h2>
            <ul>
                <li><strong>Supabase</strong> — autenticazione, database, storage e realtime.</li>
                <li><strong>Vercel</strong> — hosting e funzioni server.</li>
                <li><strong>Groq</strong> — elaborazione delle richieste all’Oracolo.</li>
                <li><strong>Discord</strong> — accesso OAuth, solo se lo scegli.</li>
                <li><strong>Scryfall</strong> — dati e immagini delle carte, contattato dal browser quando apri la sezione carte.</li>
                <li><strong>Servizio vocale del browser</strong> — riconoscimento della voce quando usi l’Oracolo vocale; non riceve dati da noi se la funzione è spenta.</li>
            </ul>
            <p>I font e le immagini di interfaccia sono serviti dal nostro dominio; non carichiamo Google Fonts. Se scegli di collegare un avatar, un ritratto o una mappa tramite URL esterno, il browser contatta direttamente quel server: usa solo indirizzi di cui ti fidi.</p>
        </section>
        <section>
            <h2>4. Come limitare i servizi esterni</h2>
            <p>Puoi usare il sito senza login Discord e senza la sezione carte: in quel caso il browser non contatta Discord o Scryfall. L’Oracolo richiede invece l’invio della domanda a Groq. Per informazioni sul trattamento: <a href="/privacy">Informativa privacy</a>.</p>
        </section>
    </div>
`;

const community = `
    <header class="legal-hero">
        <p class="legal-eyebrow">REGOLE DELLA TAVERNA</p>
        <h1>Regolamento community</h1>
        <p>Regole di convivenza per chat, profili, Bacheca e contenuti condivisi. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Rispetto</h2>
            <p>Tratta le altre persone con rispetto. Non sono ammessi insulti, minacce, molestie, odio, discriminazione, doxxing, impersonificazione o intimidazione.</p>
        </section>
        <section>
            <h2>2. Contenuti vietati</h2>
            <ul>
                <li>Contenuti illegali o che violano diritti di terzi.</li>
                <li>Opere coperte da copyright caricate senza autorizzazione.</li>
                <li>Malware, phishing, link ingannevoli, spam o tentativi di frode.</li>
                <li>Materiale sessualmente esplicito che coinvolge minori, in qualunque forma.</li>
                <li>Dati personali di terzi condivisi senza base giuridica.</li>
                <li>Contenuti che rivelano informazioni riservate di altre persone o di un tavolo senza consenso.</li>
            </ul>
        </section>
        <section>
            <h2>3. Contenuti tuoi e contenuti condivisi</h2>
            <p>Sei responsabile dei contenuti che pubblichi. I PDF pubblicati in Bacheca sono visibili a chiunque: pubblicali solo se hai il diritto di distribuirli. Le note del Master e i segreti di una campagna non devono essere condivisi con i giocatori senza consenso.</p>
        </section>
        <section>
            <h2>4. Moderazione</h2>
            <p>Puoi segnalare un contenuto a <a href="mailto:${LEGAL.abuse}">${LEGAL.abuse}</a> indicando URL, motivo e, se possibile, prova del diritto violato. Valutiamo le segnalazioni e possiamo rimuovere contenuti, limitare funzioni o sospendere account. Per le decisioni di moderazione puoi chiedere un riesame rispondendo alla comunicazione.</p>
        </section>
        <section>
            <h2>5. Recidiva</h2>
            <p>Violazioni ripetute o gravi possono portare alla chiusura dell’account. Conserviamo le segnalazioni e le decisioni per il tempo necessario a gestire recidiva e contenziosi.</p>
        </section>
    </div>
`;

const seller = `
    <header class="legal-hero">
        <p class="legal-eyebrow">BOTTEGA DEL VIANDANTE</p>
        <h1>Condizioni di vendita</h1>
        <p>Informazioni sul venditore e sulle richieste d’ordine. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Venditore</h2>
            ${ownerBlock}
            <p>Email per ordini e assistenza: <a href="mailto:${LEGAL.shop}">${LEGAL.shop}</a>.</p>
        </section>
        <section>
            <h2>2. Come funziona la richiesta d’ordine</h2>
            <p>La Bottega non esegue pagamenti online. Inviando una richiesta, proponi l’acquisto di uno o più prodotti; il venditore ti ricontatta per confermare disponibilità, prezzo finale, spedizione o ritiro e modalità di pagamento. Il contratto si conclude solo con la conferma del venditore.</p>
        </section>
        <section>
            <h2>3. Prezzi, spese e disponibilità</h2>
            <p>I prezzi sono indicati in euro e, ove applicabile, comprensivi di IVA. Le spese di spedizione e gli eventuali costi accessori sono comunicati prima della conclusione. I prodotti “su richiesta” o “prezzo da concordare” non sono offerte vincolanti fino alla conferma.</p>
        </section>
        <section>
            <h2>4. Consegna</h2>
            <p>Modalità e tempi di consegna o ritiro sono concordati nella conferma. I tempi indicati sono stime e possono dipendere da disponibilità, produzione artigianale o corriere.</p>
        </section>
        <section>
            <h2>5. Diritto di recesso</h2>
            <p>Se sei un consumatore, hai diritto di recedere entro 14 giorni dalla ricezione del prodotto, senza dover indicare il motivo, salvo le eccezioni previste dalla legge (ad esempio prodotti personalizzati o sigillati aperti). Per esercitare il recesso scrivi a <a href="mailto:${LEGAL.shop}">${LEGAL.shop}</a>. Il rimborso avviene con le stesse modalità di pagamento, entro i termini di legge, dopo la restituzione o la prova dell’invio.</p>
        </section>
        <section>
            <h2>6. Garanzia e reclami</h2>
            <p>Si applicano le garanzie legali previste dal Codice del Consumo. Per difetti, ritardi o reclami scrivi a <a href="mailto:${LEGAL.shop}">${LEGAL.shop}</a> indicando il riferimento dell’ordine.</p>
        </section>
        <section>
            <h2>7. Privacy</h2>
            <p>I dati inseriti sono trattati per gestire la richiesta e adempiere agli obblighi di legge. Vedi l’<a href="/privacy">Informativa privacy</a>.</p>
        </section>
    </div>
`;

const takedown = `
    <header class="legal-hero">
        <p class="legal-eyebrow">TUTELA DEI CONTENUTI</p>
        <h1>Segnala un contenuto</h1>
        <p>Procedura per segnalare contenuti illeciti o lesivi di diritti. Ultimo aggiornamento: ${LEGAL.updated}.</p>
    </header>
    ${nav}
    <div class="legal-content">
        <section>
            <h2>1. Dove scrivere</h2>
            <p>Invia la segnalazione a <a href="mailto:${LEGAL.abuse}">${LEGAL.abuse}</a>. Per questioni di privacy: <a href="mailto:${LEGAL.email}">${LEGAL.email}</a>.</p>
        </section>
        <section>
            <h2>2. Cosa indicare</h2>
            <ul>
                <li>Il tuo nome, recapito e, se agisci per un titolare di diritti, il ruolo e la prova dell’incarico.</li>
                <li>L’URL o la descrizione precisa del contenuto contestato.</li>
                <li>Il diritto che ritieni violato (copyright, marchio, privacy, diffamazione, altro) e una spiegazione.</li>
                <li>La prova del diritto o dell’autorizzazione, se disponibile.</li>
                <li>Una dichiarazione in buona fede che le informazioni sono accurate.</li>
            </ul>
        </section>
        <section>
            <h2>3. Come gestiamo la segnalazione</h2>
            <p>Verifichiamo la segnalazione e, se il contenuto è manifestamente illecito o lesivo, lo rimuoviamo o lo rendiamo non accessibile, informando l’autore quando possibile. Per controversie complesse possiamo chiedere integrazioni o un provvedimento dell’autorità competente. Conserviamo una traccia della segnalazione e della decisione.</p>
        </section>
        <section>
            <h2>4. Reclamo dell’autore</h2>
            <p>Chi ha caricato il contenuto può chiedere un riesame scrivendo allo stesso indirizzo, indicando le ragioni per cui ritiene che il contenuto sia lecito. Valutiamo il reclamo e possiamo ripristinare il contenuto se la segnalazione non è fondata.</p>
        </section>
        <section>
            <h2>5. Recidiva</h2>
            <p>Gli account che caricano ripetutamente contenuti illeciti possono essere sospesi o chiusi. I manuali e le opere non autorizzate non sono ammessi.</p>
        </section>
    </div>
`;

export const LEGAL_PAGES = Object.freeze({
    privacy: { title: 'Privacy', html: privacy },
    terms: { title: 'Termini e condizioni', html: terms },
    cookies: { title: 'Cookie e servizi esterni', html: cookies },
    community: { title: 'Regolamento community', html: community },
    seller: { title: 'Condizioni Bottega', html: seller },
    takedown: { title: 'Segnala un contenuto', html: takedown }
});

export const LEGAL_INCOMPLETE = LEGAL.owner.includes('[') || LEGAL.address.includes('[') || LEGAL.vat.includes('[');
