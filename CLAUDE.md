# SpesaTracker - Claude Code Context

## Quick Context

| | |
|---|---|
| **WHAT** | App tracciamento spese personali |
| **STACK** | Astro + Svelte 5 + TailwindCSS 4 |
| **DEPLOY** | Cloudflare Workers + D1 Database |
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
npx wrangler deploy  # Deploy to Cloudflare
```

---

## Database (D1)

- **Name**: spese-tracker-db
- **ID**: cb795d69-0853-4c77-98c3-a294bcbbe5a4
- **Tables**: users, categories, transactions (inferred)

---

## Current Status

**Version**: 0.0.1 (Initial commit)

**Implemented**:
- User auth (register, login, logout)
- CRUD transactions
- Categories management
- Statistics & charts
- Excel import
- Reports export

**Next** (from ROADMAP.md):
- Budget per categoria
- Dark mode
- Export PDF

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

**Data**: (da aggiornare)
**Account/PC**: (da aggiornare)
**Lavoro svolto**: (da aggiornare)
**Prossimi step**: (da aggiornare)
**Note/Blocchi**: (da aggiornare)

---

## Version

**CLAUDE.md v1.0** - Gennaio 2026
