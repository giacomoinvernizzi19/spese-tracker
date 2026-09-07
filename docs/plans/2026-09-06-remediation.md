# Piano di consolidamento P1 / P2 / P3

Data: 6 settembre 2026. Stato: esecuzione avviata; primo blocco P1 verificato localmente, produzione invariata.

## Obiettivo e decisioni confermate

Rendere affidabili le funzioni esistenti di Thinkin' About Money, mantenendo Astro, Svelte e Cloudflare Workers/D1. Nessuna riscrittura generale o nuova piattaforma.

- Fineco e Revolut devono essere ripristinate in **P1**.
- L'utente conferma di avere ancora accesso al portale GoCardless Bank Account Data.
- Per ora si gestiscono **solo euro**. Movimenti in altre valute devono essere esclusi con esito visibile; nessuna conversione implicita.
- GitHub deve seguire il lavoro tramite commit, PR e documentazione aggiornati.
- La PR iniziale #1 contiene solo il piano; il branch di implementazione prepara i fix. Migrazioni remote e deploy restano fasi successive; per il rilascio in produzione si presenta il risultato verificato e si acquisisce l'approvazione.

## Baseline verificata

Verifica in sola lettura del codice, GitHub, configurazione Cloudflare e schema D1:

- `main` remoto e HEAD locale: `a9778f6852efa8c18d712a0395d900b637b689b1`.
- Il checkout originale è in detached HEAD; contiene modifiche preesistenti a `PROJECT.md`, `package-lock.json`, `src/pages/registrati.astro`, `src/pages/reset-password.astro`. Non sono incluse in questa PR.
- Ultima versione pubblicata rilevata: `81db52de-4f06-425f-bf5f-27a2fb13efad`, 14 maggio 2026. La corrispondenza integrale tra bundle pubblicato e sorgenti deve essere verificata prima del prossimo deploy.
- Le API budget richiedono `period`; il database remoto conserva `month` e `year`.
- Il vincolo di `transactions.source` nel database remoto ammette `manual`, `import`, `bank`, ma non `recurring`.
- La lista dei secret del Worker restituisce solo `CRON_SECRET`. Le integrazioni bancarie, la cifratura e Resend richiedono verifica e recupero della configurazione.
- Esistono connessioni bancarie storiche con scadenze passate; lo stato locale `linked` non dimostra un consenso valido. Non è stata effettuata una nuova sincronizzazione nella review.
- Il cron HTTP contiene ricorrenze e pulizia, non sincronizzazione bancaria. Non è presente il gestore `scheduled()` nel sorgente o nell'entrypoint dell'adapter installato.
- `tsc --noEmit --incremental false` fallisce; mancano tipi Cloudflare/Locals, il riferimento Capacitor non si risolve e ci sono errori in cifratura/client bancario. Non è stata trovata una suite di test.
- Schema base più migrazioni, eseguiti su SQLite in memoria, riproducono la colonna budget mancante e il rifiuto di `source='recurring'`. Questo non sostituisce una prova nel runtime D1.

Precedenti da conservare: `5fda96f` e `8980d48` per auth/cifratura/rate limit; `851e9f9` per le funzioni v1.5; `d6f598d` per sincronizzazione dei grafici e cache. Ogni PR dovrà citare il precedente pertinente e motivare eventuali deviazioni.

## P1 — dati affidabili e banche nuovamente operative

### PR 1 — baseline, schema riproducibile e migrazioni sicure

**Avanzamento:** migrazioni, recupero UI password, API budget e test preparati. Prove locali SQLite/D1/build/Playwright passate. Ripristino backup provato in isolamento; tracking e migrazione remota ancora da eseguire dopo approvazione.

**Scopo:** portare database e codice allo stesso contratto senza perdere dati.

