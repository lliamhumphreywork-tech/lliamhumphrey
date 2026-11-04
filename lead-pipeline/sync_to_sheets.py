#!/usr/bin/env python3
"""
Sync pipeline output CSVs to the master Google Sheet.

Appends only NEW leads (deduped by phone, then website, then business name)
so re-runs and --enrich-only retries never create duplicates. Never touches
the `status` column on existing rows — that's the human's source of truth
for Sent / Replied / Booked / etc.

Usage:
    python sync_to_sheets.py output/leads_solar_2026-06-07.csv
"""

import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config" / "settings.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def dedupe_key(row: dict) -> str:
    """Build a normalised dedup key — Sheets strips '+' from phone numbers
    on import, so compare on digits only rather than raw strings."""
    digits = re.sub(r"\D", "", str(row.get("phone") or ""))
    if digits:
        return f"phone:{digits}"
    website = (row.get("website") or "").strip().lower().rstrip("/")
    if website:
        return f"site:{website}"
    name = (row.get("business_name") or "").strip().lower()
    return f"name:{name}" if name else ""


def get_master_sheet():
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    sheets_cfg = cfg["google_sheets"]
    creds = Credentials.from_service_account_file(
        BASE_DIR / sheets_cfg["service_account_file"], scopes=SCOPES
    )
    client = gspread.authorize(creds)
    return client.open_by_key(sheets_cfg["master_sheet_id"]).sheet1


def sync(csv_path: Path):
    sheet = get_master_sheet()
    header = sheet.row_values(1)

    existing = sheet.get_all_records()
    seen = {dedupe_key(r) for r in existing if dedupe_key(r)}

    with open(csv_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    today = datetime.now().strftime("%Y-%m-%d")
    new_rows = []
    for row in rows:
        key = dedupe_key(row)
        if not key or key in seen:
            continue
        seen.add(key)
        row["date_added"] = today
        new_rows.append([row.get(col, "") for col in header])

    if new_rows:
        sheet.append_rows(new_rows, value_input_option="USER_ENTERED")
        print(f"Synced {len(new_rows)} new lead(s) to master sheet ({len(rows) - len(new_rows)} already present, skipped)")
    else:
        print(f"No new leads to sync — all {len(rows)} already present in master sheet")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python sync_to_sheets.py output/leads_<niche>_<date>.csv")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    sync(path)
