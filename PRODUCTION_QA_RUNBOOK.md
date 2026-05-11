# Production QA Runbook (UxS Metadata Generator)

Date: 2026-02-25  
**Primary scope (current):** the **deployed React pilot** (e.g. Netlify + `/api/db`), not `file://` or an unhosted static folder.

**Manual React pilot smoke:** use **R01–R12** below (wizard steps **1 Mission → 6 Distribution**). **Automated smoke** for the mission profile is `npm run verify:pilot` and `node scripts/test-fixtures.mjs` (see table under Test Data Set A).

**Historical:** sections **T01–T12** at the end of this file were written for the **classic HTML + server** web app. Prefer **R01–R12** + automated scripts for the React pilot; keep T01–T12 only for legacy parity.

**Related docs:** [README.md](README.md), [react-pilot/docs/DEPLOYMENT.md](react-pilot/docs/DEPLOYMENT.md), [METADATA_FIELD_MAP.md](METADATA_FIELD_MAP.md) (field ↔ JSON ↔ XML), [OVERVIEW_TEMPLATE_ALIGNMENT.csv](OVERVIEW_TEMPLATE_ALIGNMENT.csv) (section-level alignment). For the static **`pilot-share/`** bundle, use **Appendix A**.

## How to Use This Runbook

- For each test case: execute steps exactly, mark Pass/Fail, and capture notes/screenshots.
- If a step fails, record:
  - Exact step number
  - Observed behavior
  - Browser console errors
  - Network request/response (if relevant)

---

## Test Data Set A (Baseline)

Use these values where needed:

- Mission ID: `QA-MISSION-001`
- Mission Title: `QA Mission Baseline`
- Platform ID: `QA-PLATFORM-001`
- Platform Name: `QA Platform Alpha`
- Sensor ID: `QA-SENSOR-001`
- Sensor Type: `SBE CTD Sensor`

---

## Automated smoke — mission profile (engineering gate)

Run from `react-pilot/`:

| Script | Command | What it exercises |
|--------|---------|-------------------|
| **verify-pilot** | `npm run verify:pilot` | ESLint, production build, BEDI XML parser smoke, then Node checks including: seeded **ISO 19115-2** XML preview **→ import round-trip**, NCEI `fileIdentifier` prefix behavior, NOAA/fixture imports, validation parity, BEDI preview round-trips, GeoJSON/DCAT Netlify path, readiness bundles, and **structural ISO sanity** on mission preview (root `gmi:MI_Metadata`, `xmlns:gmi`, `schemaLocation` for gmi.xsd, geographic bbox corners as `gco:Decimal`). |
| **test-fixtures** | `node scripts/test-fixtures.mjs` | Every file in `react-pilot/fixtures/mission/*.xml` through **import → merge → auto-fix → validate**; prints per-file issues; **exits non-zero on parse/merge crashes** (validation errors on deliberate BAD fixtures are expected). |

Together these subsume the classic Apps Script **Run Smoke Tests** / schema round-trip button for CI and local pre-push checks.

---

## R01–R12 — React pilot (UxS mission profile) manual smoke

**Wizard steps:** 1 Mission · 2 Platform · 3 Sensors · 4 Spatial · 5 Keywords · 6 Distribution (plus XML preview / validation UI). Use **Test Data Set A** where it helps.

| ID | Goal | Procedure (high level) | Expected |
|----|------|------------------------|----------|
| R01 | Boot | Open deployed URL or dev server; confirm **Mission / Dataset** profile | First step visible; XML preview/tools load; no blocking error surface |
| R02 | Navigation + validation | Move **1 → 6 → 1**; leave a required mission field empty; trigger validation | Step state persists; invalid fields show issues |
| R03 | Template round-trip | Fill several steps; **save template**; clear session/form; **load template** | Values restore; preview updates |
| R04 | Template delete | Delete the template from R03 | Gone from picker; no stale state |
| R05 | Platform library | Platform step: save/load/search platform (**needs `/api/db`** for full path) | Same intent as classic T05 |
| R06 | Sensors | Add/remove sensor rows; exercise save/load if offered | Consistent state and preview |
| R07 | XML import | **Import XML** with a known-good mission fixture | Forms populate; validation runs; preview reflects import |
| R08 | Schema / ISO variant | Only if the build exposes **Convert** or alternate ISO targets | Conversion or export matches product docs; preview refreshes |
| R09 | Validation modes | Switch **lenient / strict / catalog** (toolbar or validation rail) | Mode drives validation; counts/issues update |
| R10 | Distribution + export | Distribution step: links, license, fees; trigger **preview refresh** / download if present | XML/metadata outputs stay coherent |
| R11 | GeoJSON / DCAT (optional) | From actions that call host exports (**`/api/db`**) | GeoJSON and DCAT responses succeed when enabled |
| R12 | Automated gate | Before tagging a release: `npm run verify:pilot`; optional `node scripts/test-fixtures.mjs` | Both succeed locally or in CI |

**Sign-off (React):** Passed ____ / 12 — Blocking: ☐ Yes ☐ No — Tester: ______ — Date: ______

---

## Classic HTML app — T01–T12 (historical manual tests)

The cases below reference the **five-tab** classic UI (Mission through Output). Use them only when validating legacy parity.

## T01 - App Boot + Initial Render

1. Open the deployed app URL.
2. Confirm Step 1 is active.
3. Confirm header controls are visible: Import XML, Templates, Target Schema, Convert button, Run Smoke Tests.
4. Confirm XML preview panel loads and does not show fatal errors.

