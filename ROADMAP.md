# Thinkin' About Money - Development Roadmap

## Priorità correnti — 6 settembre 2026

La roadmap operativa è il [piano di consolidamento P1/P2/P3](docs/plans/2026-09-06-remediation.md). Le sezioni successive conservano lo storico delle funzionalità; "Done" non implica che l'operatività attuale sia stata verificata.

| Priorità | Obiettivo | Stato |
|----------|-----------|-------|
| P1 | Schema coerente, salvataggi sicuri, import/ricorrenze affidabili e ripristino Fineco/Revolut solo EUR | Codice pronto in PR2–4; credenziali/consenso e prova live mancanti |
| P2 | Cron effettivo, servizi condivisi, typecheck/test/CI e rilascio ripetibile | Servizi/pipeline PR5–6, Actions verde; checker aggiuntivi in attesa |
| P3 | Componenti UI, rimozione residui e documentazione coerente | Componenti e pulizia verificati localmente, PR7 |

Il piano non introduce nuove funzionalità native, multivaluta o un cambio di provider. Nessun fix è stato applicato con la PR di pianificazione.

## Funzioni storiche — lo stato operativo corrente è sopra

| Feature | Status |
|---------|--------|
| MVP (auth + CRUD transactions) | Done |
| Charts & Statistics | Done |
| Import Excel | Done |
| Budget per category | Done |
| Bank Sync (Nordigen) | Storico; ripristino operativo in corso |
| Security Hardening | Done |
| PWA base | Done |
| Rebranding | Done |

---

## v1.5 - Data Import & Feature Completion (March 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Historical data import | Done | ~1918 transactions from Excel via D1 API |
| Text search | Done | Server-side LIKE filter on descriptions |
| Custom date range | Done | From/to date params + dashboard presets (month/3mo/year/custom) |
| Recurring transactions | Done | Monthly/weekly/yearly auto-generation with management UI |
| Cron auto-sync | Storico non provato; handler preparato in PR5 | Ricorrenze/pulizia locali verificate; pubblicazione ancora da approvare |
| Dark mode complete | Done | All pages and components with dark: classes |
| Bank connection expiry alert | Done | Yellow/red banners based on days until expiry |
| Charts sync with period selector | Done | CategoryPieChart + MonthlyBarChart react to periodChanged event |
| Pie chart "Altro" grouping | Done | Categories < 3% grouped into expandable "Altro" (dashboard + report) |
| Privacy page Tailwind 4 fix | Done | Replaced @apply with inline classes (TW4 scoped style limitation) |

---

## v2.0 - Future Ideas (No Timeline)

These are ideas to consider if/when needed. No commitment.

| Feature | Description |
|---------|-------------|
| PNG icons for PWA | 192x192, 512x512 for iOS/Android |
| Export PDF with charts | Visual report export |
| Riconciliazione Excel/banca | Candidati con conferma esplicita; somiglianza non prova unicità |
| Push notifications | Budget alerts via web push |

---

## Notes

- Durata e disponibilità storica dipendono dai termini del consenso del provider, verificati dal codice.
- Backoff 429 persistito per conto; nessun numero fisso di chiamate garantito.
- Cron HTTP richiede CRON_SECRET; scheduled usa i servizi interni. BANK_SYNC_ENABLED=false finché manca la prova live.
- PWA: installazione e cache di asset; operazioni sulle spese richiedono rete.

*Last updated: 6 settembre 2026 — implementazione nelle PR, nessun deploy.*
