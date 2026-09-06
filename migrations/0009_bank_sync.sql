ALTER TABLE bank_connections ADD COLUMN historical_days INTEGER;
CREATE TABLE bank_sync_accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  connection_id TEXT NOT NULL REFERENCES bank_connections(id),
  provider_account_id TEXT NOT NULL,
  currency TEXT,
  last_success_at TEXT,
  covered_through TEXT,
  last_attempt_at TEXT,
  last_error TEXT,
  retry_at TEXT,
  lease_token TEXT,
  lease_until TEXT,
  PRIMARY KEY(user_id,account_key)
);
CREATE TABLE bank_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_key TEXT NOT NULL,
  candidate_key TEXT NOT NULL,
  external_id TEXT,
  connection_id TEXT NOT NULL REFERENCES bank_connections(id),
  amount REAL NOT NULL CHECK(amount>0),
  type TEXT NOT NULL CHECK(type IN ('expense','income')),
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','imported','linked','ignored')),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  UNIQUE(user_id,account_key,candidate_key)
);
CREATE INDEX idx_bank_candidates_user_status ON bank_candidates(user_id,status);

CREATE TABLE bank_request_gates (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  lease_token TEXT,
  lease_until TEXT,
  retry_at TEXT,
  PRIMARY KEY(user_id,provider_key)
);
