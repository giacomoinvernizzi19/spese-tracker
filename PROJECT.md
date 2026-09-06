# Thinkin' About Money - Project Context

## Quick Context — verifica del 6 settembre 2026

- **What:** gestione spese personali, import Excel e integrazione bancaria.
- **Stack:** Astro + Svelte + Cloudflare Workers/D1, confermato per il consolidamento.
- **Status:** Codice P1/P2/P3 preparato nelle PR draft; tooling aggiornato e verificato localmente. Credenziali GoCardless nuove salvate privatamente e autenticazione verificata; consenso bancario, migrazioni remote e pubblicazione ancora da eseguire. Le marcature storiche "Done" sotto non certificano l'operatività attuale di budget, ricorrenze o bank sync.
- **Piano corrente:** [Consolidamento P1/P2/P3](docs/plans/2026-09-06-remediation.md). Fineco e Revolut in P1, soltanto EUR; accesso GoCardless confermato dall'utente.
- **Trade Republic:** interesse aggiuntivo dell'utente; Open Banking documentato, ma assente dai selettori pubblici GoCardless IT/DE verificati il 6 settembre 2026. Assente anche dal catalogo autenticato IT/DE verificato con le nuove credenziali; nessuna connessione effettuata.
- **Rilevato:** schema remoto budget incompatibile con le API; vincolo `source` incompatibile con le ricorrenze; configurazione bancaria/cifratura/email da recuperare; cron senza collegamento `scheduled()` nel sorgente esaminato; typecheck non verde.
- **Git/deploy:** `main` verificato a `a9778f6`; ultima versione pubblicata rilevata `81db52de` del 14 maggio 2026. Quattro modifiche locali preesistenti nel checkout originale sono da riconciliare separatamente, non incluse nella PR del piano.

## Key Files

| File | Purpose |
|------|---------|
| `docs/database-upgrade.md` | Procedura di upgrade, preservazione e tracking migrazioni |
| `migrations/0001_initial.sql`, `migrations/0008_ledger_integrity.sql` | Baseline ordinata e migrazione ledger/budget |
| `scripts/test.mjs`, `scripts/test-d1.mjs`, `tests/` | Test con Node/esbuild e runtime D1 locale |
| `docs/plans/2026-09-06-remediation.md` | Piano corrente, dipendenze, criteri di chiusura e workflow GitHub |
| `src/lib/db/schema.sql`, `migrations/` | Migrazioni come fonte di schema; schema.sql è un rimando, non una procedura di reset |
| `src/lib/nordigen.ts`, `src/pages/api/bank/` | Client GoCardless e flusso bancario |
| `src/lib/recurring.ts`, `src/pages/api/cron/daily.ts` | Generazione ricorrenze e manutenzione |
| `wrangler.jsonc`, `package.json` | Runtime, deploy e comandi |

## Scripts

- `npm run dev`: sviluppo locale.
- `npm run build`: build applicazione.
- `npm run check`: Astro check e svelte-check; copre pagine, componenti e TypeScript. Zero errori; tre avvisi accessibilità nel componente QuickAdd non utilizzato.
- `npm run deploy`: pubblicazione, da eseguire solo dopo verifica e approvazione del rilascio.
- `npm test`: test automatici schema e API budget; `node scripts/test-d1.mjs`: vincoli e rollback nel runtime D1. Test di baseline introdotti il 6 settembre 2026. Browser test tramite Playwright MCP configurato per il workspace.

## Accounts
| Platform | Account | ID |
|---|---|---|
| GitHub | giacomoinvernizzi19 | — |
| Cloudflare | g.invernizzi.jm@gmail.com | `73412abe...` |


## Overview

Personal expense tracking app with bank sync, developed for personal use.

**Tagline:** Track your money, think about tomorrow

---

## Branding

| Key | Value |
|-----|-------|
| Full Name | Thinkin' About Money |
| Short Name | Thinkin' |
| Package | thinkin-about-money |
| App ID | com.thinkinaboutmoney.app |
| Logo | 💭💰 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Astro 5 + Svelte 5 |
| Styling | TailwindCSS 4 |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Auth | Custom (bcrypt + cookies) |
| Charts | Chart.js |
| Bank Sync | Nordigen/GoCardless |
| Email | Resend |

---

## Status

