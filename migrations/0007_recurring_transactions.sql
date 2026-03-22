-- Recurring transactions
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'income')),
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'weekly', 'yearly')),
    day_of_month INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    last_generated DATE,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);
