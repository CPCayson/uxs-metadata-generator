# Manta / USx metadata — chat findings reference

Consolidated notes from a working session: architecture, APIs, controls by surface, and profile differences. For planning and onboarding; not a fixed product contract.

---

## 1. Three layers (what the generator is)


| Layer                                                   | Role                                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **react-pilot**                                         | Authoring UI: wizard, ISO-style XML preview/import, Lens Scanner, validation, optional Netlify `POST /api/db`, CoMET pull/preflight/push.           |
| **mcp/noaa-metadata** (Cursor MCP `user-noaa-metadata`) | Read-only **Google Drive** discovery/extraction for NOAA/OER/UxS-style files — **not** the in-browser app.                                          |
| **manta-chrome-extension**                              | Manta Pilot Bridge: capture page/selection/XML-ish text into Pilot (`#manta-capture`, `manta:extension-capture`, `postMessage`). No NOAA MCP calls. |


---

## 2. North star: what Manta means in-product

From `docs/MANTA_ROADMAP.md`:

- Make **where work is stuck** visible (validation, readiness, blockers).
- Reduce **blank-form** friction via **scanner-assisted prefill** and imports.
- Produce **trustworthy ISO 19115-2** (and profile XML) without everyone being an ISO expert.
- Sit **before** systems of record (e.g. **CoMET**): pull, improve, preflight, push **DRAFT**.

**Integration surface:** `manta:`* window events in `src/lib/mantaHostEvents.js` — open/close lens, goto step/field, set field, validation mode, auto-fix, CoMET load. Scanner portal: `#manta-scanner-host`.

**Manta Ray widget:** `src/shell/metadataKnowledgeBase.js` — field definitions plus ASK-tab Q&A (local KB). GCMD/ROR search in widget SEARCH tab.

**Gaps (examples from roadmap):** no org-wide pipeline dashboard; scanner MVP narrow; `netlify/functions/manta-intent.mjs` (Gemini) **not wired** from React UI; voice bar placeholder.

---

## 3. Netlify `POST /api/db` — `fn` names

From `netlify/functions/db.mjs`:

**Postgres-backed (needs `DATABASE_URL`):**

`getPlatforms`, `savePlatform`, `getSensors`, `saveSensor`, `saveSensorsBatch`, `getTemplates`, `getTemplate`, `saveTemplate`, `deleteTemplate`, `logValidation`

**Stateless (no DB):**

- `generateGeoJSON` — legacy form shape
- `generateDCAT` — DCAT JSON-LD string
- `validateOnServer` — `basic` | `strict`; legacy form to `pilotState` then `ValidationEngine` + mission rules
- `lensScan` — same heuristic as browser (`runLensScanHeuristic`)

---

## 4. XML preview vs import vs matrix

- **Export (mission):** `src/lib/xmlPreviewBuilder.js` — GMI/XML from `pilotState`.
- **Import:** `importPilotPartialStateFromXml` in `src/lib/xmlPilotImport.js`.
- **Coverage matrix:** `docs/uxs-ncei-template-mission-pilot-matrix.md` — Full / Partial / None per NCEI area.
- **Narrative:** `docs/uxs-ncei-gmi-xml-narrative-overview.md`.

---

## 5. GCMD, ROR, validation, scoring


| Concern                | Where it runs                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **GCMD**               | Browser `fetch` to CMR KMS — `src/lib/gcmdClient.js`. Optional `VITE_GCMD_KMS_BASE`. Not a custom `/api/gcmd` route.                   |
| **ROR**                | Browser `fetch` — `src/lib/rorClient.js` → `https://api.ror.org/v2/organizations`. Mission UI: `src/features/mission/StepMission.jsx`. |
| **EnrichmentService**  | `src/core/enrichment/EnrichmentService.js` — wraps GCMD + ROR.                                                                         |
| **Score**              | `src/core/validation/ValidationEngine.js` — `score = max(0, 100 - errCount*8 - warnCount*3)`.                                          |
| `**validateOnServer`** | Same engine on Netlify when the client calls that `fn`.                                                                                |


---

## 6. NOAA metadata MCP (Drive)

**Package:** `mcp/noaa-metadata/` — `npm start`, `npm run auth`, allowlist config.