| Milestone | Status |
|-----------|--------|
| MVP (auth + CRUD) | Done |
| Charts & Stats | Done |
| Import Excel | Done |
| Budget system | Done |
| Bank sync | Done |
| Security Hardening | Done |
| PWA base | Done |
| Rebranding | Done |
| Text search | Done |
| Custom date range | Done |
| Recurring transactions | Done |
| Cron auto-sync | Done |
| Dark mode complete | Done |
| Bank expiry alert | Done |
| Historical data import | Done |
| Charts react to period selector | Done |
| Pie chart "Altro" grouping | Done |

---

## Links

- **Live**: https://thinkin-about-money.g-invernizzi-jm.workers.dev
- **Repo**: https://github.com/giacomoinvernizzi19/spese-tracker
- **Roadmap**: [ROADMAP.md](./ROADMAP.md)
- **Claude Context**: [CLAUDE.md](./CLAUDE.md)

---

## Decisions

| Data | Decisione | Alternative | Perche |
|------|-----------|-------------|--------|
| 2026-09-06 | Migrazioni ordinate come fonte schema; budget datati preservati e separati dai limiti ricorrenti; test con strumenti già installati | Reset schema o appiattimento budget | Conservare dati e significato, rendere riproducibile upgrade e nuovo database |
| 2026-09-06 | Consolidamento incrementale mantenendo lo stack; Fineco/Revolut in P1, solo EUR | Riscrittura o nuove funzionalità | Prima garantire integrità e ripristinare le funzioni esistenti; priorità e valuta confermate dall'utente |
| 2026-01 | Astro 5 + Svelte 5 | Next.js, React | Performance, islands architecture |
| 2026-01 | Cloudflare D1 | Supabase, PlanetScale | Zero latency, edge computing |
| 2026-01 | Custom auth (bcrypt + cookies) | Auth0, Clerk | Control totale, zero vendor lock |
| 2026-01 | Nordigen per bank sync | Plaid | EU-focused, PSD2 compliant |
| 2026-01 | Capacitor per native apps | React Native | PWA-first, shared codebase |
| 2026-01 | Rebrand to Thinkin' About Money | Keep SpesaTracker | International appeal, catchier |

---

## Learnings

### What Works
- Edge computing D1 per latenza minima
- Auto-categorization based on history
- Excel import for data migration
- PWA installabile, cache di soli asset statici; lettura/scrittura spese richiedono rete

### What Needs Work
- SVG icons for iOS PWA (needs PNG)
- No push notifications yet

### Gotchas

- Nel rebuild SQLite va preservato anche sqlite_sequence: altrimenti possono essere riutilizzati ID cancellati già emessi. Test dedicato per budget e transazioni.
- Il 6 settembre 2026 il database remoto contiene zero budget; il nuovo schema preserva comunque le assegnazioni storiche mensili e le API danno loro precedenza sui limiti ricorrenti.

- La review del 2026-09-06 ha verificato che `CREATE TABLE IF NOT EXISTS` non risolve il drift della tabella budget esistente: servono migrazioni esplicite e prova sullo schema reale.
- Uno stato bancario `linked` con scadenza trascorsa non prova una connessione operativa; un trigger cron configurato non prova l'esistenza del relativo handler.
- Le migrazioni risultano anche eseguite tramite SQL diretto: controllare lo schema effettivo, oltre al registro migrazioni.
- Multi-account Cloudflare: use project-specific .env
- Nordigen rate limit 10 req/day - manual sync recommended
- OAuth expires 90 days - show expiry in UI
- Worker URL changes on rebrand deploy

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password Policy | Min 8 chars, uppercase, lowercase, number, blocks common passwords |
| Rate Limiting | 10 login/15min per IP, 5 login/1h per email, 5 register/1h per IP |
| Secure Headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Encryption at Rest | AES-256-GCM for bank data (requisition_id, account_ids) |
| Timing Attack Protection | Constant-time token comparison for password reset |
| SQL Injection | Prepared statements with .bind() |
| Session Security | httpOnly, secure, sameSite=lax cookies |

