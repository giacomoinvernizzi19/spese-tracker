# Thinkin' About Money - Project Context

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
| 2026-01-17 | manifest.json, package.json, wrangler.jsonc, sw.js, login.astro, registrati.astro, reset-password.astro, recupera-password.astro, AppLayout.astro, impostazioni.astro, forgot-password.ts, CLAUDE.md, PROJECT.md, ROADMAP.md, privacy.astro, capacitor.config.ts | WARN | Rebranding complete. Minor: schema.sql comment still says SpesaTracker |
| 2026-03-22 | 20+ files (stats API, dashboard, charts, dark mode, recurring, cron, report, privacy, import script) | OK | v1.5 overhaul: search, date range, recurring, cron, dark mode, bank alerts, 1912 txn import, charts period sync, pie chart "Altro" grouping |

---

**Last updated:** 2026-03-22