**Tools:** `list_allowed_sources`, `search_drive_metadata_files`, `get_drive_file_metadata`, `extract_metadata_from_file`, `download_allowed_file_text`, `summarize_cruisepack_candidates`, `browser_test_plan_for_catalog_page` (static manual checklist, not live automation).

Descriptors: Cursor project `mcps/user-noaa-metadata/tools/`.

---

## 7. Chrome extension

**Permissions:** `storage`, `activeTab`, `scripting`, `tabs`, broad `host_permissions`.

**Flow:** capture to `chrome.storage.local` → open pilot `#manta-capture`; same-origin → `manta:extension-capture` + `postMessage`.

**Pilot:** `src/components/XmlToolsBar.jsx` — XML-like → import; else scanner when allowed.

---

## 8. Header XML strip (`XmlToolsBar`)


| Control                              | Action                                         |
| ------------------------------------ | ---------------------------------------------- |
| Import XML / zip                     | File picker; multi-XML zip → dropdown in panel |
| Paste import / Hide import           | Toggle panel                                   |
| Scanner suggestions                  | Modal; needs `scannerPrefill` + wiring         |
| Copy preview XML / Download preview  | Needs `profile.buildXmlPreview`                |
| GeoJSON / DCAT (server)              | Capability + `hostBridge`                      |
| Push to CoMET                        | `cometPush` + loaded UUID                      |
| Panel: Read clipboard, Apply to form | Merge via parsers                              |


---

## 9. Side rail (`WizardShell`)

Tabs: **Validator**, **Live XML preview**, **CoMET** (if profile exposes cometPull/Preflight/Push).

---

## 10. Live XML (`XmlPreviewPanel`)

- Expand/collapse control (full sidebar).
- Checkbox: highlight line delta vs last successful draft save.
- Focus in wizard scrolls/highlight matching XML line.

---

## 11. Readiness (`ReadinessStrip`)

**Lenient / Strict / Catalog** — set mode, show pass or error count. Named bundle chips are display-only when present.

---

## 12. Live validator (`ValidationPanel`)

- Mode pills; **Touched / All fields**.
- **Bridge check**; **Server rules validate** (if `serverValidate` cap).
- Issue filters All / Errors / Warnings; row click jumps to field.

---

## 13. CoMET panel (`CometPushPanel`)

**Pull ISO**, **Run preflight**, **Push draft**; link **Open in CoMET**.

---

## 14. Scanner modal (`ScannerSuggestionsDialog`)

**Close**, **JSON file**, **Run heuristic (browser)**, **Run server scan**, **Parse JSON**; row checkboxes; **Open** (KMS); **Merge into form**.

---

## 15. Step nav (`StepNav`)

One button per `profile.steps` with per-step validation status.

---

## 16. Mission — notable buttons

**StepMission:** ROR Search/Clear/select; template Refresh/Apply; **Load full draft** / **Save full draft** (needs bridge).

**StepPlatform:** Refresh, Apply selected, Save to library.

**StepSensors:** Refresh library, Save to library, + Add, Remove, Add sensor.

**StepKeywords:** Suggest from title/abstract; Clear/Add selected; per-facet Search; chip remove.

**StepDistribution:** Save current pilot as template.

**StepSpatial:** inputs only in current tree (no action buttons in `StepSpatial.jsx`).

---

## 17. Manta Ray widget (`AssistantShell`)

**Header:** LENS opens lens; close if provided.

**VALIDATE:** readiness; lenient/strict/catalog; section bars; issues + definition **?**; **Fix Issues**; refresh.

**ASK:** chips; input; **ASK** submit.

**SEARCH:** scheme (Science KW, Instruments, Platforms, Locations, Organizations); history; copy; **Suggest from record**.

**LIVE:** **Refresh** table.

**CoMET:** **Scan**; **Load into Wizard**.

**Footer:** click cycles tips.

---

## 18. Manta Lens

**Collapsed:** expand, close.

**Bar:** XML / Form / Both; Wrap / Dock; Collapse; Fix walk; **?**; refresh; EXIT.

**Fix walk:** Back / Next / Finish; quick chips.

**Glass:** clear search; prev/next XML hit.

**Readiness in lens:** syncs wizard mode. **Section bars:** click goes to step (`manta:goto-step`).

---

## 19. Profiles: Collection, BEDI Collection, BEDI Granule

### Collection (`collectionProfile.js`)

