# Thinkin' About Money - Development Roadmap

## Priorità correnti — 6 settembre 2026

La roadmap operativa è il [piano di consolidamento P1/P2/P3](docs/plans/2026-09-06-remediation.md). Le sezioni successive conservano lo storico delle funzionalità; "Done" non implica che l'operatività attuale sia stata verificata.

| Priorità | Obiettivo | Stato |
|----------|-----------|-------|
| P1 | Schema coerente, salvataggi sicuri, import/ricorrenze affidabili e ripristino Fineco/Revolut solo EUR | Pianificato |
| P2 | Cron effettivo, servizi condivisi, typecheck/test/CI e rilascio ripetibile | Pianificato, dipende da P1 |
| P3 | Componenti UI, rimozione residui e documentazione coerente | Pianificato, dopo le garanzie P1/P2 |

Il piano non introduce nuove funzionalità native, multivaluta o un cambio di provider. Nessun fix è stato applicato con la PR di pianificazione.

## Current Status (Completed)

| Feature | Status |
|---------|--------|
| MVP (auth + CRUD transactions) | Done |
| Charts & Statistics | Done |
| Import Excel | Done |
| Budget per category | Done |
| Bank Sync (Nordigen) | Done |
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
| Cron auto-sync | Done | Daily at 06:00 UTC - recurring generation + session cleanup |
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
| Excel vs Bank deduplication | Match by date+amount+description |
| Push notifications | Budget alerts via web push |

---

## Notes

- Nordigen rate limit: 10 requests/day per scope per account
- OAuth expires after 90 days - UI shows expiry + alert banners
- Cron secret needed: `wrangler secret put CRON_SECRET`
- D1 does not enforce CHECK constraints added after table creation

---

*Last updated: 6 settembre 2026 — piano di consolidamento; storico precedente conservato.*
