# EX cruise collection UUID list — how to use it

Source file: `EX_CRUISE_COLLECTION_UUIDS.csv` (columns: `name`, `metadata_uuid`, `component_name`, `component_uuid`).

## 1. CoMET / ISO workflows

- Use **`metadata_uuid`** as the CoMET record UUID: populate `react-pilot/fixtures/mission/comet-uuids.txt` (one UUID per line) or drive `scripts/swarm/export-comet-mission-forms.mjs` and related pull tooling for **bulk ISO fetch**, diff, validation, or truth-matrix work.
- When **`name`** is a full file identifier (e.g. `gov.noaa.ncei.oer:EX2306_COLLECTION`), align it with **`gmd:fileIdentifier`** / root **`uuid`** in generated XML so exports match the catalog.

## 2. Batch metadata generation

- Each row is a **catalog-backed identity**: scripts can set **`uuid`** on `<gmi:MI_Metadata>`, distribution landing URLs (`…/collections/details/{metadata_uuid}`), and **`fileIdentifier`** when **`name`** is the official ID string.
- **Filter** rows before batch runs: e.g. only `gov.noaa.ncei.oer:EX####_COLLECTION` for a single **cruise-level** collection per expedition, and exclude `_Imagery_`, `_Sound_Velocity_Profile_`, `_Products_`, etc., if the goal is one collection record per cruise.

## 3. Coverage / gap analysis

- Extract cruise codes from **`name`** (e.g. `EX####`) and compare to a master schedule list → **missing UUIDs**, duplicates, or unexpected extra collections.
- Review **namespace** patterns (`gov.noaa.ncei.oer:` vs `gov.noaa.ncei:` vs `gov.noaa.ncei.oer.cruise:`) for template or cleanup decisions.

## 4. OneStop / discovery QA

- Build **collection landing URLs**: `https://data.noaa.gov/onestop/collections/details/{metadata_uuid}` (verify against current NCEI URL patterns for prod vs test).
- Use UUIDs in OneStop **collection** filters when cross-checking counts against Geoportal (NCEI API comparison / search JSON patterns).

## 5. Stakeholder inventory

- Summarize **how many collection records exist per EX cruise** (cruise vs imagery vs SVP vs products) to scope “finalize EX metadata generation scripts” and set expectations for Vidhya / the team.

## 6. Component columns

- **`component_name` / `component_uuid`**: often repeat the same GCMD Platform Keywords citation across many rows; treat as **export context** unless you confirm row-specific meaning. Primary automation should key off **`name`** + **`metadata_uuid`**.

## Quick reference

| Goal | Primary column |
|------|----------------|
| CoMET pull / ISO | `metadata_uuid` |
| Human + ID string | `name` |
| Join to XML fileIdentifier | `name` when it matches `gov.noaa.ncei…` |
