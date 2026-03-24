"""
Import storico spese da Excel a D1 via REST API.
File: Spese Giacomo.xlsx, foglio "Spese"
Colonne: E=data, F=descrizione, G=categoria, H=importo, I=viaggio, J=note
"""

import json
import urllib.request
import ssl
from datetime import datetime, timedelta
from pathlib import Path

# --- Config ---
ACCOUNT_ID = "73412abec77058e68525a5deca8cf8d0"
API_TOKEN = "IKc9PUs4w2LBHOunPFkAKX9aULlnm6GWaAYbVZ8c"
DB_ID = "cb795d69-0853-4c77-98c3-a294bcbbe5a4"
EXCEL_PATH = r"C:\Users\GiacomoInvernizzi\OneDrive - Enpal B.V\Attachments\Desktop\Giacomoi\Spese Giacomo.xlsx"
USER_EMAIL = "g.invernizzi.jm@gmail.com"

D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query"

# Category icon mapping for new categories
CATEGORY_ICONS = {
    "serata": "\U0001F37B",       # beer
    "pranzo lavoro": "\U0001F96A", # sandwich
    "parrucchiere": "\U0001F488",  # barber
    "energia": "\u26A1",           # lightning
    "auto": "\U0001F697",          # car
    "banca": "\U0001F3E6",         # bank
    "colazione": "\u2615",         # coffee
    "cena lavoro": "\U0001F37D\uFE0F", # plate
    "tasse": "\U0001F4CB",         # clipboard
    "farmacia": "\U0001F48A",      # pill
    "abbigliamento": "\U0001F455", # tshirt
    "regali": "\U0001F381",        # gift
    "telefono": "\U0001F4F1",      # phone
    "palestra": "\U0001F3CB\uFE0F", # weight
    "abbonamenti": "\U0001F4E6",   # package
    "casa": "\U0001F3E0",          # house
    "animali": "\U0001F436",       # dog
    "istruzione": "\U0001F4DA",    # books
    "sigarette": "\U0001F6AC",     # cigarette
    "lavanderia": "\U0001F9F9",    # broom
}

# Map Excel category names to existing D1 categories
CATEGORY_ALIASES = {
    "viaggio": "Viaggi",
    "ristorante": "Ristoranti",
    "ristoranti": "Ristoranti",
    "viaggi": "Viaggi",
    "spesa": "Spesa",
    "trasporti": "Trasporti",
    "bar": "Bar",
    "salute": "Salute",
    "svago": "Svago",
    "shopping": "Shopping",
    "bollette": "Bollette",
}

ctx = ssl.create_default_context()

def d1_query(sql, params=None):
    body = {"sql": sql}
    if params:
        body["params"] = params
    data = json.dumps(body).encode()
    req = urllib.request.Request(D1_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {API_TOKEN}")
    req.add_header("Content-Type", "application/json")
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read())
    if not result.get("success"):
        raise Exception(f"D1 error: {json.dumps(result.get('errors', []))}")
    return result["result"][0]

