# Changes and TODOs

## Completed changes

### Header and template cleanup (Session: 2026-03-26)

- Updated header UI in `Index.html` with a persistent metadata info box.
  - Added inline notice and link to `https://www.ncei.noaa.gov/products/uncrewed-system-metadata-templates`.
  - Included note that external access may require deployment outside the NOAA boundary.
  - Replaced the previous popover/button approach with always-visible content.
- Added responsive behavior in `Index.html`.
  - On small screens (`max-width: 576px`), the info box is icon-only.
  - Full text/link remains visible on larger screens.
- Added `removeTestTemplatesExceptRemus()` in `Code.gs`.
  - Deletes `Templates` rows when name contains `test` or category is `test`.
  - Preserves rows with `REMUS` in the template name (case-insensitive).
- Updated `getTemplates()` in `Code.gs` to filter non-REMUS test templates as a safety guard.

### ISO schema consolidation and naming cleanup (Session: 2026-03-26)

- Removed all references to ISO 19115-3 across the workspace.
  - Replaced `ISO 19115-3`, `iso19115-3`, and `19115-3`.
  - Verified zero remaining matches.
- Standardized runtime behavior to ISO 19115-2 single-schema mode.
  - Simplified schema defaults and metadata defaults.
  - Removed duplicate/impossible schema branches introduced by prior broad replacement.
- Updated schema UI controls in `Index.html` and `Scripts.html`.
  - Reduced schema dropdown to one ISO 19115-2 option.
  - Disabled schema conversion action and replaced with informative toast messaging.
  - Renamed UI/debug wording from "smoke tests" to "health checks".
- Refactored schema support internals in `SchemaValidator.gs`.
  - Removed dead legacy parser branch (`parseISO19115_3`) and unused converter class.
  - Simplified `convertXMLSchema` for single-schema behavior (no-op for ISO 19115-2).
  - Simplified diagnostics structures and removed unused mapping/collision constants.
- Renamed key symbols for clarity.
  - `DualStandardValidator` -> `SchemaValidator`
  - `runSchemaSmokeTests` -> `runSchemaHealthChecks`
  - `runSingleSchemaSmokeTest` -> `runSingleSchemaHealthCheck`
  - `initializeDualStandardSupport` -> `initializeSchemaSupport`
  - Associated helper names updated accordingly.
- Renamed file.
  - `DualStandardSupport.gs` -> `SchemaValidator.gs`
  - Initial rename failure was caused by directory permissions on `/Users/connorcayson/Downloads/uSX`.
  - Fixed by adding user write/execute permission, then renaming.
- Updated docs for consistency.
  - Updated references and terminology in `README.md` and `CHANGELOG.md`.
  - Replaced stale file references with `SchemaValidator.gs` where appropriate.

### Live authority linking + expanded exports (Session: 2026-03-26)

- Integrated live GCMD and ROR lookup services in `Code.gs`.
  - Added cached GCMD functions: `getGcmdConceptSchemePage`, `searchGcmdKeywords`, `getGcmdKeywordByUuid`, `buildGcmdCitation`.
  - Added cached ROR functions: `searchRorOrganizations`, `getRorOrganizationById`, `buildRorCitation`.
  - Added shared HTTP/cache helpers for external JSON lookups.
- Added Mission-step UI for authority linking in `Index.html` and wiring in `Scripts.html`.
  - ROR organization search + selection with stored stable IDs/URI.
  - GCMD keyword search by scheme + multi-select chips with stored UUID-backed records.
  - Hidden mission fields now persist linked ROR/GCMD metadata through form collection.
- Added live Citation Preview in Mission step.
  - Shows selected ROR citation string and GCMD citation summary/version context.
- Extended XML generation in `DOMXMLGenerator.gs`.
  - Adds ROR org URI as organization identifier in contact/point-of-contact blocks.
  - Emits descriptive keywords from structured GCMD selections.
  - Adds `thesaurusName` citation for GCMD keyword groups (with version/link where available).
- Added new export formats.
  - Added output format options in `Index.html`: `GeoJSON` and `DCAT JSON-LD`.
  - Wired export switching in `Scripts.html` for:
    - `generateGeoJSON` -> `.geojson` (`application/geo+json`)
    - `generateDCATJsonLd` -> `.jsonld` (`application/ld+json`)
  - Implemented `generateGeoJSON` and `generateDCATJsonLd` in `Code.gs`.
  - Tightened DCAT profile:
    - richer distributions (`title`, `format`, `mediaType`)
    - `dct:conformsTo` entries for ISO and GCMD context
    - improved spatial output using WKT bbox helper (`buildWktBoundingPolygon`).

### Redundancy cleanup and shared helpers (Session: 2026-03-26)

