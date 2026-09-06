"""Collect local banking credentials without echo, shell history, or remote writes."""
import getpass
import json
import os
from pathlib import Path
import secrets

target = Path(__file__).resolve().parents[1] / '.dev.vars'
if target.exists():
    raise SystemExit('Existing .dev.vars preserved. Update it privately; this script will not overwrite it.')
secret_id = getpass.getpass('GoCardless secret ID (hidden): ').strip()
secret_key = getpass.getpass('GoCardless secret key (hidden): ').strip()
if not secret_id or not secret_key:
    raise SystemExit('Both GoCardless credentials are required. No file written.')
values = {
    'NORDIGEN_SECRET_ID': secret_id,
    'NORDIGEN_SECRET_KEY': secret_key,
    'ENCRYPTION_KEY': secrets.token_hex(32),
}
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
    output.write('\n'.join(f'{key}={json.dumps(value)}' for key, value in values.items()) + '\n')
print('Local .dev.vars saved with private permissions. Save a copy in your password manager. No remote changes made.')
