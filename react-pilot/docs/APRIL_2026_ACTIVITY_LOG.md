# April 2026 — activity log (git `main`)

This document is a **monthly digest of commits** on branch `main` for **April 2026**, plus short pointers to narrative and planning notes elsewhere in the repo. It is intended for status emails, reviews, and onboarding (“what landed when”).

For deeper engineering narrative (Netlify `/api/db`, lens behavior, deployment), see **`SUMD_TECHNICAL_REPORT_APRIL_2026.md`**. For tag-up notes, Swarm checklist, and demo framing, see **`CHANGES_TODOS.md`** at the repository root.

---

## Highlights

- **2026-04-30 — Pilot v0.1.0 (`67f1a13`)**  
  Large integration commit: command-center **dashboard** (UxS rail + stats), **OER pipeline** dashboard with **CSV / InfoBroker-offline** table layout (compact rows, lane strip), **OneStop** catalog strip, additional **Netlify** functions (`oer-query`, `onestop-stats`, `mission-list-validate`), **Swarm** rules/schemas/scripts and compiled bundles, mission fixtures, intake/libraries/archive surfaces, Comet and validation wiring updates. `react-pilot` version bumped to **0.1.0**. Published to **Netlify** production from this baseline.

- **2026-04-26–29 — Manta Lens + wizard layout**  
  Dual-surface workspace, scanner API and portal sizing, validator tab and XML-style presentation, glass chrome and tray ordering, wizard column order aligned with first-push layout.

- **2026-04-29 — Validation documentation**  
  Generated and linked mission validation matrices (by field, by GCMD facet / wizard area), README pointers, Saildrone exemplar crosswalk.

- **2026-04-24 — Repository hygiene**  
  Removal of Google Apps Script entry path; prep for GitHub-centric workflow.

- **2026-05-06 — Workspace session (full uSX/Manta audit + ops)**  
  **Summary:** Three-layer audit (Pilot, NOAA MCP, MV3 extension), Netlify route/CORS review, XML/import scope, profile matrix, reaudit of `verify:pilot` (failing on NOAA template POC contact import), git rebase/lens merge, CartRabbit-style desktop mock reskin. **Canonical digest:** Cursor canvas `usx-manta-audit.canvas.tsx` (whole-audit tables + todos). **Written digest:** section *Whole audit digest — uSX / Manta* below.

---

## Whole audit digest — uSX / Manta (2026-05-06)

*Non-commit engineering record for status and onboarding. Mirrors the expanded Cursor canvas checklist.*

### Product model (three layers)

| Layer | Role |
|-------|------|
| **react-pilot** | Canonical metadata generator: `pilotState`, profileregistry (mission, collection, BEDI collection/granule), wizard, `xmlPreviewBuilder` / `xmlPilotImport` (mission), BEDI preview + parsers, validation (`ValidationEngine` + profile rule sets), Manta Ray (`AssistantShell`), Lens + scanner suggestions (`lensScan` / heuristic), optional same-origin `POST /api/db`, CoMET UI via `comet-proxy`. |
| **mcp/noaa-metadata** | Local stdio MCP: read-only Google OAuth (Drive + Sheets scopes); discovery/extract/summarize; **not** the in-browser Pilot state machine. |
| **manta-chrome-extension** | MV3 “Manta Pilot Bridge”: capture page/selection/XML-ish → `chrome.storage.local` → open Pilot `#manta-capture`; same-origin `manta:extension-capture` / `postMessage` consumed in `XmlToolsBar`. |

### Netlify: `POST /api/db` (`db.mjs`)

Router body `{ fn, args }`. **Postgres (requires `DATABASE_URL`):** `getPlatforms`, `savePlatform`, `getSensors`, `saveSensor`, `saveSensorsBatch`, `getTemplates`, `getTemplate`, `saveTemplate`, `deleteTemplate`, `logValidation`. **Stateless (no DB):** `generateGeoJSON`, `generateDCAT`, `validateOnServer` (legacy formData → mission `ValidationEngine`), `lensScan` (heuristic envelope). **CORS:** `Access-Control-Allow-Origin: *` on this function — treat as sensitive if the URL is public.

