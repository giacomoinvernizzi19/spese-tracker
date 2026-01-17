# SpesaTracker - Project Context

## Overview

App per tracciamento spese personali, sviluppata per uso personale di Giacomo.

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

---

## Links

- **Repo**: https://github.com/giacomoinvernizzi19/spese-tracker
- **Roadmap**: [ROADMAP.md](./ROADMAP.md)
- **Claude Context**: [CLAUDE.md](./CLAUDE.md)

---

## Decisions

| Data | Decisione | Alternative | Perché |
|------|-----------|-------------|--------|
| 2026-01 | Astro 5 + Svelte 5 | Next.js, React | Performance, islands architecture |
| 2026-01 | Cloudflare D1 | Supabase, PlanetScale | Zero latency, edge computing |
| 2026-01 | Custom auth (bcrypt + cookies) | Auth0, Clerk | Control totale, zero vendor lock |
| 2026-01 | Nordigen per bank sync | Plaid | EU-focused, PSD2 compliant |
| 2026-01 | PWA con SVG icons | PNG icons | Placeholder, PNG per iOS futuro |

---

## Learnings

### Cosa funziona
- Edge computing D1 per latenza minima
- Auto-categorizzazione basata su storico
- Import Excel per migrazione dati

### Cosa NON funziona
- Dark mode parziale (alcune pagine mancano)
- SVG icons per iOS PWA (serve PNG)

### Gotchas
- Multi-account Cloudflare: usare .env specifico progetto
- Nordigen rate limit 10 req/day - sync manuale consigliato
- OAuth scade 90 giorni - mostrare expiry in UI

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

- Progetto personale, non Enpal
- Deploy su account Cloudflare personale
- D1 database ID: cb795d69-0853-4c77-98c3-a294bcbbe5a4

---

**Last updated:** 2026-01-17
