# Production QA Runbook (UxS Metadata Generator)

Date: 2026-02-25  
**Primary scope (current):** the **deployed React pilot** (e.g. Netlify + `/api/db`), not `file://` or an unhosted static folder.

**Historical:** sections **T01–T12** below were written for the **classic HTML + server** web app. Use them as a loose parity guide only; drive release QA from your **HTTP + `/api/db`** deployment checklist.

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