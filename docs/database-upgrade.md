# Database upgrade runbook

The ordered files in `migrations/` are the schema source of truth. `0001_initial.sql` establishes the historical baseline for an empty database; `0008_ledger_integrity.sql` explicitly upgrades it. Never run a reset script against an existing database.

## Before a production upgrade

1. Export D1 using the personal Cloudflare account to a private path outside Git. Restrict permissions; never upload backups or customer data to CI.
2. Restore the export into an isolated database. Verify counts and totals before/after the proposed migration, and run `PRAGMA foreign_key_check` and `PRAGMA integrity_check`.
3. Inspect the actual schema, not just `d1_migrations`: historical changes were applied with direct SQL. The migration 0008 input is the legacy `budgets(month,year)` and `transactions(external_id,bank_connection_id)` schema, with migrations 0002-0007 tables already present. Abort if this input differs; do not blindly replay ALTER statements or mark migrations applied based on filenames alone.
4. Verify application compatibility and schedule a short maintenance window for the transactional table replacement. D1 tests confirm batch rollback. Obtain production release approval before applying any remote SQL.
5. Apply the reviewed upgrade once using the supported D1 migration mechanism after reconciling its tracking with the inspected schema. Verify record counts/totals, indexes, foreign keys and application smoke tests. Record exact commit, migration and deployment IDs in PROJECT.md.

## Local verification

- `npm test`: synthetic legacy upgrade, preservation and uniqueness tests.
- `node scripts/test-d1.mjs`: actual local D1 engine, migrations and batch rollback; no remote binding.
- `npm run db:local`: initialize a disposable local D1 database from the full migration chain.

Existing dated budgets retain `month` and `year`. New recurring budget limits use NULL `month`/`year` and a monthly/yearly period. The API must prefer a dated assignment for its specific month over a recurring limit; it must not sum the two for the same category.

The original checkout's May 2026 password UI changes were recovered into the implementation worktree. Lockfile normalization is limited to package name/version metadata; unrelated peer flag changes were not copied. No production deployment has been performed by this work.
