"""Validate a private legacy export offline and generate baseline tracking SQL only."""
import argparse
import hashlib
import os
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def normalized(sql):
    tokens = re.findall(r"'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|\w+|[^\s]", sql or "")
    return tuple(token if token.startswith("'") else token.strip('"').lower() for token in tokens)


def schema(db):
    return {(kind, name): normalized(sql) for kind, name, sql in db.execute(
        "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"
    )}


def prepare(backup, output):
    raw = backup.read_bytes()
    actual = sqlite3.connect(':memory:')
    expected = sqlite3.connect(':memory:')
    try:
        actual.executescript(raw.decode('utf-8'))
        migrations = sorted((ROOT / 'migrations').glob('*.sql'))
        baseline = [path for path in migrations if path.name < '0008']
        for path in baseline:
            expected.executescript(path.read_text())
        expected_schema, actual_schema = schema(expected), schema(actual)
        missing_index = ('index', 'idx_password_reset_tokens_token')
        # This is the only verified legacy difference. Any other drift stops preparation.
        expected_schema.pop(missing_index)
        actual_schema.pop(missing_index, None)
        if actual_schema != expected_schema:
            raise ValueError('Legacy schema differs from the reviewed baseline; no SQL generated')
        if missing_index in schema(actual) and schema(actual)[missing_index] != schema(expected)[missing_index]:
            raise ValueError('Token index differs from baseline; no SQL generated')
        if actual.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or list(actual.execute('PRAGMA foreign_key_check')):
            raise ValueError('Backup integrity validation failed')
        tables = [row[0] for row in actual.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        snapshots = {name: (list(actual.execute(f'PRAGMA table_info("{name}")')), list(actual.execute(f'SELECT * FROM "{name}" ORDER BY rowid'))) for name in tables}
        sequences = dict(actual.execute('SELECT name,seq FROM sqlite_sequence'))
        index_sql = (ROOT / 'migrations/0006_token_index.sql').read_text().strip()
        names = ',\n'.join("('" + path.name + "')" for path in baseline)
        sql = (f'-- Prepared from backup SHA256 {hashlib.sha256(raw).hexdigest()}\n'
               '-- Execute only after all writers are stopped and this snapshot is revalidated.\n'
               + index_sql + '\n'
               'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);\n'
               'INSERT INTO d1_migrations(name) VALUES\n' + names + ';\n')
        actual.executescript(sql)
        for path in migrations:
            if path.name >= '0008':
                actual.executescript(path.read_text())
        for name, (columns, rows) in snapshots.items():
            projection = ','.join('"' + col[1] + '"' for col in columns)
            if rows != list(actual.execute(f'SELECT {projection} FROM "{name}" ORDER BY rowid')):
                raise ValueError(f'Migration changes historical values in {name}')
        after_sequences = dict(actual.execute('SELECT name,seq FROM sqlite_sequence'))
        if any(after_sequences.get(name, -1) < seq for name, seq in sequences.items()):
            raise ValueError('Migration reuses historical identifiers')
        if actual.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or list(actual.execute('PRAGMA foreign_key_check')):
            raise ValueError('Post-migration integrity validation failed')
        with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as target:
            target.write(sql)
        print('PASS: exact legacy schema, historical values, sequences and migration integrity; baseline SQL prepared. No remote writes.')
    finally:
        actual.close()
        expected.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    prepare(args.backup, args.output)
