#!/usr/bin/env python3
"""
Validate MISSION_COMPARE_LIST CSV inputs before XML generation.

Usage:
  python3 scripts/validate_mission_compare_list.py MISSION_COMPARE_LIST_TEMPLATE.csv
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

RE_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
RE_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

REQUIRED_FIELDS = [
    "mission_key",
    "file_identifier",
    "title",
    "abstract",
    "purpose",
    "start_date",
    "end_date",
    "west",
    "east",
    "south",
    "north",
    "platform_name",
    "point_of_contact_org",
    "point_of_contact_email",
    "access_url",
]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")


def warn(msg: str) -> None:
    print(f"WARN:  {msg}")


def check_row(row_num: int, row: dict[str, str]) -> int:
    problems = 0

    for key in REQUIRED_FIELDS:
        if not str(row.get(key, "")).strip():
            fail(f"row {row_num}: missing required field `{key}`")
            problems += 1

    for key in ("start_date", "end_date"):
        v = str(row.get(key, "")).strip()
        if v and not RE_DATE.match(v):
            fail(f"row {row_num}: `{key}` must be YYYY-MM-DD, got `{v}`")
            problems += 1

    for key in ("west", "east", "south", "north"):
        v = str(row.get(key, "")).strip()
        if not v:
            continue
        try:
            float(v)
        except ValueError:
            fail(f"row {row_num}: `{key}` must be numeric, got `{v}`")
            problems += 1

    uuid_like_keys = ("metadata_uuid", "collection_uuid")
    for key in uuid_like_keys:
        v = str(row.get(key, "")).strip()
        if not v:
            continue
        if not (RE_UUID.match(v) or v.startswith("gov.noaa.ncei.uxs:") or "{" in v):
            warn(
                f"row {row_num}: `{key}` does not look like UUID or gov.noaa.ncei.uxs:* (`{v}`)"
            )

    href_keys = ("docucomp_contact_href", "docucomp_graphic_href", "license_docucomp_href")
    for key in href_keys:
        v = str(row.get(key, "")).strip()
        if v and "data.noaa.gov/docucomp/" not in v:
            warn(f"row {row_num}: `{key}` is non-docucomp URL (`{v}`)")

    return problems


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip())
        return 2

    path = Path(sys.argv[1]).expanduser()
    if not path.exists():
        fail(f"file not found: {path}")
        return 2

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            fail("CSV has no header row")
            return 2

        missing_headers = [h for h in REQUIRED_FIELDS if h not in reader.fieldnames]
        if missing_headers:
            fail(f"missing required headers: {', '.join(missing_headers)}")
            return 2

        total = 0
        errors = 0
        for idx, row in enumerate(reader, start=2):
            total += 1
            errors += check_row(idx, row)

    print(f"\nChecked {total} row(s).")
    if errors:
        print(f"Validation failed with {errors} error(s).")
        return 1
    print("Validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

