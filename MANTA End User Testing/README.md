# MANTA end user testing pack

Materials for **manual** validation of the React pilot **Mission / Dataset** wizard alongside automated scripts.

## Layout

| Path | Contents |
|------|----------|
| **`END_USER_FORM_TEST_MATRIX.md`** | **Required:** step-by-step checklist — **each of the six wizard forms** must be tested (not only sample files). |
| `samples/` | ISO XML inputs (NODC, InPort, MDBC PS2418, ISO 19115-3 KRAKEN, collections, etc.). |
| `output-from-manta/imported/` | Preview XML captured after import flows. |
| `output-from-manta/populated-fields/` | Preview XML from populated wizard runs. |
| `reference/ncei-collection-metadata/` | **Adjudication pack:** NCEI collection-template guidance (PDF) + `ncei_template-clean.xml`. Use when testers disagree on ISO/NCEI structure—see `reference/ncei-collection-metadata/README.md`. Not a substitute for testing every `samples/` file. |
| `docs/` | `Mantas Metadata Builder End User.docx` — narrative test notes from sessions. |
| `reports/` | **Automated:** `manta-samples-iso2-audit.md` / `.json` — import each `samples/*.xml`, merge, validate, check **ISO 19115-2** preview (`buildXmlPreview`) structural bar. Regenerate: `npm run audit:manta-samples` from `react-pilot/`. |

## How to use

1. Open **`END_USER_FORM_TEST_MATRIX.md`**. For **each** file listed under **Per-sample XML — import pass**, run **Import XML**, then walk **steps 1→6** with that loaded state and check off the row (all **`samples/*.xml`** files; **20** at last count).
2. Complete the **Forms 1–6** checklists at least once per test cycle (same session after you are satisfied imports behave), plus **Cross-form checks**.
3. Regenerate the **ISO-2 alignment report** (no UI upload required for this step): `cd react-pilot && npm run audit:manta-samples` → see `reports/manta-samples-iso2-audit.md` for per-file source schema shape, validation E/W counts, and ISO-19115-2 preview gate results.
4. For engineering regression, run `npm run verify:pilot` in `react-pilot/` (see `PRODUCTION_QA_RUNBOOK.md`).

## NCEI standard docs

Collection-level expectations live under **`reference/ncei-collection-metadata/`** (guidance PDF + clean XML). Mission/dataset steps overlap partially with that template; use it as a **reference**, not a 1:1 form map to the six-step mission wizard.