- **3 steps:** Identification, Extent, Distribution (`identification` / `extent` / `distribution`).
- **No** `buildXmlPreview` on profile → toolbar **Copy/Download preview disabled**. No import parsers, scanner, GeoJSON/DCAT, server validate, libraries, CoMET.
- **Live XML tab:** `isoXmlAdapter.generate` fallback from `WizardShell`.

### BEDI Collection (`bediCollectionProfile.js`)

- **3 steps:** Identification; Description and Extent; Contacts and Distribution.
- **XML:** `buildBediCollectionXmlPreview`; import: `bediCollectionImportParser`.
- **CoMET** on. No scanner, GeoJSON/DCAT, server validate, Postgres libraries.

### BEDI Granule (`bediGranuleProfile.js`)

- **3 steps:** Identification and Linkage ( `**parentCollectionId`** critical); Description and Extent; Links and Keywords.
- **XML:** `buildBediGranuleXmlPreview`; import: `bediGranuleImportParser`.
- Same capability pattern as BEDI collection.

**Manta:** VALIDATE/Lens follow each profile rules. SEARCH tab still GCMD/ROR for manual use.

---

## 20. File index


| Topic                    | Path                                                         |
| ------------------------ | ------------------------------------------------------------ |
| Roadmap                  | `react-pilot/docs/MANTA_ROADMAP.md`                          |
| Import matrix            | `react-pilot/docs/uxs-ncei-template-mission-pilot-matrix.md` |
| Host events              | `react-pilot/src/lib/mantaHostEvents.js`                     |
| XmlToolsBar              | `react-pilot/src/components/XmlToolsBar.jsx`                 |
| ValidationPanel          | `react-pilot/src/components/ValidationPanel.jsx`             |
| ReadinessStrip           | `react-pilot/src/components/ReadinessStrip.jsx`              |
| XmlPreviewPanel          | `react-pilot/src/components/XmlPreviewPanel.jsx`             |
| WizardShell              | `react-pilot/src/shell/WizardShell.jsx`                      |
| AssistantShell           | `react-pilot/src/shell/AssistantShell.jsx`                   |
| ScannerSuggestionsDialog | `react-pilot/src/components/ScannerSuggestionsDialog.jsx`    |
| CometPushPanel           | `react-pilot/src/features/comet/CometPushPanel.jsx`          |
| db.mjs                   | `react-pilot/netlify/functions/db.mjs`                       |
| missionProfile           | `react-pilot/src/profiles/mission/missionProfile.js`         |
| collectionProfile        | `react-pilot/src/profiles/collection/collectionProfile.js`   |
| bediCollectionProfile    | `react-pilot/src/profiles/bedi/bediCollectionProfile.js`     |
| bediGranuleProfile       | `react-pilot/src/profiles/bedi/bediGranuleProfile.js`        |
| NOAA MCP                 | `mcp/noaa-metadata/`                                         |
| Extension                | `manta-chrome-extension/`                                    |


---

## 21. Deep audit: this doc vs the codebase

This section scores **Sections 1–20** against `react-pilot` (and adjacent packages) as of the audit pass. Use it to fix drift in the narrative doc and to prioritize engineering.

### 21.1 Executive summary


| Verdict                                 | Topics                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accurate**                            | Four registered profiles (`App.jsx`); mission/BEDI XML builders and parsers; `db.mjs` `fn` router; GCMD/ROR client-side; `ValidationEngine` with profile `validationRuleSets`; Manta UI surfaces (XmlToolsBar, WizardShell tabs, AssistantShell tabs, Lens); MCP tool list; extension capture flow; `manta-intent.mjs` exists but unused by React. |
| **Incomplete / easy to misread**        | `validateOnServer` is **always** mission legacy form + mission rules on the server — not profile-parameterized (see §21.4). `HttpHostAdapter.isAvailable()` returns `**true` unconditionally** — “host connected” in UI is **optimistic** until a real call fails; only **Bridge check** proves Postgres.                                          |
| **Doc debt**                            | Collection `capabilities.xmlPreview: false` is **misleading**: the **side panel still shows XML** via `isoXmlAdapter` in `WizardShell`; only the **toolbar copy/download** gates on `buildXmlPreview`.                                                                                                                                             |
| **Product gaps (by design or backlog)** | Voice / `manta-intent`; CruisePack (`cruisepack` provenance reserved in `types.js`); scanner breadth; `useProfileHostActions` / `useCometActionsForProfile` are **aliases**, not generalized implementations.                                                                                                                                      |


