-- Upgrades the legacy month/year budget schema. Preflight must confirm this shape.
-- Existing dated budgets remain dated; new recurring limits use NULL month/year.
CREATE TABLE budgets_next (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly', 'yearly')),
    month INTEGER CHECK(month BETWEEN 1 AND 12),
    year INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK ((year IS NULL AND month IS NULL) OR (year IS NOT NULL AND month IS NOT NULL AND period = 'monthly'))
);
INSERT INTO budgets_next (id, user_id, category_id, amount, period, month, year, created_at)
SELECT id, user_id, category_id, amount, 'monthly', month, year, created_at FROM budgets;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'budgets'), 0)) WHERE name = 'budgets_next';
DROP TABLE budgets;
ALTER TABLE budgets_next RENAME TO budgets;
CREATE UNIQUE INDEX idx_budgets_scope ON budgets(user_id, COALESCE(category_id, -1), period, COALESCE(year, -1), COALESCE(month, -1));
CREATE INDEX idx_budgets_user_category ON budgets(user_id, category_id);

CREATE TABLE transactions_next (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'income')),
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'import', 'bank', 'recurring')),
    external_id TEXT,
    bank_connection_id TEXT,
    recurring_id INTEGER,
    occurrence_date DATE,
    import_batch_id TEXT,
    import_row_id INTEGER,
    CHECK ((recurring_id IS NULL) = (occurrence_date IS NULL)),
    CHECK ((import_batch_id IS NULL) = (import_row_id IS NULL))
);
INSERT INTO transactions_next (id,user_id,amount,type,description,category_id,date,created_at,updated_at,source,external_id,bank_connection_id)
SELECT id,user_id,amount,type,description,category_id,date,created_at,updated_at,source,external_id,bank_connection_id FROM transactions;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'transactions'), 0)) WHERE name = 'transactions_next';
DROP TABLE transactions;
ALTER TABLE transactions_next RENAME TO transactions;
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE UNIQUE INDEX idx_transactions_external ON transactions(user_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_transactions_occurrence ON transactions(user_id, recurring_id, occurrence_date) WHERE recurring_id IS NOT NULL;
CREATE UNIQUE INDEX idx_transactions_import_row ON transactions(user_id, import_batch_id, import_row_id) WHERE import_batch_id IS NOT NULL;