Expected:

- No blocking error toast.
- UI renders all 5 tabs and both side panels.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T02 - Step Navigation + Validation Wiring

1. Click tabs 1 -> 2 -> 3 -> 4 -> 5 and back to 1.
2. Use Next/Previous buttons between steps.
3. Leave one required field blank on Step 1 and trigger validation.

Expected:

- Navigation always switches visible step form.
- Required field gets invalid styling/message.
- Returning to a step preserves entered values.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T03 - Template Save Round-Trip

1. Fill Steps 1-5 with unique QA values (including metadata schema and output settings).
2. Open Templates dropdown -> Save as Template.
3. Save with name: `QA_TEMPLATE_E2E_001`.
4. Clear form (header Clear Form).
5. Load `QA_TEMPLATE_E2E_001` from template dropdown.

Expected:

- All relevant form fields repopulate (Steps 1-5).
- Sensor cards/platform fields restore correctly.
- XML preview refreshes to loaded content.
- No stale values from pre-clear state.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T04 - Template Delete

1. Select `QA_TEMPLATE_E2E_001`.
2. Click Delete Template.
3. Reopen template dropdown list.

Expected:

- Template is removed from selector.
- Success toast appears.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T05 - Platform Save/Load/Search Robustness

1. Go to Step 2.
2. Enter Platform ID `QA-PLATFORM-001`, name/type and other fields.
3. Click Save Platform.
4. Select same platform from Load Saved Platform.
5. Use Search button with `QA-PLATFORM-001`.

Expected:

- Save succeeds once (no duplicate handler behavior).
- Load repopulates Step 2 values accurately.
- Search populates fields consistently.
- XML preview updates after load/save.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T06 - Sensor Add/Save/Load/Remove Robustness

1. Go to Step 3.
2. Add sensor from type selector.
3. Set Sensor ID `QA-SENSOR-001` and fill key fields.
4. Save Sensors.
5. Load from saved sensors dropdown.
6. Remove a sensor card.

Expected:

- No duplicate event behavior.
- Validation catches empty/invalid required values.
- Save and load work consistently.
- Remove updates step state and preview.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T07 - XML Import End-to-End

1. Prepare a valid XML file for ISO 19115-2 or ISO 19115-2.
2. Click Import XML and choose file.
3. Wait for parse/population completion.

Expected:

- Detected schema updates target schema dropdown.
- Forms repopulate across relevant steps.
- Steps revalidate and XML preview refreshes.
- No stale values or partial state.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T08 - ISO 19115 Schema Conversion (3 -> 2)

1. Set schema dropdown to ISO 19115-2 and ensure non-empty form data.
2. Click Convert to Selected Schema with target ISO 19115-2.

Expected:

- Conversion success toast.
- Forms repopulated from converted XML.
- Metadata Standard/Version sync to ISO 19115-2 defaults.
- XML preview refreshes.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T09 - ISO 19115 Schema Conversion (2 -> 3)

1. Set schema dropdown to ISO 19115-2 with valid data loaded.
2. Convert to ISO 19115-2.

Expected:

- Conversion success toast.
- Forms repopulated correctly.
- Metadata Standard/Version sync to ISO 19115-2 defaults.
- XML preview refreshes.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T10 - Step 5 Output/Validation-Level Consistency

1. Go to Step 5.
2. Change Output Validation Level.
3. Confirm right-panel Validation Level selector mirrors the change.
4. Change right-panel Validation Level selector.
5. Confirm Step 5 Output Validation Level mirrors it.

Expected:

- Bidirectional sync between `outputValidationLevel` and preview `validationLevel`.
- XML preview refreshes on change.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T11 - Generate/Export (XML)

1. Use valid data.
2. On Step 5 set Output Format = XML, Output Location = Download.
3. Click Generate Metadata.

Expected:

- Validation passes.
- XML download starts with expected filename prefix (`ISO2_` or `ISO3_`).
- Loading indicator closes when complete.

Result: ☐ Pass ☐ Fail  
Notes:

---

## T12 - Smoke Tests Button

1. Click Run Smoke Tests.
2. Wait for completion toast.

Expected:

- Toast summarizes pass/fail count.
- No uncaught UI errors.

Result: ☐ Pass ☐ Fail  
Notes:

---

## Sign-off Summary

- Total Passed: ____ / 12
- Blocking Issues: ☐ Yes ☐ No
- Ready for Production: ☐ Yes ☐ No
- Tester:
- Date/Time:

---

## Appendix A — Static `pilot-share/` bundle (React pilot)

**Environment:** `python3 -m http.server … --directory pilot-share` or equivalent HTTPS hosting of the publish output. **No** same-origin `/api/db` here unless you add a proxy — host-backed actions need a real API origin (e.g. `netlify dev` or your deployed site).

Use this as a **smoke / review** pass after `npm --prefix react-pilot run publish` (see [PILOT_SHARE_WORKFLOW.md](PILOT_SHARE_WORKFLOW.md)).


| #   | Check                    | Expected                                                                                                                                                 |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Open `/`                 | React pilot loads; profile picker and theme toggle work.                                                                                                |
| A2  | Bridge smoke             | On a host with `/api/db`, Validator **Bridge check** reports the API reachable. |
| A3  | Field parity spot-check  | Compare a few mission/platform/distribution fields against [METADATA_FIELD_MAP.md](METADATA_FIELD_MAP.md) §2 and §7.                                    |


**Sign-off (appendix):** Passed ____ / 3 — Notes: