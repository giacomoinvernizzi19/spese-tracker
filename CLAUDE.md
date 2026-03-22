# Thinkin' About Money - Claude Code Context

## Quick Context

| | |
|---|---|
| **WHAT** | Personal expense tracking app |
| **STACK** | Astro + Svelte 5 + TailwindCSS 4 |
| **DEPLOY** | Cloudflare Workers + D1 Database |
| **URL** | https://thinkin-about-money.g-invernizzi-jm.workers.dev |
| **REPO** | github.com/giacomoinvernizzi19/spese-tracker |
| **APP ID** | com.thinkinaboutmoney.app |

---

## Branding

| Key | Value |
|-----|-------|
| Full Name | Thinkin' About Money |
| Short Name | Thinkin' |
| Package | thinkin-about-money |
| App ID | com.thinkinaboutmoney.app |
| Tagline | Track your money, think about tomorrow |
| Logo | 💭💰 |

---

## Architecture

```
src/
├── components/          # Svelte components
│   ├── charts/          # Chart.js visualizations
│   └── transactions/    # Transaction UI components
├── layouts/             # Astro layouts
├── lib/                 # Shared utilities (auth.ts, recurring.ts)
└── pages/
    ├── api/             # API routes (Cloudflare Workers)
    │   ├── auth/        # login, logout, register, me
    │   ├── categories/  # CRUD categorie
    │   ├── cron/        # Daily cron (recurring gen + cleanup)
    │   ├── recurring/   # CRUD recurring transactions
    │   ├── reports/     # Export reports
    │   ├── stats/       # Statistics endpoint (supports from/to range)
    │   └── transactions/ # CRUD transazioni (supports search + date range)
    └── *.astro          # UI pages
```

---

## Key Files

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare Workers config + D1 binding + cron trigger |
| `src/lib/auth.ts` | Auth utilities (bcrypt, sessions) |
| `src/lib/recurring.ts` | Recurring transaction generation logic |
| `ROADMAP.md` | Feature backlog & roadmap |
| `public/manifest.json` | PWA configuration |
| `public/sw.js` | Service Worker (cache v3) |

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:4321)
npm run build        # Build for production
npm run deploy       # Deploy to Cloudflare (usa .env)
```

---

## Wrangler Multi-Account Setup

Questo progetto usa un account Cloudflare **diverso** da quello Enpal.

**IMPORTANTE:** Prima di usare `wrangler deploy`, assicurati di avere il file `.env`:

```bash
cp .env.example .env
# Poi modifica .env con i valori corretti
```

Il file `.env` sovrascrive le credenziali globali. NON è committato (in .gitignore).

**Credenziali per questo progetto** (account personale Giacomo):
- CLOUDFLARE_ACCOUNT_ID: (vedi Cloudflare Dashboard)
- CLOUDFLARE_API_TOKEN: (crea da dash.cloudflare.com/profile/api-tokens)

---

## Database (D1)

- **Name**: spese-tracker-db
- **ID**: cb795d69-0853-4c77-98c3-a294bcbbe5a4
- **Tables**: users, categories, transactions, password_reset_tokens, bank_connections, recurring_transactions, sessions

---

## Current Status

**Version**: 1.5.0 (Feature Complete)

**Implemented**:
- User auth (register, login, logout, password reset)
- CRUD transactions with text search
- Categories management (hierarchical, budget)
- Statistics & charts (react to period selector)
- Dashboard period presets (month/3mo/year/custom date range)
- Pie chart "Altro" grouping (categories < 3% grouped, expandable)
- Excel import + historical data import (1912 transactions)
- Reports with annual breakdown
- Budget per categoria
- Recurring transactions (monthly/weekly/yearly + management UI)
- Cron auto-sync (daily 06:00 UTC - recurring gen + session cleanup)
- Dark mode complete (all pages)
- Bank sync (Nordigen) with expiry alerts
- PWA Offline
- Auto-categorizzazione
- Rate limiting + secure headers

**Next** (from ROADMAP.md):
- v2.0 ideas: PNG icons, PDF export, deduplication, push notifications

---

## Cron & Secrets

| Secret | Purpose |
|--------|---------|
| `CRON_SECRET` | Protects `/api/cron/daily` endpoint |
| `ENCRYPTION_KEY` | AES-256-GCM for bank data |
| `RESEND_API_KEY` | Password reset emails |
| `NORDIGEN_SECRET_ID` | Bank sync API |
| `NORDIGEN_SECRET_KEY` | Bank sync API |

**Cron schedule**: `0 6 * * *` (daily 06:00 UTC = 07:00 CET)

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

---

## Gotchas

- **Deploy**: `env -u CLOUDFLARE_API_TOKEN npx wrangler deploy` (personal account, NOT Enpal token)
- **Tailwind 4**: No `@apply` in scoped `<style>` blocks - use inline classes or plain CSS
- **D1 batch API**: Returns 400 for multi-statement arrays - use single-row fallback
- **Pie chart**: Categories < 3% of total auto-grouped into "Altro" (expandable on click)
- **Charts**: Dashboard charts listen for `periodChanged` CustomEvent to sync with period selector

---

## Version

**CLAUDE.md v3.0** - v1.5 Feature Complete - March 2026
