# Ripristino GoCardless

## Configurazione verificata

Verifica del 4 ottobre 2026: i tre secret NORDIGEN_SECRET_ID, NORDIGEN_SECRET_KEY ed ENCRYPTION_KEY sono configurati sul Worker attuale `thinkin-about-money`, dopo autorizzazione esplicita dell’utente. Autenticazione GoCardless verificata; Fineco/Revolut disponibili, Trade Republic assente dal catalogo IT/DE. Automazione bancaria disabilitata. Manca RESEND_API_KEY per il recupero password. Il vecchio Worker resta in manutenzione senza cron.

Il consenso sui conti reali e la prima sincronizzazione non sono ancora stati completati. Le istruzioni locali sotto descrivono la procedura già eseguita: non rigenerare le chiavi per collegare i conti.

## Preparazione locale

1. Nel [portale Bank Account Data](https://bankaccountdata.gocardless.com/), sezione **User Secrets**, crea nuove credenziali. Conserva ID e chiave nel gestore password; non inviarle in chat.
2. Dalla worktree esegui `python3 scripts/configure-local-banking.py`. Il prompt nasconde i valori e crea `.dev.vars` ignorato da Git con permessi 0600; se esiste già, non lo sovrascrive. Genera anche una chiave AES nuova per il formato verificato in chiaro. Non usarlo per ruotare dati cifrati in un altro ambiente.
3. Conserva anche ENCRYPTION_KEY nel gestore password. Nessun segreto viene pubblicato dallo script e nessun Worker viene modificato.
4. Verificare il catalogo autenticato IT/DE: Fineco, Revolut e disponibilità Trade Republic. Il selettore pubblico non confermava Trade Republic; non inventare supporto sulla base dei mock.

## Consenso e prima sincronizzazione

I tre valori sono già configurati e le migrazioni applicate. Dalla pagina Banche selezionare **+ Collega Nuovo Conto**, scegliere Fineco o Revolut e completare il consenso sul sito della banca. Ripetere per l’altro conto. Il callback richiede sessione del proprietario e verifica riferimento, banca e termini del consenso remoto. Le scadenze derivano dall'accettazione del consenso e non dalla data del callback. I dati storici riconoscibili vengono cifrati quando il consenso viene verificato.

La prima sincronizzazione senza intervallo usa lo storico concesso; le successive ripartono dall'ultimo giorno coperto con sette giorni di rilettura. Un conto fallito non avanza; 429 blocca anche la chiamata successiva ai dettagli. Gli intervalli fuori dalla disponibilità storica sono segnalati. Una selezione esplicita dell'utente definisce il periodo desiderato.

I movimenti EUR sono **candidati**, esclusi dai totali fino a conferma. La UI permette di importarli, associarli a spese dello stesso utente/data/importo/tipo o ignorarli. Questa scelta prudente evita doppioni con lo storico Excel/manuale; l'automazione prepara candidati e non approva spese. Identità mancanti preservano anche righe identiche distinte, ma richiedono verifica esplicita: un hash non è prova di unicità bancaria. Le altre valute sono escluse con conteggio.

Prova live richiesta: intervallo limitato scelto dall'utente, review, secondo sync invariato, confronto conti/totali e prova ripresa. Le prove di guasto sono sintetiche. Non dichiarare le banche ripristinate finché il consenso/import reale non riesce.

Fonte: [GoCardless quickstart](https://docs.gocardless.com/docs/bank-account-data/quickstart-guide).
