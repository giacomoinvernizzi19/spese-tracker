CREATE TABLE job_state (
  name TEXT PRIMARY KEY,
  lease_token TEXT,
  lease_until TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  status TEXT NOT NULL DEFAULT 'never',
  error TEXT
);