1. Riconciliare le quattro modifiche locali con lo storico del deploy. Recuperare in commit dedicati soltanto le modifiche verificate; nessun reset, stash indiscriminato o staging dell'intero checkout.
2. Censire schema, migrazioni effettive, indici, vincoli e budget esistenti. Non fidarsi soltanto della tabella di tracking: alcune migrazioni sono state eseguite tramite SQL diretto.
3. Preparare un backup e provarne il ripristino su database isolato prima di qualsiasi migrazione remota. Il backup resta fuori da GitHub.
4. Definire una baseline non distruttiva per nuovi database e migrazioni esplicite per quello esistente. `CREATE TABLE IF NOT EXISTS` non modifica una tabella già presente; `schema.sql` con `DROP TABLE` non deve essere usato come procedura di aggiornamento.
5. Risolvere i budget preservando significato e storia: se ci sono valori diversi per mesi/anni, conservarli come assegnazioni per periodo, senza appiattirli in un singolo budget ricorrente. Se emergono alternative con risultati diversi per l'utente, presentare i dati aggregati e chiedere la regola prima della conversione.
6. Allineare `transactions.source` e introdurre i vincoli necessari alle occorrenze ricorrenti. Verificare chiavi esterne e indici dopo le ricostruzioni di tabella.

**Chiusura:** database nuovo e database aggiornato convergono allo stesso schema; conteggi e totali per utente/tipo/fonte restano invariati; budget leggibili; inserimento di ricorrenze ammesso; prova di ripristino riuscita. Nessun dato reale nei fixture.

### PR 2 — sicurezza e salvataggi con esiti corretti

**Avanzamento:** codice e 11 regressioni locali preparati; build e smoke import Playwright PASS. Configurazione e prova reale Resend ancora mancanti.

**Scopo:** correggere i difetti attuali prima di introdurre altri dati bancari.

- Eliminare l'inserimento di contenuti non fidati tramite `innerHTML` nei percorsi coinvolti e cercare gli stessi casi in import, categorie, nuova spesa, impostazioni, banche e report. Usare escaping dei template Svelte o `textContent`, senza creare un sanitizzatore artigianale.
- Validare lato API importi finiti e positivi, tipo, date, frequenza e proprietà delle categorie in tutti i percorsi di scrittura, incluse le ricorrenze. Controllare i corrispondenti aggiornamenti, non solo la creazione.
- Import Excel: contare soltanto risposte riuscite; mostrare righe rifiutate e motivi; mantenere la provenienza `import`; rendere il retry dello stesso batch idempotente mediante identità di batch/riga. Non fondere righe uguali che potrebbero essere due spese reali.
- Ricorrenze: identità univoca `(recurring_id, occurrence_date)`, salvataggio atomico o protocollo idempotente equivalente supportato da D1, recupero degli arretrati fino alla data finale. Correggere la domenica `0` e coprire i confini del calendario. Politica proposta: giorno mensile inesistente -> ultimo giorno del mese; anniversario del 29 febbraio -> 28 febbraio negli anni non bisestili, esplicitando il comportamento in UI/documentazione.
- Configurazione mancante: errore esplicito e nessun effetto esterno. Il cron deve rifiutare chiamate senza configurazione valida; il recupero password non deve scrivere token/link nei log. Ripristinare Resend e verificare l'esito restituito dal provider, oltre agli errori di trasporto.
- Uniformare scadenze sessioni/token e confronti temporali: evitare il confronto lessicografico tra ISO con `T` e date SQLite con spazio. Aggiungere prove immediatamente prima/dopo la scadenza.

**Chiusura:** nessun falso successo su errori HTTP; replay/concorrenza delle ricorrenze non produce doppioni; dati di un utente non possono riferirsi alle categorie di un altro; stringhe di test HTML restano testo; nessun token nei log. Verifica email reale verso l'indirizzo indicato dall'utente soltanto quando autorizzata.

### PR 3 — ripristino Fineco e Revolut, sincronizzazione manuale affidabile

**Avanzamento:** servizio, cifratura, consenso, candidati/review e test locali preparati. Tutti i nuovi movimenti sono proposti per review prima dei totali per evitare sovrapposizioni storiche. Credenziali da rigenerare e consenso/prova live mancanti: ripristino operativo non concluso.

**Scopo:** collegare entrambe le banche e importare EUR con prova reale.

