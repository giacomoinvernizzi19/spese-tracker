-- Migration: Add password reset tokens table
-- Run with: npm run wrangler -- d1 execute spese-tracker-db --remote --file=migrations/0002_password_reset_tokens.sql

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