- **`ValidationSystem.gs`**
  - Added `requireMapClientDataToServer()` as the single guard/accessor for `mapClientDataToServer` (replaces scattered `typeof` checks and duplicate wrappers).
- **`SchemaValidator.gs`**
  - Removed `requireSchemaMapClientDataToServer`.
  - `generateXMLWithSchema(data, schema, options)` maps client data by default; `options.alreadyMapped === true` skips mapping so `Code.gs` `generateXML` does not double-map.
- **`Code.gs`**
  - Replaced `requirePrimaryMapClientDataToServer` with `requireMapClientDataToServer`.
  - Added `sensorToSheetRow(sensor)`; `saveSensor` and `saveSensorsBatch` share the same column mapping.
  - `saveSensor`: normalized ID lookup (trim), required non-empty ID, upsert behavior aligned with `savePlatform` (removed erroneous “already exists” throw that made updates unreachable).
  - Consolidated `saveXmlToDrive` / `saveJsonToDrive` / `saveCsvToDrive` via internal `saveContentToDrive_(...)`, preserving validation-log labels, user-facing error prefixes, and format-specific empty-payload messages (`xmlContent` / `jsonContent` / `csvContent`).
- **`DOMXMLGenerator.gs`**
  - Uses `requireMapClientDataToServer()` instead of an inline availability check.
- **`EnhancedIntegration.gs`**
  - Uses `requireMapClientDataToServer()` for mapping.
  - Removed duplicate `validateFormDataWithRules` definition so `ValidationSystem.gs` remains the single implementation.

### Live validation consolidation + bulk-load sync (Session: 2026-03-26)

- **`Scripts.html` — single server orchestration**
  - `LiveValidator` debounces all server validation through `queueServerValidation` / `runServerValidation`.
  - Monotonic `serverRequestId` so slower legacy host RPC responses cannot overwrite newer results.
  - `getValidationLevel()` reads `#outputValidationLevel` on step 5, otherwise `#validationLevel` (replaces hardcoded `'basic'` on live and manual validation paths).
  - Global `#missionForm` … `input`/`change` handler only runs `debouncedSave()` (no duplicate `validateStepSync` alongside `LiveValidator` bindings).
  - `ensureValidationSystemsInitialized()` runs **before** `restoreFormData()` in `document.ready` so cache restore can queue server validation.
- **`Scripts.html` — step APIs**
  - `validateStepSync(step, options)` supports `{ queueServer: false }` (default queues server).
  - `navigateToStep(step, options)` supports `{ skipValidation: true }` for bulk flows.
- **`Scripts.html` — bulk load after templates / XML import / normalized populate**
  - `syncFormsAndStepsAfterBulkLoad` calls `navigateToStep(startStep, { skipValidation: true })`, runs local validation for steps 1–5 with `queueServer: false`, then **one** `queueServerValidation(400)` instead of five competing timers.
- **`Scripts.html` — UI robustness**
  - `updateValidationUI` handles missing `results` by synthesizing from `errors` / `warnings`.
  - **Next** buttons use real IDs (`nextMissionBtn`, `nextPlatformBtn`, `nextSensorsBtn`, `nextSpatialBtn`) instead of non-existent `#nextStep{n}Btn`.
  - `triggerManualValidation` uses `getValidationLevel()`.
- **`ValidationSystem.gs`**
  - `sensors.valid.installDate` compares install dates to **today** (midnight-normalized) instead of a hardcoded calendar day.
- **`CHANGELOG.md`**
  - Added **2026-03-26** entries documenting the above.

### Security / docs audit (Session: 2026-03-26)

- **`CHANGELOG.md`**
  - Production Readiness checklist and QA Matrix aligned with single-schema mode and current validation/export behavior.
- **`Scripts.html`**
  - `escapeHtml()`; ROR/GCMD result and chip markup escapes API- and form-sourced text before `.html()`.
  - Debug log text: `DualStandardSupport` → `initializeSchemaSupport completed`.
- **`Index.html`**
  - `updateValidationResults` escapes summary and error/warning strings (and catch `e.message`) before DOM insertion.
- **`Code.gs`**
  - `fetchJsonWithCache`: corrupt cache JSON triggers `cache.remove` and refetch.
- **`SchemaValidator.gs`**
  - `assertSchemaHealthAccess` user-facing error references health checks, not smoke tests.
- **`CHANGES_TODOS.md`**
  - Added **Risk register** table (spreadsheet ID, iframe mode, UrlFetch, XSS, auth, duplicate globals, doc drift).

## Open TODOs

### Roadmap / mission audit follow-up (As of: 2026-04-24)

