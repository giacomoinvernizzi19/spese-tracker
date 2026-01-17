# SpesaTracker - Claude Code Context

## Quick Context

| | |
|---|---|
| **WHAT** | App tracciamento spese personali |
| **STACK** | Astro + Svelte 5 + TailwindCSS 4 |
| **DEPLOY** | Cloudflare Workers + D1 Database |
| **URL** | https://spese-tracker.g-invernizzi-jm.workers.dev |
| **REPO** | github.com/giacomoinvernizzi19/spese-tracker |

---

## Architecture

```
src/
├── components/          # Svelte components
│   ├── charts/          # Chart.js visualizations
│   └── transactions/    # Transaction UI components
├── layouts/             # Astro layouts
├── lib/                 # Shared utilities (auth.ts)
└── pages/
    ├── api/             # API routes (Cloudflare Workers)
    │   ├── auth/        # login, logout, register, me
    │   ├── categories/  # CRUD categorie
    │   ├── reports/     # Export reports
    │   ├── stats/       # Statistics endpoint
    │   └── transactions/ # CRUD transazioni
    └── *.astro          # UI pages
```

---

## Key Files

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare Workers config + D1 binding |
| `src/lib/auth.ts` | Auth utilities (bcrypt, sessions) |
| `ROADMAP.md` | Feature backlog |

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
- **Tables**: users, categories, transactions (inferred)

---

## Current Status

**Version**: 0.2.0 (Bank Sync)

**Implemented**:
- User auth (register, login, logout)
- CRUD transactions
- Categories management (hierarchical, budget)
- Statistics & charts
- Excel import
- Reports export
- Budget per categoria
- Dark mode (partial)
- Auto-categorizzazione
- PWA Offline
- Nordigen Bank Sync

**Next** (from ROADMAP.md):
- Test bank sync con banca reale
- Completare dark mode
- Export PDF
- PWA icons PNG

---

## Multi-Account Workflow

Questo progetto viene sviluppato da **due account Claude Code su PC diversi**.

### Regole di sincronizzazione:

1. **Prima di iniziare**: `git pull origin main`
2. **Durante il lavoro**: commit frequenti con messaggi chiari
3. **Fine sessione**: `git push origin main`
4. **Stato lavoro**: aggiornare questo file nella sezione "Current Status"

### Handoff tra sessioni:

Quando termini una sessione, aggiorna la sezione sotto:

---

## Last Session Handoff

**Data**: 2026-01-11
**Account/PC**: Giacomo PC (sessione continuata)
**Lavoro svolto**:
- Feature: Nordigen Bank Sync (completo)
  - Migration 0004_bank_connections.sql eseguita
  - Client Nordigen (src/lib/nordigen.ts) con token refresh, institutions, requisitions, transactions
  - API endpoints: /api/bank/institutions, /api/bank/connect, /api/bank/callback, /api/bank/accounts, /api/bank/sync
  - UI /banche page con lista account, modal selezione banca, sync, disconnect
  - Link in /impostazioni -> Conti Bancari
  - Secrets configurati: NORDIGEN_SECRET_ID, NORDIGEN_SECRET_KEY
  - wrangler.jsonc aggiornato con APP_URL variable
- Deploy completato su https://spese-tracker.g-invernizzi-jm.workers.dev

**Prossimi step**:
- Testare integrazione con banca reale (OAuth flow)
- Completare dark mode per pagine rimanenti (nuova, transazioni, login, registrati, etc.)
- Aggiungere icone PNG per PWA (192x192, 512x512)
- Test offline e sync queue per operazioni offline

**Note/Blocchi**:
- Nordigen rate limit: 10 requests/day per scope per account - sync manuale consigliato
- OAuth scade dopo 90 giorni - UI mostra expiry date
- PWA usa SVG icon come placeholder, per iOS serve PNG

---

## Version

**CLAUDE.md v1.0** - Gennaio 2026