### Other Netlify functions (current tree)

| Function | Notes |
|----------|--------|
| **comet-proxy.mjs** | CoMET + metaserver; **Origin allowlist** (default localhost/127.0.0.1:5173 + `COMET_PROXY_ALLOWED_ORIGINS`); session via env or `X-Comet-JSessionId` / metaserver header. |
| **manta-intent.mjs** | Gemini → structured commands; requires `GEMINI_API_KEY`; **not called from `react-pilot/src`**. |
| **mission-list-validate.mjs** | CSV mission list validation; CORS `*`. |
| **oer-query.mjs** | InfoBroker XML-RPC proxy; credentials via `OER_BROKER_URL`; CORS `*`. |
| **onestop-stats.mjs** | OneStop-style totals / fallback; CORS `*`. |

### Client-side enrichment

- **GCMD:** `gcmdClient.js` — browser `fetch` to CMR KMS (`VITE_GCMD_KMS_BASE` optional); not a first-party Netlify route for KMS search.
- **ROR:** `rorClient.js` — `https://api.ror.org/v2/organizations`.
- **Quality score:** `ValidationEngine` — `100 - 8×errors - 3×warnings` (issue severities `e` / `w`).

### Manta surfaces (control map, condensed)

- **Header:** `XmlToolsBar` (portal to `#pilot-header-tools-slot`) — import/paste/zip, scanner dialog, copy/download XML, GeoJSON/DCAT, CoMET push when profile allows.
- **Wizard:** `WizardShell` — step nav, Validator / Live XML / CoMET side rail; `buildXmlPreview` or `isoXmlAdapter` fallback.
- **Assistant:** `AssistantShell` — floating widget + Lens (readiness, issues, GCMD/ROR search tab, CoMET tab, fix walk).
- **Events:** `mantaHostEvents.js` — `manta:open-lens`, `manta:goto-step`, `manta:set-pilot-field`, `manta:comet-load`, etc.

### Profiles (same shell, different caps)

| Profile | Steps | Notable caps |
|---------|-------|----------------|
| **mission** | Mission → Platform → Sensors → Spatial → Keywords → Distribution | Full XML preview/import, `scannerPrefill`, GeoJSON/DCAT server hooks, `serverValidate`, CoMET pull/preflight/push, libraries/templates. |
| **collection** | Identification, Extent, Distribution | Minimal POC; **`importParsers: []`**, no `buildXmlPreview` → XmlToolsBar import/copy/download off; Live XML fallback is generic/mission-shaped (weak for collection state). |
| **bediCollection** / **bediGranule** | Three-step BEDI flows | Dedicated BEDI XML preview + parsers; CoMET typically on; scanner / geo / dcat / serverValidate off vs mission. |

### XML pipeline & documentation

| Track | Modules / docs |
|-------|----------------|
| Mission export | `react-pilot/src/lib/xmlPreviewBuilder.js` |
| Mission import | `react-pilot/src/lib/xmlPilotImport.js` (`importPilotPartialStateFromXml`) |
| Coverage legend | `react-pilot/docs/uxs-ncei-template-mission-pilot-matrix.md` |
| Narrative | `react-pilot/docs/uxs-ncei-gmi-xml-narrative-overview.md` (mission-centric; qualify for BEDI) |
| BEDI | Profile `buildBedi*XmlPreview`, `bedi*ImportParser`; `scripts/verify-pilot.mjs` includes BEDI roundtrip sections |

### NOAA MCP tools (seven)

`list_allowed_sources`, `search_drive_metadata_files`, `get_drive_file_metadata`, `extract_metadata_from_file`, `download_allowed_file_text`, `summarize_cruisepack_candidates`, `browser_test_plan_for_catalog_page`. **Gap:** search honors allowlist; **fileId tools do not prove folder/drive membership** beyond Drive ACLs.

### Chrome extension caveats

- Broad `host_permissions` (`http://*/*`, `https://*/*`), storage of large captures, FAB on pages.
- **`localhost` vs `127.0.0.1`** — different origins vs `content.js` / `popup` pilot URL; capture may not deliver if mismatched.

### Risks / product gaps (priority)