- Finalized mission enhancement roadmap:
  - See `react-pilot/docs/MISSION_ENHANCEMENT_ROADMAP.md`.
  - Completed first implementation tranches: human-readable validator labels; plain-language step status; XML/XPath trust fixes; `MD_ProgressCode` codelist attributes; native abstract-to-GCMD suggestions; scanner `profileId` / `xmlSnippet` consistency; phrase/stopword scanner seeds; truthful CoMET preflight; named readiness bundles; scanner/keyword accessibility improvements; first-pass UxS operational context fields for deployment/run/sortie/dive.
  - Remaining preferred order: Mission step hierarchy; stronger GCMD concept search/ranking; scanner evidence refinement; audit event envelope; XML import/export mapping for UxS collection layers; richer citation/contact and roundtrip parity upgrades.
- Secure the React pilot HTTP API surface before governed deployment:
  - Add authentication and authorization checks for `react-pilot/netlify/functions/db.mjs`.
  - Add authentication and authorization checks for `react-pilot/netlify/functions/comet-proxy.mjs`.
  - Replace wildcard CORS with an explicit same-origin / approved-origin policy for deployed environments.
  - Document the CSRF/session posture for same-origin Netlify function calls.
- Replace shared CoMET session assumptions with a documented user/session model:
  - Avoid treating one server-side `COMET_SESSION_ID` as a complete authorization story.
  - Tie CoMET pull, preflight, and push attempts to an operator identity where the host environment allows it.
  - Surface clear expired-session, missing-proxy, and missing-permission states in the UI and runbook.
- Add structured audit logging for regulated workflows:
  - Record actor, timestamp, action, target record, profile, mode, and result for mission/template/platform/sensor writes.
  - Record scanner merge events, auto-fix applications, validation events, and CoMET pull/preflight/push attempts.
  - Preserve enough detail to support NOAA stakeholder reporting without logging secrets or sensitive payloads.
- Complete accessibility signoff evidence for the React pilot:
  - Run keyboard-only, screen-reader, contrast, modal, and live-region checks from `react-pilot/ACCESSIBILITY_VERIFICATION_CHECKLIST.md`.
  - Include scanner dialog, Lens overlay, readiness controls, CoMET panel, and XML preview interactions in evidence.
- Promote readiness from validation modes to named operational bundles:
  - Implemented ISO-ready, CoMET-preflight-ready, discovery-ready, and archive-handoff-ready check bundles in the React pilot.
  - Next: validate the bundle wording with NOAA stakeholders and capture keyboard/screen-reader evidence for the new readiness strip.
- Mission form enhancement candidates to evaluate:
  - Completed: human-readable field labels while preserving raw paths for support.
  - Completed: guided "Suggest from title/abstract" GCMD entry point on the Keywords step using the existing Lens scanner heuristic.
  - Improve abstract quality checks beyond "required" (length, acronym expansion, mission/platform/sensor/extent coverage).
  - Started: model NOAA UxS collection layers explicitly through Mission step operational context for deployment/run/sortie/dive.
  - Next: map operational context to ISO aggregation/import-export once the NCEI initiative type and archive search semantics are confirmed.
  - Add stronger guidance for citation parties, license/constraints, aggregation, temporal semantics, and topic categories.
  - Add richer support for multiple citation parties and full `CI_Contact` details where NCEI templates require more depth.

### Header/template follow-up (As of: 2026-03-26)

- Verify header layout readability on common mobile widths (`320px-576px`).
- Confirm NOAA external link opens correctly in the deployed legacy web app.
- Decide whether to add tooltip/title for icon-only mobile state.
- Run `removeTestTemplatesExceptRemus()` in the spreadsheet-bound script editor once to clean existing rows.
- Verify template dropdown shows only desired templates (including REMUS).
- Confirm no workflows still depend on removed non-REMUS test templates.
- Optional: remove temporary `getTemplates()` guard if hard-delete policy is sufficient.

### Schema follow-up (As of: 2026-03-26)

- Do one final naming pass for any remaining "SchemaSupport" vs "SchemaValidator" terminology.
- Validate runtime behavior in the deployed legacy web app:
  - XML generation flow
  - XML import/parse flow
  - Validation panel updates
  - Schema health check button flow
- Review historical `CHANGELOG.md` lines that now read as same-schema conversion and rewrite for clarity.
- Optional: remove remaining conversion-only UI text/tooltips if conversion is permanently disabled.

### Redundancy / spreadsheet follow-up (As of: 2026-03-26)

- Deployed smoke test: save new sensor, then save same sensor ID again and confirm row updates (not duplicate row).
- Deployed smoke test: Drive save for XML/JSON/CSV with empty payload should surface the same labeled errors as before (`xmlContent` / `jsonContent` / `csvContent` messages).
- Optional: further reduce repeated spreadsheet open/sheet-get boilerplate in `Code.gs` with small helpers (only if readability wins).