---

### 21.2 What is implemented (done)

- **Profile registry:** `mission`, `collection`, `bediCollection`, `bediGranule` registered at app load (`App.jsx` + `ProfileRegistry`).
- **Metadata engine context:** `EmbeddableShell` builds per-profile `WorkflowEngine(profile.steps)`, shared `ValidationEngine`, `EnrichmentService`, `ExportEngine([isoXmlAdapter])`, `hostBridge` (`context.js`, `EmbeddableShell.jsx`).
- **Mission path:** Full wizard, `xmlPreviewBuilder` / `xmlPilotImport`, scanner envelope + heuristic + optional `lensScan` via HTTP, GeoJSON/DCAT/server validate **when** `capabilities` allow, templates/platforms/sensors/draft via `useMissionActions`, CoMET via `useMissionCometActions` (with profile branching inside).
- **BEDI paths:** Dedicated steps, XML preview/import parsers, CoMET caps on; no scanner / no GeoJSON/DCAT / no server validate flags.
- **Collection path:** Three steps, `collectionValidationRuleSets`, `mergeLoaded` shallow merge; **no** import parsers, **no** `buildXmlPreview` on profile.
- **Manta Ray + Lens:** `AssistantShell.jsx` — VALIDATE / ASK / SEARCH / LIVE / CoMET; lens HUD, fix walk, readiness sync events (`manta:`*).
- **Netlify:** `db.mjs`, `comet-proxy.mjs`, `manta-intent.mjs` present; intent **not** referenced from `src/`.
- **Extension + MCP:** As described in §6–7; no code coupling between them and Pilot beyond capture events.

---

### 21.3 Partially done or “done but misleading”


| Item                             | Reality                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile-neutral host actions** | `useProfileHostActions` **re-exports** `useMissionActions` (`useProfileHostActions.js`). Behavior is **mission-oriented** (e.g. draft payload shape `{ pilot, updatedAt }`, template name constant) but **mergeLoaded/sanitize** are profile-specific — works for BEDI/collection **if** stored JSON matches expectations. |
| **Profile-neutral CoMET hook**   | `useCometActionsForProfile` **re-exports** `useMissionCometActions` — name suggests abstraction; implementation is one hook with capability checks.                                                                                                                                                                        |
| **Server validation**            | UI only enables button when `capabilities.serverValidate` (mission). Server path still **hard-wires mission** rules in `db.mjs` — correct for mission only.                                                                                                                                                                |
| **Host “ready”**                 | `HttpHostAdapter.isAvailable()` → **always true**; failures surface on first `fetch` to `/api/db`. Copy in `ValidationPanel` about “reachable `/api/db`” is behaviorally right; the label “Postgres API” can be true before Neon is actually wired.                                                                        |
| **MantaVoiceBar**                | `App.jsx` passes `profileId`; component **ignores props** and only shows “Voice commands coming soon.” — dead prop / unfinished API.                                                                                                                                                                                       |
| **Readiness bundles**            | Strip shows named bundles when `computeReadinessBundles` supplies them; BEDI profiles declare `readinessBundles` in profile JS — wiring depth varies by `readinessSummary.js` + CoMET preflight snapshot.                                                                                                                  |


---

### 21.4 Not done / incorrect assumptions


| Gap                                        | Detail                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**validateOnServer` not profile-generic** | `db.mjs` uses `legacyFormDataToPilotState` + `missionValidationRuleSets` only. Calling it for a **collection/BEDI-shaped** legacy form would be **wrong** if exposed; today gated off for non-mission.                                                      |
| `**manta-intent` ↔ UI**                    | No `fetch('/api/manta-intent')` (or relative equivalent) in `src/`.                                                                                                                                                                                         |
| **CruisePack**                             | `SourceProvenanceType` includes `'cruisepack'` but comments mark it **not implemented** (`types.js`, `sourceProvenance.js`).                                                                                                                                |
| **Collection XML import/export**           | `collectionProfile`: `importParsers: []`, no `buildXmlPreview` — **POC** as documented in profile comment.                                                                                                                                                  |
| **Generalized export pipeline**            | `ExportEngine` seeded only with `isoXmlAdapter` in `EmbeddableShell`; profile `exportAdapters: []` everywhere in audited profiles — **no second adapter** wired through engine for mission-specific formats beyond `buildXmlPreview` on the profile itself. |


---

### 21.5 Abstraction map (what to rely on when extending)

```
App
 └─ EmbeddableShell (MetadataEngineCtx)
      ├─ profile          ← ProfileRegistry.getProfile(profileId)
      ├─ workflowEngine   ← new WorkflowEngine(profile.steps) — step order + field→step
      ├─ validationEngine ← new ValidationEngine() — stateless runner
      ├─ enrichmentService← new EnrichmentService() — GCMD + ROR
      ├─ exportEngine     ← ExportEngine([isoXmlAdapter]) — side path; mission XML is profile.buildXmlPreview
      └─ hostBridge       ← HttpHostAdapter | StandaloneHostAdapter

