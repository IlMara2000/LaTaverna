# Oracolo vocale

Il menu contiene l’attivazione sotto Musica. Il pulsante si trasforma in un puppet CSS originale ametista, mantenendo menu, tastiera e trascinamento. La pagina `/oracolo` conserva chat e allegati esistenti.

- «Non ascoltarmi» / «Smetti di ascoltare»: attesa del richiamo, microfono ancora acceso.
- «Oracolo mi serve il tuo aiuto»: riprende la conversazione.
- «Oracolo spegniti» / «Disattiva Oracolo», pulsante nel menu o nei sottotitoli: chiude ascolto, annulla richieste e cancella il contesto.
- Cambio scheda, background, uscita e reinizializzazione della navbar interrompono l’ascolto. Non si riattiva automaticamente.

## Audio e dati

Si usa esclusivamente SpeechRecognition con `processLocally = true` e italiano installato; nessun ripiego automatico su riconoscimento remoto. Il browser può scaricare il pacchetto italiano durante l’attivazione. Browser e sistema operativo controllano permessi e disponibilità: un’autorizzazione non viene simulata o memorizzata dall’app e può essere richiesta nuovamente dopo una revoca/scadenza. HTTPS o localhost necessari.

Non viene usato MediaRecorder e non si salvano audio o trascrizioni su disco. Il parlato in attesa viene scartato dal controller, salvo i comandi. Le domande attive e fino a otto messaggi di contesto vengono inviati all’endpoint Oracolo esistente e al gateway FreeLLMAPI, con autenticazione e quote esistenti. Questo è contesto temporaneo, non addestramento né memoria permanente; valgono le politiche del provider per le richieste ricevute.

AudioManager gestisce la sintesi vocale italiana al volume musicale e riduce temporaneamente il volume della colonna sonora al 18%, ripristinando il valore corrente dopo voce, errore o annullamento. Musica OFF non disattiva una conversazione vocale avviata esplicitamente. Durante sintesi ed elaborazione il riconoscimento è sospeso, quindi i comandi vocali non interrompono una risposta in corso: usare Spegni microfono o il menu. I sottotitoli mostrano gruppi di nove parole per circa un secondo a parola, senza bloccare la pagina. Le preferenze di movimento ridotto sono rispettate.

## Verifica

`node --test scripts/tests/oracle-voice.test.mjs scripts/tests/music-player.test.mjs`

I test simulano riconoscitore, voce e AI: controllano comandi, attesa, contesto, browser non supportato, permesso negato e risposte tardive. La qualità del riconoscimento italiano, i permessi reali e l’audio fisico richiedono una prova sul dispositivo con browser compatibile.

Riferimento: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API#on-device_speech_recognition