1. **High:** Public `db.mjs` + unauthenticated CRUD/templates if deployed wide open.  
2. **Medium:** Wildcard CORS + sensitive proxies (`oer-query`, intents, CSV validator, stats).  
3. **Medium:** MCP misleading “allowed” naming on download/extract by arbitrary `fileId`.  
4. **Medium:** `HttpHostAdapter.isAvailable()` always true — UX assumes Netlify-backed APIs on plain Vite.  
5. **Low:** Voice / `manta-intent` not wired from React; Lens scan uses **`/api/db` `lensScan`**, not intent.

### Follow-up todos (also on Cursor canvas)

- Restore **`npm run verify:pilot`** — NOAA fixture POC contact fields vs importer or assertion.  
- Fix **ESLint** `react-hooks/exhaustive-deps` warnings (`LibrariesView.jsx`, `AssistantShell.jsx`).  
- **Harden Netlify** (CORS, auth, network) before public exposure of write/proxy endpoints.  
- **Wire or hide** `MantaVoiceBar` / `/api/manta-intent`.  
- **MCP:** allowlist enforcement or rename tools for fileId paths.  
- **Extension:** narrow permissions; align pilot URL in docs defaults.

---

## Commits on `main` (April 1–30, 2026)

| Date       | SHA       | Subject |
|------------|-----------|---------|
| 2026-04-30 | `67f1a13` | chore: ship pilot v0.1.0 — dashboard, OER CSV table layout, Netlify APIs |
| 2026-04-29 | `b17491a` | docs: README pointers to validation matrix markdown files |
| 2026-04-29 | `639f17d` | docs: generated validation matrix grouped by pilotState field |
| 2026-04-29 | `64cd9c7` | Merge branch `cursor/lens-canvas-dual-surface-b093` |
| 2026-04-29 | `f731cdc` | docs: mission validation tables by GCMD facet and wizard area |
| 2026-04-29 | `4f7460f` | docs: tie 2025 beta Saildrone exemplar to NCEI matrix + validation table |
| 2026-04-29 | `e071f60` | docs: generate mission validation rules table from code |
| 2026-04-29 | `f7ae5d3` | Lens: dual-surface workspace grid host, tuck-high tray order, scanner API |
| 2026-04-27 | `5e161b0` | offskjkk |
| 2026-04-27 | `e9b3391` | offskjkk |
| 2026-04-26 | `0379c13` | Lens: max-canvas HUD default, fix glass chrome stacking (#3) |
| 2026-04-25 | `e2adfbf` | ok |
| 2026-04-26 | `9e37d6d` | feat(lens): validator tab + Live XML-style wrap when lens opens |
| 2026-04-26 | `3959dc1` | fix(lens): portal host matches side rail card size (~360×664) |
| 2026-04-26 | `c98effd` | fix(wizard): match first-push layout — form left, validator tab first on right |
| 2026-04-26 | `06029e5` | style(lens): smart-form surface — minimal tint, theme bar/tray, soft frame |
| 2026-04-26 | `2cdc1f6` | fix(lens): portal frame, highlights, scanner host contract |
| 2026-04-25 | `74646fa` | llsdsss |
| 2026-04-24 | `2a37902` | chore: remove Google Apps Script entry and prep repo for GitHub |

---

## Regenerating this list

From the repository root:

```bash
git log --since="2026-04-01" --until="2026-05-01" --format='%h | %ad | %s' --date=short
```

---

## Related documents

| Document | Role |
|----------|------|
| `react-pilot/docs/SUMD_TECHNICAL_REPORT_APRIL_2026.md` | Technical report (HTTP pilot, Netlify, lens, quality gates). |
| `CHANGES_TODOS.md` (repo root) | Tag-up notes, Swarm board pointers, Andy demo framing. |
| `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md` | SWARM lane ownership and artifacts. |
| `react-pilot/docs/DEPLOYMENT.md` | Local and Netlify deployment. |
| Cursor canvas `canvases/usx-manta-audit.canvas.tsx` | Whole-audit digest + interactive todo list (IDE-managed path under `~/.cursor/projects/...`). |

---

*Last updated: 2026-05-06 — includes whole audit digest + April commit table (`67f1a13`).*
