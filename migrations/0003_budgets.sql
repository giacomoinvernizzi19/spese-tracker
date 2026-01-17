-- Migration: 0003_budgets.sql
-- Description: Add budgets table for category budget tracking
-- Run: npm run wrangler -- d1 execute spese-tracker-db --remote --file=migrations/0003_budgets.sql

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT DEFAULT 'monthly' CHECK(period IN ('monthly', 'yearly')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(user_id, category_id, period)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets(user_id, category_id);
