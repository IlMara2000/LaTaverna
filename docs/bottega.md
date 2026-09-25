# Bottega del Viandante

Catalogo e ordini vivono su Supabase. I quattro concept originali sono conservati,
con prezzo e disponibilità da concordare. Non sono prezzi zero né scorte inventate.

## Gestione

Il pulsante **Gestisci bottega** compare solo per un account presente in
`shop_managers`. Il proprietario indicato nella richiesta è stato abilitato dopo
aver verificato il suo account Auth. I ruoli non provengono dal browser o da
`user_metadata`. Non aggiungere controlli basati soltanto sull'email nel frontend.

Il master può caricare foto JPG/PNG/WebP fino a 5 MB, creare/modificare prodotti,
lasciarli in bozza, pubblicarli, impostare prezzo/scorte e aggiornare lo stato
degli ordini. Prezzo vuoto = preventivo; scorte vuote = su richiesta; zero =
non disponibile. Mettere un prodotto in bozza lo ritira dal catalogo mantenendo
intatti gli ordini precedenti. Le scorte non si riducono quando arriva una richiesta:
la vendita e il pagamento vengono concordati successivamente.

## Ordini e email

Occorre un account verificato. `place_shop_order` controlla il catalogo sul server,
conserva la fotografia di nomi/prezzi/quantità, limita gli invii e rende idempotenti
le ripetizioni della stessa richiesta. Nessuna scrittura diretta sugli ordini dal
cliente; ogni cliente può leggere solo i propri ordini, il master tutti.

Attualmente l'ordine viene salvato e viene preparata un'email al proprietario
attraverso `mailto:`. Il cliente deve effettivamente inviarla dalla sua app email.
La conferma lo dichiara, senza fingere un invio automatico. Il collegamento resta
nello storico ordini, insieme al riepilogo copiabile. Nessun servizio SMTP o
Resend è configurato: per notifiche automatiche serviranno un mittente verificato,
credenziali server e una coda con retry/idempotenza, mai una chiave nel frontend.

## Verifica

- `node --test scripts/tests/*.test.mjs`
- `scripts/tests/sql/shop-commerce.sql`: controlli RLS, master/base, immagini,
  snapshot prezzi, quantità, richieste duplicate e isolamento ordini. Tutti i dati
  di prova sono annullati dal rollback finale.
- Prove UI Chromium e WebKit: nuovo prodotto, prezzo/scorte/foto, filtri, carrello,
  checkout, conferma email, storico e stato; viewport 360/390/844 px e tastiera.
- `npm run build`

La migration non assegna privilegi a un'email hardcoded. Su un altro ambiente
assegnare `shop_managers.user_id` all'identità Auth verificata del proprietario
tramite un canale amministrativo, senza introdurre una registrazione master pubblica.
