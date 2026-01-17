-- Migration: 0004_bank_connections.sql
-- Description: Add bank_connections table and extend transactions for bank sync
-- Run: npm run wrangler -- d1 execute spese-tracker-db --remote --file=migrations/0004_bank_connections.sql

-- Bank connections table
CREATE TABLE IF NOT EXISTS bank_connections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  provider TEXT DEFAULT 'nordigen' CHECK(provider IN ('nordigen', 'truelayer', 'saltedge')),
  institution_id TEXT NOT NULL,
  institution_name TEXT,
  requisition_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'linked', 'expired', 'error')),
  account_ids TEXT,
  last_sync_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_requisition ON bank_connections(requisition_id);

-- Add external_id and bank_connection_id to transactions for bank sync
ALTER TABLE transactions ADD COLUMN external_id TEXT;
ALTER TABLE transactions ADD COLUMN bank_connection_id TEXT;

-- Unique constraint to prevent duplicate bank transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external ON transactions(user_id, external_id) WHERE external_id IS NOT NULL;