def d1_batch(statements):
    """Execute multiple SQL statements in a single batch request."""
    body = []
    for stmt in statements:
        entry = {"sql": stmt["sql"]}
        if "params" in stmt:
            entry["params"] = stmt["params"]
        body.append(entry)
    data = json.dumps(body).encode()
    req = urllib.request.Request(D1_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {API_TOKEN}")
    req.add_header("Content-Type", "application/json")
    resp = urllib.request.urlopen(req, context=ctx)
    result = json.loads(resp.read())
    if not result.get("success"):
        raise Exception(f"D1 batch error: {json.dumps(result.get('errors', []))}")
    return result["result"]

def main():
    # 1. Read Excel
    print(f"Reading Excel: {EXCEL_PATH}")
    try:
        import openpyxl
    except ImportError:
        print("Installing openpyxl...")
        import subprocess
        subprocess.check_call(["pip", "install", "openpyxl", "-q"])
        import openpyxl

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb["Spese"]

    rows = []
    for row in ws.iter_rows(min_row=2):  # skip header
        date_val = row[4].value   # col E (0-indexed: 4)
        desc_val = row[5].value   # col F
        cat_val = row[6].value    # col G
        amt_val = row[7].value    # col H
        trip_val = row[8].value if len(row) > 8 else None  # col I
        note_val = row[9].value if len(row) > 9 else None  # col J

        if amt_val is None or cat_val is None:
            continue

        # Parse amount
        try:
            amount = float(amt_val)
        except (ValueError, TypeError):
            continue
        if amount <= 0:
            continue

        # Parse date
        if isinstance(date_val, datetime):
            date_str = date_val.strftime("%Y-%m-%d")
        elif isinstance(date_val, str):
            for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                try:
                    date_str = datetime.strptime(date_val, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            else:
                continue
        else:
            continue

        # Build description
        desc_parts = []
        if desc_val:
            desc_parts.append(str(desc_val).strip())
        if trip_val:
            desc_parts.append(f"({str(trip_val).strip()})")
        if note_val:
            desc_parts.append(f"- {str(note_val).strip()}")
        description = " ".join(desc_parts)

        category = str(cat_val).strip()
        rows.append((date_str, description, category, amount))

    print(f"Parsed {len(rows)} transactions from Excel")

    # 2. Get user_id
    print("Looking up user...")
    result = d1_query("SELECT id FROM users WHERE email = ?", [USER_EMAIL])
    if not result["results"]:
        print(f"ERROR: User {USER_EMAIL} not found!")
        return
    user_id = result["results"][0]["id"]
    print(f"User ID: {user_id}")

    # 3. Delete existing transactions
    print("Deleting existing transactions...")
    del_result = d1_query("DELETE FROM transactions WHERE user_id = ?", [user_id])
    print(f"Deleted {del_result['meta']['changes']} existing transactions")

    # 4. Get existing categories
    cat_result = d1_query("SELECT id, name FROM categories WHERE user_id = ?", [user_id])
    existing_cats = {r["name"].lower(): r["id"] for r in cat_result["results"]}
    print(f"Existing categories: {len(existing_cats)}")

    # 5. Find unique categories from Excel
    excel_cats = set(r[2] for r in rows)
    print(f"Categories in Excel: {excel_cats}")

    # 6. Create missing categories
    for cat in excel_cats:
        cat_lower = cat.lower()
        # Check alias
        alias = CATEGORY_ALIASES.get(cat_lower, cat)
        if alias.lower() in existing_cats:
            continue
        if cat_lower in existing_cats:
            continue

        # Create new category
        icon = CATEGORY_ICONS.get(cat_lower, "\U0001F4E6")
        print(f"  Creating category: {cat} ({icon})")
        create_result = d1_query(
            "INSERT INTO categories (user_id, name, icon, color) VALUES (?, ?, ?, ?) RETURNING id",
            [user_id, cat, icon, "#6B7280"]
        )
        new_id = create_result["results"][0]["id"]
        existing_cats[cat_lower] = new_id

    # Rebuild category lookup with aliases
    def get_category_id(cat_name):
        cat_lower = cat_name.lower()
        if cat_lower in existing_cats:
            return existing_cats[cat_lower]
        alias = CATEGORY_ALIASES.get(cat_lower)
        if alias and alias.lower() in existing_cats:
            return existing_cats[alias.lower()]
        return None

    # 7. Import transactions in batches
    BATCH_SIZE = 25
    imported = 0
    errors = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i+BATCH_SIZE]
        statements = []
        for date_str, description, category, amount in batch:
            cat_id = get_category_id(category)
            if cat_id is None:
                print(f"  WARNING: No category for '{category}', skipping")
                errors += 1
                continue
            statements.append({
                "sql": "INSERT INTO transactions (user_id, amount, type, description, category_id, date, source) VALUES (?, ?, 'expense', ?, ?, ?, 'import')",
                "params": [user_id, amount, description, cat_id, date_str]
            })

        if statements:
            try:
                d1_batch(statements)
                imported += len(statements)
            except Exception as e:
                print(f"  Batch error at row {i}: {e}")
                # Fallback: insert one by one
                for stmt in statements:
                    try:
                        d1_query(stmt["sql"], stmt["params"])
                        imported += 1
                    except Exception as e2:
                        print(f"  Row error: {e2}")
                        errors += 1

        if (i + BATCH_SIZE) % 100 == 0 or i + BATCH_SIZE >= len(rows):
            print(f"  Progress: {imported}/{len(rows)} imported")

    print(f"\nDone! Imported: {imported}, Errors: {errors}")

    # 8. Verify
    count_result = d1_query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ? AND source = 'import'",
        [user_id]
    )
    print(f"Verification: {count_result['results'][0]['cnt']} import transactions in D1")

    cat_count = d1_query("SELECT COUNT(*) as cnt FROM categories WHERE user_id = ?", [user_id])
    print(f"Total categories: {cat_count['results'][0]['cnt']}")

if __name__ == "__main__":
    main()