1. Verificare accesso e credenziali dell'account GoCardless esistente, disponibilità effettiva delle due banche e configurazione del Worker. Non chiedere chiavi in chat e non inserirle nella repo.
2. Recuperare e verificare la chiave di cifratura originale prima di crearne una nuova. Distinguere plaintext storico riconoscibile, dato cifrato valido e decrittazione fallita; sostituire il fallback ambiguo di `safeDecrypt`. Se la chiave è irrecuperabile, conservare i record storici, dichiarare le connessioni non recuperabili e concordare una nuova autorizzazione; nessuna rotazione cieca.
3. Verificare la configurazione prima di creare requisizioni esterne; rendere callback e transizioni di stato verificabili e resistenti ai replay. Ricavare scadenza e accesso storico dal consenso/provider, senza rinnovarli artificialmente a ogni callback.
4. Estrarre un servizio di sincronizzazione riutilizzabile da API e, successivamente, cron. Stato e progresso per singolo conto; avanzamento solo dopo scritture riuscite. Gli errori parziali devono emergere nell'esito e consentire un retry.
5. Usare identificativi provider e conto stabili, vincoli DB e una finestra di rilettura per movimenti arrivati in ritardo. Verificare stabilità dopo la riautorizzazione. Non usare UUID casuali come sostituto dell'identità, né considerare automaticamente univoco un hash di data/importo/descrizione.
6. Dove l'identità è insufficiente, conservare il movimento come candidato da riconciliare, senza includerlo nei totali né scartarlo silenziosamente. Per sovrapposizioni con Excel/manuale, mostrare intervallo e possibili corrispondenze prima dell'import storico; nessuna deduplica automatica basata sulla sola somiglianza.
7. Validare la valuta prima di persistere: soltanto EUR; gli altri movimenti sono esclusi con conteggio e motivo visibili. Nessuna conversione o somma di valute diverse.
8. Riautorizzazione Fineco e Revolut da parte dell'utente, che completa login bancario e consenso. Prova con intervallo limitato concordato, poi eventuale estensione dello storico disponibile.

**Chiusura:** entrambe le banche autorizzate; movimenti EUR realmente importati; secondo sync sullo stesso intervallo invariato non aggiunge duplicati; test controllato di guasto parziale e ripresa senza perdite; stato e scadenza coerenti. Le prove di guasto sono su ambiente isolato, non sui conti live. Se un provider rifiuta l'accesso, la parte resta esplicitamente bloccata: non dichiarare P1 interamente conclusa sulla base dei mock.

**Dipendenze:** PR 1 e garanzie di PR 2 prima di importare dati live. La verifica di accesso/credenziali può iniziare subito. Cambio provider soltanto se il percorso esistente risulta bloccato e dopo decisione esplicita.

### Estensione richiesta: fattibilità Trade Republic

Verifica pubblica del 6 settembre 2026, senza collegare conti o concedere consensi:

- Trade Republic documenta Open Banking per clienti con **conto corrente attivato**: dati del conto, saldo cash e movimenti, inclusi commissioni, interessi e imposte. Il portafoglio titoli, le posizioni e i rendimenti non sono elencati fra questi dati: non considerarli disponibili tramite questa interfaccia senza ulteriore evidenza.
- Il selettore ufficiale della demo GoCardless, letto con Playwright, contiene 403 istituti per l'Italia e 1.089 per la Germania. Trade Republic non compare in nessuno dei due elenchi; Fineco e Revolut sono presenti nell'elenco italiano.
- Questo prova l'assenza dai selettori pubblici verificati, non l'impossibilità assoluta di integrazione. Il catalogo autenticato dell'account GoCardless non è ancora stato interrogato: le credenziali Bank Account Data non sono presenti nella configurazione locale verificata.
- L'accesso diretto PSD2 descritto da Trade Republic è destinato a provider regolamentati e richiede credenziali/certificati TPP; non è un semplice endpoint da usare con login personale del tracker.

**Azione nel blocco P1 banche:** quando si recuperano le credenziali, verificare anche Trade Republic nel catalogo autenticato del provider per paese/tipo di conto pertinente. Se disponibile, riutilizzare il servizio EUR esistente e provare il consenso. Se assente, riportare il blocco esterno e valutare separatamente un altro aggregatore ufficialmente compatibile o un import da estratto conto. Non vincolare la chiusura di Fineco/Revolut a questa estensione e non aggiungere API non ufficiali o scraping del login.

