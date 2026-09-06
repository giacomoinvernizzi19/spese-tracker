# Thinkin' About Money - Project Context

## Quick Context — verifica del 6 settembre 2026

- **What:** gestione spese personali, import Excel e integrazione bancaria.
- **Stack:** Astro + Svelte + Cloudflare Workers/D1, confermato per il consolidamento.
- **Status:** piano di consolidamento P1/P2/P3 preparato; implementazione non iniziata. Le marcature storiche "Done" sotto non certificano l'operatività attuale di budget, ricorrenze o bank sync.
- **Piano corrente:** [Consolidamento P1/P2/P3](docs/plans/2026-09-06-remediation.md). Fineco e Revolut in P1, soltanto EUR; accesso GoCardless confermato dall'utente.
- **Trade Republic:** interesse aggiuntivo dell'utente; Open Banking documentato, ma assente dai selettori pubblici GoCardless IT/DE verificati il 6 settembre 2026. Verifica del catalogo autenticato inserita nel piano; supporto non confermato, nessuna connessione effettuata.
- **Rilevato:** schema remoto budget incompatibile con le API; vincolo `source` incompatibile con le ricorrenze; configurazione bancaria/cifratura/email da recuperare; cron senza collegamento `scheduled()` nel sorgente esaminato; typecheck non verde.
- **Git/deploy:** `main` verificato a `a9778f6`; ultima versione pubblicata rilevata `81db52de` del 14 maggio 2026. Quattro modifiche locali preesistenti nel checkout originale sono da riconciliare separatamente, non incluse nella PR del piano.

## Key Files

| File | Purpose |
|------|---------|
| `docs/plans/2026-09-06-remediation.md` | Piano corrente, dipendenze, criteri di chiusura e workflow GitHub |
| `src/lib/db/schema.sql`, `migrations/` | Schema storico e migrazioni da riconciliare; schema.sql contiene DROP, non usarlo per aggiornare produzione |
| `src/lib/nordigen.ts`, `src/pages/api/bank/` | Client GoCardless e flusso bancario |
| `src/lib/recurring.ts`, `src/pages/api/cron/daily.ts` | Generazione ricorrenze e manutenzione |
| `wrangler.jsonc`, `package.json` | Runtime, deploy e comandi |

## Scripts

- `npm run dev`: sviluppo locale.
- `npm run build`: build applicazione.
- `./node_modules/.bin/tsc --noEmit --incremental false`: controllo tipi, fallisce nella baseline verificata; il piano prevede di ripristinarlo.
- `npm run deploy`: pubblicazione, da eseguire solo dopo verifica e approvazione del rilascio.
- Nessuna suite di test rilevata nella baseline; aggiunta prevista nel piano. Browser test tramite Playwright MCP configurato per il workspace.

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
- PWA with offline support

### What Needs Work
- SVG icons for iOS PWA (needs PNG)
- No push notifications yet

### Gotchas

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

Usare **Playwright Skill** (non MCP) per testare UI. Vedi `CLAUDE.md` Rule 1.10.

```bash
# Dev server: npm run dev (porta 4321, Astro)
# Esecuzione test
cd C:/ClaudeCode/.claude/skills/playwright-skill && node run.js "C:/tmp/playwright-test-*.js"
```

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
| 2026-09-06 | PROJECT.md, docs/plans/2026-09-06-remediation.md | PASS | Nota fattibilità Trade Republic: fonti ufficiali e selettori GoCardless IT/DE verificati, review continuous-improvement; supporto autenticato non ancora confermato |
| 2026-09-06 | PROJECT.md, ROADMAP.md, docs/plans/2026-09-06-remediation.md | PASS | Review continuous-improvement e link locali/diff verificati; sola pianificazione, nessun codice o dato remoto modificato |
| 2026-01-17 | manifest.json, package.json, wrangler.jsonc, sw.js, login.astro, registrati.astro, reset-password.astro, recupera-password.astro, AppLayout.astro, impostazioni.astro, forgot-password.ts, CLAUDE.md, PROJECT.md, ROADMAP.md, privacy.astro, capacitor.config.ts | WARN | Rebranding complete. Minor: schema.sql comment still says SpesaTracker |
| 2026-03-22 | 20+ files (stats API, dashboard, charts, dark mode, recurring, cron, report, privacy, import script) | OK | v1.5 overhaul: search, date range, recurring, cron, dark mode, bank alerts, 1912 txn import, charts period sync, pie chart "Altro" grouping |

---

**Last updated:** 2026-09-06 (piano; nessuna implementazione o modifica remota)