### GCMD / ROR / export follow-up (As of: 2026-03-26)

- Validate full deployed flow in the legacy web app:
  - ROR search and selection in Mission step
  - GCMD search (multiple schemes) and keyword chip add/remove
  - Citation preview updates after template load/cache restore/manual edits
  - XML generation includes:
    - ROR identifier in org sections
    - GCMD descriptive keywords + thesaurus citation blocks
- Run smoke tests for new formats:
  - GeoJSON export with valid bbox and with missing/partial bbox
  - DCAT JSON-LD export with and without ROR/GCMD selections
  - Download and Google Drive save for new formats
- Confirm backward compatibility for legacy templates that only use `mission.keywords` (no `mission.gcmdKeywords`).
- Decide whether to expose download URLs/access URLs in DCAT `distribution` entries when files are persisted to Drive.
- Optional hardening:
  - Add debounce to ROR/GCMD search inputs to reduce API calls.
  - Add retry/backoff for transient external API failures.
  - Add unit-ish test fixtures for GeoJSON/DCAT payload shape validation.

### Live validation follow-up (As of: 2026-03-26)

- Deployed web app: type across steps and confirm **one** debounced server validation (no duplicate overlapping calls in Network/Execution log patterns).
- Deployed: load a template or import XML and confirm validation summary + field highlights update after **one** round-trip (bulk sync path).
- Edge case: rapid tab switching — confirm UI reflects the latest validation only (stale-response guard).
- Optional: if step-specific “Next” gating should ignore errors on other steps, adjust `updateValidationUI` next-button logic (today it follows full-form `validation.valid` for the active step’s Next control).

## Risk register (audit: 2026-03-26)

Items below are **residual risks** or **deployment hygiene** to track—not necessarily bugs.

| Area | Risk | Mitigation / notes |
|------|------|---------------------|
| **Config / secrets** | `getSpreadsheetId()` in `Code.gs` uses a **hard-coded** spreadsheet ID in source. Public or shared repos leak tenant data; forks may write to the wrong sheet. | Prefer `PropertiesService.getScriptProperties()` (or per-user storage) and document setup in README. |
| **Clickjacking** | `doGet` sets `HtmlService.XFrameOptionsMode.ALLOWALL`, so the app may be embedded in arbitrary iframes. | If not required, use default DENY or SAMEORIGIN. |
| **External HTTP** | `UrlFetchApp` (ROR/GCMD) trusts remote JSON; GCMD/ROR outages or slow responses affect UX; `muteHttpExceptions` + status check limits silent failures. | Optional retries/backoff (see GCMD/ROR TODOs); monitor quotas. |
| **Cache integrity** | Script cache could theoretically hold bad JSON. | **Addressed:** corrupt entries are removed and refetched (`fetchJsonWithCache` in `Code.gs`). |
| **XSS (client)** | User- or API-sourced strings interpolated into HTML could execute script. | **Partially addressed:** ROR/GCMD rendering in `Scripts.html` uses `escapeHtml`; modal diff already used escaping; `updateValidationResults` in `Index.html` now escapes messages. Other `.html()` call sites are mostly static strings—re-audit if new dynamic HTML is added. |
| **Authorization** | Server functions run as the deploying user; any user with the web app URL may trigger spreadsheet/Drive operations according to **execute-as** and sharing settings for that deployment. | Confirm deploy settings (user vs owner access) match intent; restrict sensitive sheets. |
| **Schema health checks** | `runSchemaHealthChecks` / round-trip helpers require an authenticated session (`assertSchemaHealthAccess`). Anonymous deploys may hit a clear error—expected. | Document for operators. |
| **Duplicate global names** | Multiple `.gs` files share one global scope; duplicate `function` names silently override. | When adding files, grep for existing names (e.g. past `validateFormDataWithRules` duplicate). |
| **Documentation drift** | `README.md` / old `CHANGELOG` bullets still say “SchemaSupport” or “conversion” in places. | Naming pass TODO; historical `CHANGELOG` lines under 2026-02-25 kept for traceability. |

## Verification notes

- Lint status after updates: no linter errors in edited files.
- Last consolidated update date: 2026-03-26 (includes live validation consolidation, bulk-load sync, risk register + XSS/cache hardening, `CHANGELOG` production TODO reconciliation).
- Major files touched across sessions include:
  - `Code.gs`
  - `DOMXMLGenerator.gs`
  - `EnhancedIntegration.gs`
  - `Index.html`
  - `Scripts.html`
  - `SchemaValidator.gs`
  - `ValidationSystem.gs`
  - `README.md`
  - `CHANGELOG.md`
  - `CHANGES_TODOS.md`
