-- Rate limiting table for auth endpoints
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,           -- IP address or email
  key_type TEXT NOT NULL,      -- 'ip' or 'email'
  endpoint TEXT NOT NULL,      -- 'login', 'register', 'forgot-password'
  attempts INTEGER DEFAULT 1,
  first_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  blocked_until TEXT,          -- If set, requests are blocked until this time
  UNIQUE(key, key_type, endpoint)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key, key_type, endpoint);

-- Index for cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_attempt ON rate_limits(last_attempt_at);