**Required Secrets** (configure via `wrangler secret put`):
- `ENCRYPTION_KEY`: 256-bit AES key (hex, 64 chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  wrangler secret put ENCRYPTION_KEY
  ```

---

## Notes

- Personal project, not Enpal
- Deploy on personal Cloudflare account
- D1 database ID: cb795d69-0853-4c77-98c3-a294bcbbe5a4

---

## Browser Testing

Usare il server MCP `playwright` configurato per Codex. Testare su Wrangler locale con D1 isolato e dati sintetici; mai usare dati bancari reali nei fixture.

**Checklist post-modifica UI:**
- [ ] Login/register flow
- [ ] CRUD transazioni
- [ ] Dashboard statistiche e grafici
- [ ] Import Excel funziona
- [ ] Mobile responsive

---

## Audit Log

| Data | File Modificati | CI Result | Note |
|------|-----------------|-----------|------|
| 2026-09-06 | Dipendenze, checker Astro/Svelte, smoke isolato, tipi banca e tooltip | WARN | Review senza blocchi; verifiche locali PASS; avvisi accessibilità e audit dipendenze documentati |
| 2026-09-06 | Componenti Svelte, grafici, report, pulizia debug | PASS | 19 test/check/build e Playwright locali PASS; finding review corretti; CI PASS |
| 2026-09-06 | Pipeline, check web, preflight e smoke isolato | PASS | Typecheck e runtime PASS; preflight rileva blocchi reali, review finding corretti |
| 2026-09-06 | Job/worker, reporting/periodi, budget, export paginato | PASS | 19 test, build, scheduled locale e review PASS |
| 2026-09-06 | Servizio banche, candidati, cifratura, migrazione 0009 | PASS | 16 test, D1, build; finding review corretti e CI PASS. Credenziali/consenso live mancanti |
| 2026-09-06 | API, import, ricorrenze, auth e template HTML | PASS | Code review e continuous-improvement PASS; 11 test, build e smoke import locali PASS |
| 2026-09-06 | Migrazioni baseline/ledger, API budget, auth UI, test e runbook | PASS | Code review PASS; CI documentale allineata; 4 test, D1, build, restore backup e Playwright locali PASS. Produzione invariata |
| 2026-09-06 | PROJECT.md, docs/plans/2026-09-06-remediation.md | PASS | Nota fattibilità Trade Republic: fonti ufficiali e selettori GoCardless IT/DE verificati, review continuous-improvement; supporto autenticato non ancora confermato |
| 2026-09-06 | PROJECT.md, ROADMAP.md, docs/plans/2026-09-06-remediation.md | PASS | Review continuous-improvement e link locali/diff verificati; sola pianificazione, nessun codice o dato remoto modificato |
| 2026-01-17 | manifest.json, package.json, wrangler.jsonc, sw.js, login.astro, registrati.astro, reset-password.astro, recupera-password.astro, AppLayout.astro, impostazioni.astro, forgot-password.ts, CLAUDE.md, PROJECT.md, ROADMAP.md, privacy.astro, capacitor.config.ts | WARN | Rebranding complete. Minor: schema.sql comment still says SpesaTracker |
| 2026-03-22 | 20+ files (stats API, dashboard, charts, dark mode, recurring, cron, report, privacy, import script) | OK | v1.5 overhaul: search, date range, recurring, cron, dark mode, bank alerts, 1912 txn import, charts period sync, pie chart "Altro" grouping |

---

**Last updated:** 2026-09-06 (tooling e nuove credenziali verificati; produzione invariata)

## Evidenze P1 baseline — 6 settembre 2026

- Backup privato esportato fuori dalla repo; ripristino SQLite isolato e applicazione 0008: conteggi/totali per utente e fonte invariati, integrity_check e foreign_key_check validi.
- SHA256 backup: `15bd860d976f906802cc00a947f53ae139aa464a357928cf225eb0f286ba0fc6`. Il contenuto non è incluso in Git.
- Test automatici 4/4; runtime D1: migrazioni, unicità e rollback batch PASS; build PASS; Playwright locale: registrazione 201, minlength 8 e quattro requisiti password aggiornati.
- Recuperate le due pagine password del checkout originale; del lockfile recuperati soltanto nome/versione. Checkout originale preservato.
- Wrangler locale installato usa runtime con compatibilità massima 2025-11-18 e segnala fallback rispetto a 2026-01-04; riallineamento tooling da verificare prima del deploy.
- Il tracking migrazioni remoto resta da riconciliare prima di qualsiasi apply; nessuna migrazione o deploy remoto effettuati.

## Evidenze P1 integrità — 6 settembre 2026

- Validatori e wrapper API condivisi in `src/lib/{api,validation,transactions}.ts`; import con identità stabile SHA256 file/riga, ricorrenze con vincolo e checkpoint atomico. Identità indipendente dalle colonne selezionate: un retry con payload diverso risponde 409.
- `src/lib/display.ts` riusa `entities/escape` 6.0.1 già installato, dichiarato esplicitamente senza installare pacchetti. Encoding dei dati nei template HTML di sei pagine; validazione separata di colori e URL immagini.
- Test 11/11 e build PASS. Playwright su D1 locale: 2 righe importate/1 rifiutata, retry 0 nuove/2 già presenti, cambio colonne 409 senza duplicati; payload HTML resta testo.
- Ripristino password atomico e monouso, sessioni invalidate; cron senza secret rifiutato; Resend mancante non emette token né URL nei log. Email reale non testata.
- Controllo tipi ancora bloccato dagli errori preesistenti nel client bancario/cifratura e Capacitor: risoluzione prevista nel blocco banche/tooling.
- Recupero configurazione: vecchio Worker `spese-tracker` contiene i nomi NORDIGEN_SECRET_ID, NORDIGEN_SECRET_KEY e RESEND_API_KEY; Worker attuale soltanto CRON_SECRET. Nessuna ENCRYPTION_KEY nei due. Cloudflare non restituisce i valori dei secret. Utente segnala possibile perdita delle credenziali e disponibilità a ricrearle. Nessuna rotazione effettuata.

## Evidenze P1 banche — 6 settembre 2026

- Migrazione 0009 aggiunge stati per conto, lease/backoff, copertura temporale continua e candidati separati dal ledger. Nuovo servizio `src/lib/bank.ts`, client provider con timeout/errori senza payload, cifratura versionata e callback verificato.
- `BankReview.svelte` espone import/associazione/ignora. Tutti i nuovi movimenti richiedono review, decisione intenzionale per evitare sovrapposizioni con Excel/manuale. Le identità mancanti non entrano automaticamente nei totali.
- Test 16/16 PASS, D1 migrazioni/rollback PASS, build PASS; Playwright rende candidato sintetico e nessun overflow desktop. Review: finding checkpoint disgiunto e backoff discovery corretti con regressioni; continuous-improvement PASS.
- La chiave precedente non è necessaria per i record verificati nel backup: sei requisition UUID in chiaro, due liste account JSON in chiaro, quattro liste assenti. Nessuna chiave creata o ruotata da questa sessione.
- `docs/bank-recovery.md` e `scripts/configure-local-banking.py`: percorso per configurazione privata. Nuove credenziali, catalogo autenticato, consenso Fineco/Revolut e prova live restano in attesa dell'utente. P1 banche non chiusa operativamente.

## Evidenze P2 servizi — 6 settembre 2026

- `src/worker.ts` delega fetch all'adapter Astro e implementa scheduled; `src/lib/jobs.ts` condiviso con cron HTTP. Migrazione0010 registra lease, tentativi, ultimo successo ed errore per job. BANK_SYNC_ENABLED=false finché il percorso live P1 non è provato.
- `period.ts` e `reporting.ts` condividono date e aggregati categorie, inclusa ownership dei drilldown. Budget usa mese/anno selezionati, dashboard rende non confrontabili gli intervalli arbitrari; grafico etichettato Andamento del periodo.
- Export tramite `client.ts` e paginazione per ID: nessun tetto totale silenzioso. Test502righe con inserimento concorrente verifica assenza duplicati nel set iniziale.
- Test19/19, build PASS; evento /__scheduled locale eseguito davvero e stato recurring/cleanup success. Review finding export/titolo corretti e riesame PASS. Produzione invariata.

## Evidenze P2 tooling — 6 settembre 2026

- `npm run check` PASS sul web, escludendo configurazione Capacitor non utilizzata. `smoke:runtime` crea D1 temporaneo e porta dedicata, verifica fetch/auth/cron protetto e scheduled con due job riusciti; PASS.
- `.github/workflows/check.yml` prepara pipeline da checkout pulito: build, tipi, 19 test, D1 e smoke runtime. Esito remoto da acquisire sul commit pubblicato.
- `scripts/preflight.mjs` è in sola lettura; prova reale rileva segreti mancanti, schemi non aggiornati e tracking migrazioni assente. Nessuna mutazione remota. Controlla anche sorgenti non tracciati prima di attribuire il build a HEAD.
- Aggiornamento Wrangler e nuovi checker Astro/Svelte richiesti all'utente, ancora senza risposta; nessuna installazione effettuata. Playwright rimane verifica locale MCP: lo smoke runtime CI non è un browser test.

## Evidenze P3 UI — 6 settembre 2026

- `ExpenseImport.svelte`, `RecurringSettings.svelte`, `ReportSummary.svelte` e `BankReview.svelte` separano stato/form/esiti dalle pagine. `client.ts` riusa gestione errori HTTP; rendering Svelte evita HTML concatenato nei percorsi estratti. Chart.js e scheletro delle pagine conservati, nessuna riscrittura estetica generale.
- Debug bancario gennaio2026 senza consumer rimosso. PWA documentata come cache asset, non contabilità offline.
- Trovato difetto affine nei due grafici dashboard: init prima del montaggio canvas. Azione Svelte gestisce creazione/distruzione insieme al canvas; richieste con versione impediscono risposte vecchie sui nuovi filtri. Grafico categorie non confronta intervalli arbitrari con budget mensile; spese senza categoria contribuiscono al totale del grafico.
- Playwright locale: import2nuove/1rifiutata, retry0nuove/2duplicate; HTML non eseguito; ricorrenza settimanale domenica salvata e nuovo form vuoto; report aggiornato; 8 percorsi mobile390px senza overflow. Due canvas dashboard verificati con pixel disegnati dopo il fix.
- Ripristino privato attraverso0010: conteggi/totali e integrità invariati. EXPLAIN usa idx_transactions_user_date; 100 query aggregate circa1ms su SQLite locale, solo misura orientativa non SLA D1. Nessun indice extra giustificato.
- GitHub Actions PR6 ac59c2f: PASS (run34047029251). Nessun merge, migrazione remota o deploy.

## Aggiornamento tooling e credenziali — 6 settembre 2026

- Autorizzato dall'utente l'aggiornamento strumenti. Wrangler4.115.0, @astrojs/check0.9.10, svelte-check4.7.6 e tipi Cloudflare5.20260903.1 dichiarati esplicitamente; lockfile verificato con npm ci. node_modules della worktree ora indipendente dal checkout originale.
- Decisione: override Wrangler anche per l'adapter Astro12, già vincolato a4.50.0, per usare lo stesso runtime in build/dev/test. Scelta4.115 con Miniflare4.20260722.1 stabile:4.129 introduce Miniflare5-alpha con API diverse. I tipi Cloudflare espliciti evitano la dipendenza dal modo in cui npm colloca i pacchetti transitivi; non vengono aggiunti globali Worker al DOM. Precedente: PR6/ac59c2f.
- Corrette le annotazioni della pagina banche e il tooltip con valore nullo. Ricerca affine: unico parsed.y.toFixed nel progetto. Nessuna modifica al flusso di consenso.
- Smoke su D1 temporaneo usa un file env vuoto salvo BANK_SYNC_ENABLED=false e non carica .dev.vars: le credenziali personali non entrano nelle prove.
- npm ci, check (zero errori),19 test, build, test D1 e smoke runtime PASS. Playwright locale: conto sintetico e badge Collegato renderizzati. Pipeline remota da verificare sul nuovo commit.
- Restano tre warning accessibilità in QuickAdd, privo di consumer, e nove hint Astro. npm audit segnala24 dipendenze vulnerabili (14high,8moderate,2low), incluse dipendenze applicative preesistenti Astro/XLSX: questo aggiornamento non certifica la chiusura della sicurezza. Analizzare esposizione e aggiornamenti separatamente prima del rilascio; non eseguito audit fix --force.
- Nuove credenziali GoCardless create e salvate dall'utente in .dev.vars privato e nel gestore password. Autenticazione reale PASS; Fineco e Revolut presenti nel catalogo IT, Trade Republic assente in IT/DE. Non committare segreti; nessun consenso o dato bancario scaricato. ENCRYPTION_KEY è locale e deve essere conservata prima del rilascio.
- Produzione invariata. Restano migrazioni/tracking D1, configurazione segreti sul Worker (incluso Resend), autorizzazione al rilascio e prova manuale con consenso delle banche.