WizardShell
 └─ useProfileHostActions (= useMissionActions) — DB draft/templates/platforms/sensors/exports
 └─ useCometActionsForProfile (= useMissionCometActions)

Scanner path
 └─ ScannerSuggestionsDialog + scannerEngine + lensScanHeuristic
 └─ hostBridge.lensScan → POST /api/db lensScan (same heuristic as browser)
```

**Intentional seams:** Transport only via `HostBridge`; validation only via `ValidationEngine.run({ profile, state, mode })` for local rules; cross-shell sync via `manta:`* DOM events and `sessionStorage` pilot payload (`pilotSessionStorage.js`).

---

### 21.6 Recommended work (priority sketch)

1. **Server parity:** Parameterize `validateOnServer` (and optionally GeoJSON/DCAT mappers) by **profile id** or pass **rule set id** + canonical state shape — avoid mission-only legacy mapper for future caps.
2. **Host availability:** Consider `isAvailable()` that pings a lightweight `db` health `fn` or reuses bridge-check result instead of always `true` for HTTP adapter.
3. **Rename or implement aliases:** Either implement real `useProfileHostActions` / `useCometActionsForProfile` or rename exports to `useMissionHostActions` / `useMissionCometActions` in shell imports to reduce false sense of generalization.
4. **Voice:** Wire `MantaVoiceBar` to `manta-intent` (feature-flag + consent) or remove `profileId` prop until used.
5. **Collection:** Add `buildXmlPreview` + optional import parser when POC graduates; align `capabilities.xmlPreview` with actual UX.
6. **Docs (this file):** Keep §3 footnote: `lensScan`, `validateOnServer`, GeoJSON, and DCAT on the server are **mission-legacy** until refactored.

---

### 21.7 Traceability matrix (doc section → primary source)


| Doc § | Primary verification                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1–2  | `MANTA_ROADMAP.md`, `mantaHostEvents.js`                                                                                                           |
| §3    | `netlify/functions/db.mjs` `ROUTES` / `NO_DATABASE_FNS`                                                                                            |
| §4    | `xmlPreviewBuilder.js`, `xmlPilotImport.js`, matrix `.md`                                                                                          |
| §5    | `gcmdClient.js`, `rorClient.js`, `ValidationEngine.js`                                                                                             |
| §6    | `mcp/noaa-metadata/src/server.js` + MCP descriptors                                                                                                |
| §7    | `manta-chrome-extension/manifest.json`, `content.js`, `XmlToolsBar.jsx`                                                                            |
| §8–18 | JSX listed in §20 file index                                                                                                                       |
| §19   | `collectionProfile.js`, `bediCollectionProfile.js`, `bediGranuleProfile.js` `capabilities` + `steps`                                               |
| §21   | This audit: `EmbeddableShell.jsx`, `db.mjs`, `useProfileHostActions.js`, `useCometActionsForProfile.js`, `HttpHostAdapter.js`, `MantaVoiceBar.jsx` |


---

## 22. Work spans (delivery slices)

Time-boxed slices that continue from §21.6 — **each span** is a coherent cut of work with a clear “done” definition. Order is suggested, not mandatory.

### Span A — Doc + UX truth (short)


| Outcome              | Actions                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| No misleading labels | Document in UI copy that **Bridge check** is the real Postgres probe when using `HttpHostAdapter`.                    |
| Collection clarity   | Tooltip or pilot-notes line: **Live XML** uses `isoXmlAdapter`; **toolbar** copy/download requires `buildXmlPreview`. |


**Done when:** `MANTA_USX_METADATA_CHAT_FINDINGS.md` §21.1–21.4 matches shipped UI strings or tickets filed to change them.

### Span B — Server validation parity (medium)


| Outcome            | Actions                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe multi-profile | `db.mjs` `validateOnServer` accepts **profile id** + **canonical state** (or server-side mapper per profile), runs matching `validationRuleSets`. |
| Legacy path        | Keep current mission legacy form path behind `profileId === 'mission'` for backward compatibility.                                                |


**Done when:** Mission behavior unchanged in tests; a second profile (e.g. `collection`) can opt into `serverValidate` without importing mission rules.

### Span C — Host readiness (short)


| Outcome              | Actions                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Honest `isAvailable` | Optional: `pingDb` or reuse last bridge-check timestamp; expose `hostBridgeLastOk` in context for disabling buttons. |


**Done when:** Fresh static deploy does not imply “Postgres connected” before first successful `fetch`.

### Span D — Hook honesty (short)


| Outcome         | Actions                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rename or split | Either **rename** re-exports to `useMissionHostActions` / `useMissionCometActions` **or** extract shared `useHostActions({ profile, … })` with strategy objects per profile family. |


**Done when:** Grep for `useProfileHostActions` shows either real generalization or mission-only naming.

### Span E — Voice intent (medium / optional)


| Outcome              | Actions                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Wire `MantaVoiceBar` | `POST /api/manta-intent` behind feature flag; map `MantaCommand[]` to existing `manta:`* events; use or remove `profileId` prop. |


**Done when:** Opt-in path works on Netlify with `GEMINI_API_KEY`; off by default in local Vite.

### Span F — Collection graduation (long)


| Outcome        | Actions                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| XML round-trip | Add `buildXmlPreview` + `importParsers` for collection state shape; align `capabilities`. |
| Matrix         | Optional small `collection-*-matrix.md` mirroring mission matrix depth.                   |


**Done when:** Collection profile can import its own exported XML without loss for declared fields.

### Span G — Scanner / CruisePack (long / research)


| Outcome    | Actions                                                                                |
| ---------- | -------------------------------------------------------------------------------------- |
| Scanner    | Broaden envelope `fieldPaths` + evidence (per `MANTA_ROADMAP.md` Phase 1).             |
| CruisePack | Implement `cruisepack` provenance + ingest adapter; document in `sourceProvenance.js`. |


**Done when:** One end-to-end demo path from pack → merge → validation (even if file-type support is narrow).

---

### Span dependency sketch

```text
A (docs) ── independent
B (server validate) ── blocks enabling serverValidate for non-mission
C (host ready) ── independent; pairs well with A
D (hooks) ── independent; reduces confusion before B grows
E (voice) ── optional; depends on Netlify + keys
F (collection) ── can parallel B if staff split
G (scanner/pack) ── largest; last unless product priority says otherwise
```

---

## 23. Testing and verification (manual matrix)

Use this as a **smoke checklist** when touching host, CoMET, or profiles. Automate pieces over time (`verify-pilot.mjs`, profile fixture tests, etc.).


| Check                                    | Mission | BEDI collection                               | BEDI granule | Collection               |
| ---------------------------------------- | ------- | --------------------------------------------- | ------------ | ------------------------ |
| Switch profile, no console throw         | ✓       | ✓                                             | ✓            | ✓                        |
| Validator: three modes + issue jump      | ✓       | ✓                                             | ✓            | ✓                        |
| Live XML tab renders                     | ✓       | ✓                                             | ✓            | ✓ (iso fallback)         |
| Toolbar copy/download XML                | ✓       | ✓                                             | ✓            | ✗ (no `buildXmlPreview`) |
| Paste / file XML import                  | ✓       | ✓                                             | ✓            | ✗                        |
| Scanner modal merge                      | ✓       | ✗ caps                                        | ✗            | ✗                        |
| Bridge check (with `netlify dev` + Neon) | ✓       | ✓ (lists may be empty)                        | same         | same                     |
| Save / load full draft                   | ✓       | ✓ (same template row; merge shape must match) | same         | same                     |
| CoMET pull / preflight / push            | ✓ caps  | ✓                                             | ✓            | ✗                        |
| Server rules validate                    | ✓       | ✗                                             | ✗            | ✗                        |
| GeoJSON / DCAT buttons                   | ✓ caps  | ✗                                             | ✗            | ✗                        |
| Manta Ray: SEARCH hits KMS/ROR           | ✓       | ✓                                             | ✓            | ✓                        |
| Extension capture → import or scanner    | ✓       | ✓ if XML                                      | scanner off  | ✗ scanner                |


**BEDI-specific:** assert validation errors when `parentCollectionId` empty on granule profile. **Session guard:** switching profile remounts `EmbeddableShell` (`key={profileId}` in `App.jsx`) — session JSON must match `sessionLooksLikeBedi*` guards or you get demo seed merged.

---

## 24. Environment and deploy


| Variable / setup                     | Purpose                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | Neon / Postgres for `db.mjs` CRUD; omit for stateless-only (`lensScan`, GeoJSON, DCAT, `validateOnServer`).         |
| `COMET_BASE_URL`, `COMET_SESSION_ID` | `comet-proxy.mjs` — see `react-pilot/.env.example`.                                                                 |
| `GEMINI_API_KEY`, `GEMINI_MODEL`     | `manta-intent.mjs` only; not used by Vite bundle today.                                                             |
| `VITE_GCMD_KMS_BASE`                 | Override GCMD KMS base URL in browser.                                                                              |
| `VITE_APP_VERSION`                   | Injected at build (`vite.config.js`).                                                                               |
| Same-origin `/api/db`                | Required for HttpHostAdapter; use `**netlify dev`** locally so functions + Vite share origin, or deploy to Netlify. |


**Static export caveat:** Plain static hosting has **no** `/api/db` unless a reverse proxy adds it (`scripts/publish-dist.mjs` notes this pattern).

---

## 25. Risk register (operational footguns)


| Risk                        | Mitigation                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Silent wrong validation** | Turning on `serverValidate` for a non-mission profile before Span B ships would still run **mission** rules on server — do not enable without code change. |
| **Draft clobber**           | Single reserved template name for full draft (`useMissionActions` constant) — all profiles write same slot; document for operators.                        |
| **CoMET session expiry**    | Proxy + cookie behavior documented in `cometClient.js` / panel copy — re-login when JSESSIONID ages out.                                                   |
| **GCMD/ROR fetch failures** | Browser CORS/network — user sees search errors in widget; no retry queue.                                                                                  |
| **Import merge surprises**  | `mergeLoaded` differs per profile; BEDI XML missing `parentIdentifier` still parses with warnings (`bediGranuleImportParser`).                             |
| **Markdown doc truncation** | Rare empty-file glitch on save — verify `wc -l` after large edits.                                                                                         |


---

## 26. Glossary (quick)


| Term             | Meaning here                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **HostBridge**   | Adapter for `/api/db` (HTTP) or standalone no-op; templates, platforms, sensors, server validate, exports, `lensScan`. |
| **pilotState**   | Canonical JSON state object for the active profile (shape varies: mission nested vs BEDI/collection flat-ish).         |
| **Profile**      | Registered `EntityProfile`: steps, capabilities, `buildXmlPreview`, parsers, `validationRuleSets`, `mergeLoaded`.      |
| **Lens Scanner** | Envelope-first suggestions UI + heuristic (+ optional server `lensScan`).                                              |
| **Manta Ray**    | Floating `AssistantShell` widget (tabs).                                                                               |
| **Manta Lens**   | Full-screen/side scanner overlay with glass, fix walk, XML search.                                                     |
| **Readiness**    | Lenient / strict / catalog validation tiers + optional named bundles from `readinessSummary.js`.                       |
| **Bridge check** | Explicit `listPlatforms` + `listTemplates` — proves DB function reachable.                                             |
| **Work span**    | §22 delivery slice with explicit “done when.”                                                                          |


---

## 27. Related docs (read next)

- `docs/MANTA_ROADMAP.md` — phased product intent.
- `docs/uxs-ncei-template-mission-pilot-matrix.md` — mission XML import coverage.
- `docs/DEPLOYMENT.md` — hosting / `/api/db` (if present in tree).
- `docs/SUMD_TECHNICAL_REPORT_APRIL_2026.md` — QA / production narrative (if maintained).

---

*Synthesized from chat. §21 audit, §22 work spans, §23–27 testing/env/risks/glossary/related docs. Re-save if the file shows 0 bytes — tooling glitch can truncate writes.*