Fonti: [Trade Republic Open Banking](https://traderepublic.com/en-de/support?articleId=488f48ff-8cbc-4832-b1b4-21bcd72cc7b1), [Trade Republic informazioni TPP](https://traderepublic.com/fr-fr/support?articleId=0c5b7d7c-5970-4c6e-88ef-7be7e96c8fbd), [GoCardless selettore Italia](https://bankaccountdata.gocardless.com/demo/aspsp/IT), [GoCardless selettore Germania](https://bankaccountdata.gocardless.com/demo/aspsp/DE).

## P2 — automazione, contratti e verifiche continue

### PR 4 — servizi condivisi e job verificabili

**Avanzamento:** servizi/job/periodi pronti, 19 test e scheduled locale PASS. Automazione bancaria disabilitata fino a verifica live P1; cron di produzione non ancora pubblicato.

- Collegare un vero handler Cloudflare `scheduled()` ai servizi di ricorrenze, pulizia e sincronizzazione P1.
- Avviare l'automazione bancaria solo dopo la prova manuale P1; niente sovrapposizioni incontrollate con il pulsante di sync. Gestire retry, timeout e `429` rispettando le indicazioni effettive del provider.
- Registrare esito e ultima esecuzione riuscita per job/conto, con messaggi utili e privi di dati bancari o segreti. Rendere distinguibili assenza di esecuzione, errore e successo parziale.
- Rendere sottili gli endpoint: autenticazione, validazione, invocazione servizio e risposta. Riutilizzare i servizi introdotti per i fix, senza riscriverli una seconda volta.
- Consolidare regole di periodo tra dashboard, budget, grafici e report, compreso il confronto tra budget mensile/annuale e intervallo selezionato.

**Chiusura:** evento schedulato eseguito nel runtime di test; retry e concorrenza verificati; una successiva esecuzione reale documentata dopo approvazione del deploy; dati coerenti fra dashboard e report sullo stesso periodo.

### PR 5 — TypeScript, pipeline e rilascio ripetibile

**Avanzamento:** check web e smoke runtime PASS, pipeline preparata, preflight remoto in sola lettura rileva blocchi reali. Checker Astro/Svelte e Wrangler aggiornati dopo autorizzazione; check/build/test locali PASS; Playwright al momento locale MCP. Esito GitHub Actions da verificare sul commit pubblicato.

- Ripristinare tipi Worker/D1/Locals e contratti dei payload. Ridurre `any` nei percorsi modificati; separare la configurazione Capacitor dal controllo web se resta fuori dal rilascio.
- Aggiungere comandi di check, test e build ripetibili. Verificare gli strumenti già installati prima di proporre nuove dipendenze; richiedere approvazione solo per quelle realmente necessarie.
- CI GitHub: controllo tipi, test dei servizi, schema nuovo/aggiornamento su fixture e build; smoke Playwright su ambiente isolato, senza credenziali reali.
- Preflight di rilascio: account Cloudflare corretto, nomi dei secret richiesti, schema effettivo, migrazioni applicate e commit/versione da pubblicare. Mancanze bloccanti fermano il rilascio.

**Chiusura:** check/typecheck/test/build verdi da checkout pulito; pipeline remota verde sul commit della PR; preflight rileva una migrazione o un secret mancante senza modificare produzione.

## P3 — semplificazione delle pagine e rimozione dei residui

### PR 6 — componenti, stato UI e documentazione coerenti

**Avanzamento:** componenti import/ricorrenze/riepilogo report/review bancaria estratti, endpoint debug rimosso, lifecycle dei due grafici corretto e Playwright desktop/mobile PASS. Documentazione e roadmap aggiornate.

- Estrarre progressivamente le parti interattive di `banche.astro`, `importa.astro`, `impostazioni.astro`, `report.astro` in componenti Svelte. Partire dai punti già toccati da P1/P2; evitare una riscrittura estetica.
- Riutilizzare caricamento/errori/esiti API e selezione periodo; preservare filtri, navigazione, grafici e comportamento mobile.
- Rimuovere endpoint di debug datati, codice non usato e duplicazioni solo dopo verifica dei riferimenti.
- Chiarire i confini PWA: cache di asset non equivale a gestione offline completa delle spese. Allineare roadmap e descrizioni alle capacità provate.
- Valutare indici e paginazione sulle query effettive, con misure; niente ORM, cambio database o nuova infrastruttura senza una necessità dimostrata.

**Chiusura:** smoke Playwright desktop/mobile su login, dashboard, transazioni, import, budget, ricorrenze e banche; nessuna regressione di comportamento; duplicazioni individuate rimosse; documentazione aggiornata.

Fuori scope: conversioni valutarie, app native, notifiche push, export PDF, redesign generale, migrazione di framework/provider non motivata.

## GitHub e gestione del lavoro

- Piano pubblicato tramite PR di sola documentazione su `codex/spese-tracker-remediation-plan-2026-09-06`.
- Implementazione in worktree isolate con claim per risorse condivise. Branch `codex/` e PR piccole, nell'ordine delle dipendenze sopra; PR 1-6 sono unità di lavoro proposte, da dividere soltanto quando la verificabilità lo richiede.
- Prima della prima PR di codice, recuperare separatamente i fix locali già presenti e verificare la corrispondenza con il deploy di maggio. Non includere automaticamente le differenze nel lockfile.
- Per ogni PR indicare problema, comportamento risultante, precedente Git pertinente, ricerca delle altre istanze dello stesso difetto, test, rischi e stato del deploy.
- Tenere questo piano e `PROJECT.md` sincronizzati con lo stato reale: pianificato, in corso, verificato localmente, pubblicato, provato live. Una PR unita non equivale a una funzione operativa in produzione.
- Se manca una dipendenza esterna, continuare gli interventi indipendenti e segnalare il blocco preciso. Nessun polling indefinito, nessun cambio provider automatico.

## Passi finali obbligatori di ogni PR di codice

1. **Test:** eseguire test dei casi limite indicati, controllo tipi/build e Playwright per UI; migrazioni provate su dati sintetici rappresentativi e runtime D1 isolato. Review `code-reviewer` per i cambi applicabili e `continuous-improvement`; correggere i FAIL prima della chiusura.
2. **PROJECT.md:** aggiornare Status, Key Files, Decisions, Learnings e Audit Log, insieme allo stato del piano. Segnalare esplicitamente ciò che non è ancora verificato live.
3. **Commit:** staging mirato, commit conventional in inglese, push del branch e apertura/aggiornamento PR su GitHub. Presentare separatamente il risultato pronto per l'approvazione di merge/deploy e migrazione remota.

## Fonti tecniche per l'implementazione

- [GoCardless Bank Account Data overview](https://docs.gocardless.com/docs/bank-account-data): accesso al portale e secret del servizio.
- [GoCardless quickstart](https://docs.gocardless.com/docs/bank-account-data/quickstart-guide): consenso, requisizioni e durata dell'accesso.
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/): handler `scheduled()` necessario per i trigger.

## Stato di consegna codice — 6 settembre 2026

- PR GitHub #1 piano, #2 baseline, #3 integrità, #4 banche, #5 servizi/job, #6 pipeline; PR #7 P3 componenti/grafici. Le PR sono concatenate e draft, non unite.
- Pipeline remota PR6 ac59c2f verde (run34047029251). Il numero di test è19; Playwright locale separato dai test CI runtime.
- Credenziali GoCardless inserite privatamente e autenticazione PASS; catalogo autenticato conferma Fineco/Revolut, Trade Republic assente in IT/DE. Restano configurazione Resend e consenso/prova live Fineco/Revolut.
- Aggiornamento autorizzato ed eseguito: Wrangler4.115 stabile, check Astro/Svelte senza errori, npm ci e prove runtime PASS. Restano3 warning accessibilità del componente QuickAdd non utilizzato e24 segnalazioni npm audit da analizzare prima del rilascio. Smoke Playwright CI necessita di un runner di progetto; al momento è una verifica locale MCP.
- Produzione invariata. Per rilasciare: riconciliare tracking storicoD1, preflight, approvazione sul risultato e applicazione migrazioni/deploy, poi consensi/prova live. Non confondere codice pronto con P1 banche operativamente conclusa.

## Avanzamento sicurezza — 7 settembre2026

Correzioni e valutazione in [security-2026-09-07.md](../security-2026-09-07.md): audit24→4 advisory residue motivate; import/export Excel verificati con versione corretta.24test e check/build/D1/smoke PASS. Preparati manutenzione API/job e generatore offline SQL baseline; restore backup aggiornato preserva dati/sequenze. Due Worker condividono D1, da fermare e drenare prima del rilascio. Nessun merge/migrazione/deploy. Resta risposta utente su Resend e approvazione del rilascio concreto, poi consenso Fineco/Revolut.
