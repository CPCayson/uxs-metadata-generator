# Manta “one app” mission XML workbench — README for humans & LLMs

**Canonical single doc** for this workbench: product story, XML lineage, commands, **and** validation / swarm / architecture (everything that lived in `SWARM_VALIDATION_ARCHITECTURE_SNAPSHOT.txt` is merged into **§15+** below).

This file gives **enough context** to explain or plan work on the **React pilot** as **one surface** for **NOAA UxS / NCEI-shaped mission metadata**: ingest XML, edit in a structured wizard, validate, preview ISO export, and hand off to downstream systems.

Paste **this whole file** (or §1–14 + your goal, or §15+ only) into another model so the assistant stays on-rails.

---

## 1. What this repository area is

| Path | Role |
|------|------|
| **`react-pilot/`** | **Canonical runtime** for the metadata wizard: `pilotState`, validation, XML preview/export, import, Lens, optional Netlify `/api/db`. |
| **Repo root** (`Index.html`, Apps Script, legacy generators) | **Reference only** for historical XML/field parity — **not** loaded by the React app. |
| **`MANTA End User Testing/samples/*.xml`** | **Stress corpus** for import + validation + preview audits. |
| **`MANTA End User Testing/reference/ncei-collection-metadata/ncei_template-clean.xml`** | **Structural reference** (NCEI collection skeleton / clean GMI). Mission records are **dataset-level** — align at **block** level (contacts, identifiers, distribution patterns), not byte-for-byte to every collection placeholder. |
| **`AGENTS.md` (repo root)** | **Agent / automation orientation**: commands, anti-patterns, ISO −3 → −2 lineage, audit scripts. |

---

## 2. Product story (“one in all” app)

**Target user:** someone who has (or will have) **mission XML** in ISO **19115-2 (GMI/GMD)** or **19115-3 (mdb)** shape and needs to **populate**, **correct**, and **publish** metadata that fits **NOAA / NCEI UxS** workflows.

**End-to-end journey:**

1. **Ingest** — user opens or pastes XML; `importPilotPartialStateFromXml` returns a **partial** object + warnings.
2. **Merge** — `mergeLoadedPilotState(defaultPilotState(), partial)` fills defaults; XML-derived fields win per merge rules.
3. **Edit** — six-step wizard (Mission → Platform → Sensors → Spatial → Keywords → Distribution) plus optional **Lens** / scanner affordances.
4. **Validate** — `validatePilotState(mode, state)` with **lenient / strict / catalog** modes; rules live in mission profile code, not ad hoc spreadsheets.
5. **Preview / export** — `buildXmlPreview` emits **ISO 19115-2** `gmi:MI_Metadata` XML string for copy/download; **WF** pill checks **well-formedness** in the browser only.
6. **External truth** — full **XSD** validation (`xmllint`, CoMET, catalog-backed toolchains) when you need schema truth beyond the app’s lenient gates.

**Non-goals unless explicitly scoped:** mixing unrelated metadata profiles (e.g. BEDI collection workflow) into the **mission** wizard/parser paths.

---

## 3. Canonical data: `pilotState`

- **Single JSON-shaped state** drives the UI: `mission`, `spatial`, `platform`, `sensors[]`, `keywords` (GCMD facets as chip arrays), `distribution`, `sourceProvenance`, etc.
- **`sanitizePilotState`** normalizes dates, bbox, topic categories, license preset side effects, etc., on merge/load.
- **Validation** aggregates mission rules + GCMD chip UUID warnings + abstract quality heuristics — see `src/lib/pilotValidation.js` and `src/profiles/mission/missionValidationRules.js`.

---

## 4. XML lineage (19115-3 vs 19115-2) — do not hand-wave this

| Direction | Behavior |
|-----------|----------|
| **Import** | `importPilotPartialStateFromXml` accepts **ISO 19115-3** (`mdb` / `-3` URLs) **or** **19115-2** (`gmi:MI_Metadata`, classic `gmd`). |
| **Export / preview** | **`buildXmlPreview`** always emits **19115-2-shaped GMI/GMD** via `pilotState`. There is **no** “preserve −3 verbatim on export” path in the pilot. |
| **Provenance** | `sourceProvenance.importIsoXmlFamily` / export hints record whether the upload was −3 or −2 for UI messaging (`XmlPreviewPanel.jsx`). |

**Implication for “one app”:** the pilot is the **normalization hub** (3 → 2, or 2 → 2), not a passive XML editor.

---

## 5. Wizard steps (mission profile)

Default UxS flow: **Mission → Platform → Sensors → Spatial → Keywords → Distribution**.

**Lens / Manta chrome:** optional HUD and issue overlays; see `WizardShell.jsx`, `AssistantShell.jsx`, and `AGENTS.md` “Lens + validation” notes — do not confuse **Lens scope** (STEP vs ALL) with validation mode.

---

## 6. XML preview panel: what “validate in app” is *today*

| Check | What runs | Limit |
|-------|-------------|------|
| **WF pill** | Browser **`DOMParser`** parse of the preview string | **Well-formed XML only** — not XSD, not Schematron. |
| **Structural hints** | `analyzeMissionPreviewXml` / `xmlPreviewStructuralHints.js` | Lightweight string heuristics (e.g. missing `schemaLocation` patterns). |
| **Pilot validation** | `validatePilotState` in the Validation panel | **Business / profile rules**, not full ISO XSD coverage. |
| **Full NOAA XSD** | **`xmllint --schema …`** (or enterprise validators) | Needs **`xmllint`** + often a **local schema mirror** or **XML catalog** because HTTPS fetch chains can fail mid-import graph. |

**UI copy (conceptual):** WF = “parseable XML”; full schema = **desktop / CI / CoMET**.

---

## 7. NOAA `schema.xsd` and why the browser shows a tiny tree

NOAA publishes a top-level **`https://data.noaa.gov/resources/iso19139/schema.xsd`** that **includes/imports** other XSD files with **relative** `schemaLocation` paths.

- Opening that URL in Chrome/Firefox shows **“no style information”** — normal; it is **data**, not an HTML page.
- The visible root is often **small**; the **real** model is the **closure** of all includes (e.g. `gmi` fragments that themselves `<xs:include ../gmi/...>`).

**`xmllint` over HTTPS** to that entry URL is **often unreliable** in CI or locked networks (TLS, redirects, partial fetch). Prefer:

- **`npm run validate:preview-sample`** (see `scripts/validate-preview-sample.mjs`) — mirrors the NOAA bundle to `NOAA_ISO19139_SCHEMA_DIR` (default under `/tmp/…`) on first successful run, then validates a merged **NCRMP** preview; or
- **`XML_CATALOG_FILES`** / local checkout of the schema bundle — see comments in `scripts/validate-xml.mjs`.

**Pilot export header:** root `gmi:MI_Metadata` uses **`xsi:schemaLocation`** pointing at the **NOAA** `…/iso19139/schema.xsd` (not the legacy OGC-only stub URL) so downstream NOAA tooling sees the expected hint.

---

## 8. Commands you actually run (developers & agents)

```bash
cd react-pilot && npm install && npm run verify:pilot
cd react-pilot && npm run dev
cd react-pilot && npm run dev:netlify
cd react-pilot && npm run audit:manta-samples
cd react-pilot && npm run verify:manta-pipeline
cd react-pilot && npm run verify:manta-eut-perfect
cd react-pilot && npm run validate:xml -- path/to.xml --schema https://data.noaa.gov/resources/iso19139/schema.xsd
cd react-pilot && npm run validate:preview-sample
cd react-pilot && npm run repomix
cd react-pilot && npm run repomix:critical
```

- **`repomix`** — packs **`react-pilot/`** (respecting `repomix.config.json` + `.gitignore`) into **`repomix-output.xml`** at the package root for LLM paste; output is **gitignored** — regenerate before sharing.
- **`repomix:critical`** — **~109k tokens**, 15 files: import, preview builder, `validatePilotState` + mission rules, datetime helpers, license/NCEI/sensor/UXS/GCMD deps, preview sanity/hints, XML + validation panels → **`repomix-critical-output.xml`** (see `repomix.critical.config.json`). Use for **surgical** ISO / NCEI audits without CSS or fixtures.
- **`audit:manta-samples`** — batch EUT samples → import → validate → preview → reports under `MANTA End User Testing/reports/`.
- **`verify:manta-pipeline`** — same audit path as CI pipeline check without “perfect” lenient-error requirement.
- **`verify:manta-eut-perfect`** — fails if any sample has lenient **errors** > 0 (UxS EUT “perfect” target).
- **`validate:xml`** — `xmllint`; optional `--schema`; catalog env vars for offline includes.
- **`validate:preview-sample`** — optional **local mirror + xmllint** path tuned for NOAA ISO19139 bundle (see script header).

---

## 9. Key source files (implementation map)

| Topic | File(s) |
|-------|---------|
| XML → partial state | `src/lib/xmlPilotImport.js` (`importPilotPartialStateFromXml`, `applyIsoImportHeuristics`, keyword hydration, acquisition parsers) |
| State → ISO-2 preview | `src/lib/xmlPreviewBuilder.js` (`buildXmlPreview`, GMI/GMD element order, distribution, citations, acquisition blocks) |
| Date / instant normalization for XSD | `src/lib/datetimeLocal.js` (`formatMissionInstantAsXsDateTime`, etc.) + preview date helpers in `xmlPreviewBuilder.js` |
| Merge / sanitize / default state | `src/lib/pilotValidation.js` |
| Validation rules / labels | `src/profiles/mission/missionValidationRules.js`, `missionFieldLabels.js` |
| Mission UI | `src/features/mission/StepMission.jsx`, other `src/features/*` |
| XML preview UI | `src/components/XmlPreviewPanel.jsx` |
| ISO preview sanity checks (CI) | `src/lib/iso191152PreviewSanity.js` |
| Netlify DB / same-origin API | `netlify/functions/db.mjs`, `docs/DEPLOYMENT.md` |
| EUT lenient swarm context | `docs/EUT_LENIENT_SWARM.md` |

---

## 10. “WebAssembly (Wasm)” in one paragraph

**WebAssembly** lets browsers run **compiled** code (often Rust/C++) at near-native speed. A **hypothetical** future path is “bundle `libxml2`/Xerces as Wasm + ship XSDs” to get **in-browser full schema validation** without a server. That is **not** what ships today; today’s in-browser check is **WF only**.

---

## 11. CoMET, GCMD, and external services

- **GCMD KMS** — keyword chips, href resolution, search UI paths; see GCMD client code under `src/lib/` and docs in `AGENTS.md`.
- **CoMET** — optional validate/transform when credentials and proxy exist (`comet-proxy`, env vars). Treat as **service-side** truth when available.
- **`/api/db`** — persistence / host bridge; **not** implied by `npm run dev` alone — use `dev:netlify` or deploy-shaped proxy per `AGENTS.md`.

---

## 12. Suggested blurb for stakeholders (one paragraph)

**Manta’s React pilot is the NOAA UxS mission metadata cockpit: import ISO 19115-3 or 19115-2 mission XML into structured pilot state, walk a validation-aware wizard with optional Lens and GCMD/CoMET assists, and export normalized ISO 19115-2 (GMI) preview XML aligned with NCEI template practice. In-browser checks prove the XML is well-formed; full NOAA XSD validation is a separate tooling path (xmllint + local schema mirror or XML catalog) because schema graphs are large and HTTPS fetches are fragile.**

---

## 13. One-document rule

Do **not** treat **`docs/SWARM_VALIDATION_ARCHITECTURE_SNAPSHOT.txt`** as a second source of truth — it is a **short redirect** to this file so old links keep working. When validation layers, swarm lanes, or the file index change, edit **§15 onward** in **this** document.

---

## 14. When you change behavior, update…

- **`AGENTS.md`** — if automation commands, report paths, or Lens ports change materially.
- **This file** — “one app” story, import/export lineage, **and** §15+ validation / swarm / architecture.
- **`AI_CHANGE_CONTROL.md`** — if your org requires it for broad edits (see repo root).

---

# Part II — Validation layers, swarms, and architecture

*Reading this markdown runs nothing. For deeper field matrices, generate `docs/generated/mission-validation-by-field.generated.md` via `npm run docs:mission-validation-rules`.*

---

## 15. Two different “swarms” in this repo (do not conflate)

**A) Rule-pipeline swarm** — `schemas/`, `compiled_rules/`, `scripts/swarm/`

- SWARM-A … SWARM-F in `docs/SWARM_IMPLEMENTATION_BOARD.md`
- CSV → compile → condition engine → workbench integration
- **Not** the same code path as `validatePilotState()` for every interactive check

**B) EUT lenient swarm** — import heuristics against `MANTA End User Testing/samples/`

- `docs/EUT_LENIENT_SWARM.md` (lanes EUT-A … D: keywords, mission, platform, sensors + distribution)
- `npm run audit:manta-samples` writes `MANTA End User Testing/reports/*`
- Goal: reduce lenient **warnings** via `xmlPilotImport.js` **without** weakening catalog gates

Part II focuses on **(B)-adjacent runtime validation** and where each layer lives, plus **(A)** npm entrypoints.

---

## 16. Parallel swarm lanes — who owns what (coordination map)

Use this to assign people/agents without duplicating work across systems.

| Lane tag | Primary output / gate | Key paths / commands |
|----------|-------------------------|----------------------|
| **R-RULES** | CSV → compile → condition engine | `schemas/`, `compiled_rules/`, `scripts/swarm/*`, `npm run swarm:all`, `SWARM_IMPLEMENTATION_BOARD.md` |
| **E-EUT** | Lenient rollup on samples | `EUT_LENIENT_SWARM.md`, `npm run audit:manta-samples` → `MANTA End User Testing/reports/*` |
| **V-RUN** | **Interactive product validation** | `validatePilotState`, `missionValidationRules.js` |
| **P-SANITY** | Fast preview regression | `iso191152PreviewSanity.js`, `verify-pilot.mjs` |
| **W-WF** | In-browser parse only | `XmlPreviewPanel.jsx` (DOMParser) |
| **X-XSD** | Full NOAA graph (external) | `validate-xml.mjs`, `validate-preview-sample.mjs`, `NOAA_ISO19139_SCHEMA_DIR`, `XML_CATALOG_FILES` |
| **B-BEDI** | BEDI / NCEI fixture parsers | `validate:bedi`, `test:bedi` (inside `verify:pilot`) |

**Typical stacks**

- **“Mission XML is good”:** V-RUN + P-SANITY + optional X-XSD (`xmllint`).
- **“Import heuristics / EUT cleanup”:** E-EUT + V-RUN; do **not** weaken V-RUN just to satisfy rollup cosmetics.

---

## 17. Architecture — data flow (one line per stage)

```text
XML file  -->  importPilotPartialStateFromXml (xmlPilotImport.js)
          -->  partial object + parser warnings
          -->  mergeLoadedPilotState(defaultPilotState(), partial) (pilotValidation.js)
          -->  sanitizePilotState (pilotValidation.js)
          -->  pilotState in React wizard (features/*, shell/*)
          -->  validatePilotState(mode, state) (pilotValidation.js + missionValidationRules.js)
          -->  buildXmlPreview(state) (xmlPreviewBuilder.js)  [always ISO 19115-2 GMI/GMD]
          -->  optional: DOMParser WF (XmlPreviewPanel.jsx)
          -->  optional: xmllint --schema NOAA bundle (validate-xml.mjs, validate-preview-sample.mjs)
```

---

## 18. Swarm lane — runtime profile validation (V-RUN; primary product truth)

- **Entry:** `validatePilotState(mode, state)` in `src/lib/pilotValidation.js`
- **Modes:** `lenient` | `strict` | `catalog` — lenient is default UX; `strict` / `catalog` tighten or add NCEI-oriented rows in `src/profiles/mission/missionValidationRules.js`
- **Helpers in `pilotValidation.js`:** e.g. `collectGcmdKeywordUuidWarnings`, `abstractQualityIssues`, sensor vs GCMD alignment (see `mission-validation-by-area.md`)
- **Issue shape (conceptual):** `{ severity: 'e'|'w', field: '…', message: '…', xpath?: '…' }` — XPath often normalized to `/gmi:MI_Metadata/…`
- **UI:** `ValidationPanel.jsx`; Lens/scanner is separate — see `AGENTS.md` (Lens + validation)

---

## 19. Swarm lane — XML preview sanity (P-SANITY; not full XSD)

- **File:** `src/lib/iso191152PreviewSanity.js`
- **Called from:** `scripts/verify-pilot.mjs` and the EUT audit pipeline
- **Checks:** `gmi:MI_Metadata` root, `xmlns:gmi` + NOAA `schemaLocation` pair, bbox `gco:Decimal` patterns, non-empty `dateStamp` / progress code, etc.
- **Not** a substitute for Xerces / `xmllint` against the full NOAA include graph.

---

## 20. Swarm lane — in-app “WF” (W-WF; well-formed only)

- **File:** `src/components/XmlPreviewPanel.jsx`
- **Check:** `DOMParser.parseFromString(previewXml)`
- **Meaning:** parseable XML tree only; full ISO 19139 / GMI XSD is explicitly out of band in the UI.

---

## 21. Swarm lane — structural hints (lightweight heuristics)

- **File:** `src/lib/xmlPreviewStructuralHints.js` — `analyzeMissionPreviewXml(xml)` → messages + `hasSchemaLocation`
- **Purpose:** soft hints for authors; **not** a validator.

---

## 22. Swarm lane — external XSD / toolchain truth (X-XSD)

- **NOAA entry schema:** `https://data.noaa.gov/resources/iso19139/schema.xsd`
- **Reality:** large relative include/import closure; HTTPS `xmllint` is often flaky.
- **Scripts:** `npm run validate:xml -- <file.xml> [--schema <url|path>]` · `npm run validate:preview-sample`
- **Offline:** `XML_CATALOG_FILES` and local mirrors — see comments in `scripts/validate-xml.mjs`
- **CoMET:** service-side validate when env + proxy exist — not `pilotState` core.

### 22.1 `validate:preview-sample` (NCRMP → preview → NOAA tree)

- **Script:** `scripts/validate-preview-sample.mjs` · **npm:** `cd react-pilot && npm run validate:preview-sample`
- **Sample:** `MANTA End User Testing/samples/NCRMP-Benthic-FG.xml`
- **Pipeline:** import → merge → sanitize → `buildXmlPreview` → writes preview under cache dir.
- **Cache:** `NOAA_ISO19139_SCHEMA_DIR` (default `/tmp/noaa-iso19139`) — mirrored `schema.xsd` + dependencies, plus `ncrmp-preview-validate.xml`
- **Mirror:** fetch from `https://data.noaa.gov/resources/iso19139/`, BFS on relative `schemaLocation` in XSD text.
- **Validate:** `xmllint --noout --schema $CACHE/schema.xsd $CACHE/ncrmp-preview-validate.xml`
- **Tip:** if NOAA updates remote XSDs, delete the cache dir once to refresh.

### 22.2 `validate:xml` (arbitrary file)

- **Script:** `scripts/validate-xml.mjs`
- **Env:** `XML_SCHEMA` (default `--schema` when flag omitted; file arg still required), `XML_CATALOG_FILES` for offline includes.

### 22.3 Rule-pipeline npm (R-RULES; not `validatePilotState`)

Full chain: `npm run swarm:all` (= sync + validate + compile + qa).

| npm script | Script (under `scripts/swarm/`) |
|------------|----------------------------------|
| `swarm:sync` | `sync-rules-from-matrices.mjs` |
| `swarm:validate` | `validate-rules-csv.mjs` |
| `swarm:compile` | `compile-rules.mjs` |
| `swarm:qa` | `check-rules-quality.mjs` |
| `swarm:regress` | `regress-mission-validity.mjs` |
| `swarm:regress:roundtrip` | same + `--include-roundtrip --allow-write` |
| `swarm:audit` | `audit-repo.mjs` |
| `swarm:audit:rules` | `audit-repo.mjs --skip-regress` |
| `swarm:audit:import` | `audit-mission-import.mjs` |
| `swarm:api:coverage` | `check-comet-api-coverage.mjs` |
| `swarm:loop` | `swarm:all` + `swarm:regress` + `swarm:api:coverage` |
| `swarm:pull:comet` | `pull-comet-xml-fixtures.mjs` |
| `swarm:export:comet:missions` | `export-comet-mission-forms.mjs` |
| `swarm:search:comet` | `search-comet-similar.mjs` |
| `swarm:condition:demo` | `evaluate-condition.mjs` |

Separate batch lane: `npm run batch:all` (WAF + UUID audits + `batch:report`).

### 22.4 EUT lenient lanes (E-EUT; import-side)

- **Doc:** `docs/EUT_LENIENT_SWARM.md`
- **Rollup:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.{md,json}` · **Patterns:** `manta-samples-lenient-patterns.csv`
- **EUT-A** — Keywords / GCMD / KMS · **EUT-B** — Mission · **EUT-C** — Platform id/desc · **EUT-D** — Sensors + distribution
- **Primary lever:** `src/lib/xmlPilotImport.js` (+ merge/sanitize in `pilotValidation.js`). Do not “fix” rollup by deleting `missionValidationRules.js` checks unless product intent changes.

---

## 23. `pilotState` — top-level buckets (validation-relevant)

| Bucket | Examples |
|--------|----------|
| `mission` | fileId, title, abstract, dates, POC, bbox, license preset, … |
| `spatial` | lineage, grid, trajectory, CRS hints, … |
| `platform` | platformType, platformId, platformDesc, … |
| `sensors[]` | type, modelId, sensorId, variable, … |
| `keywords` | GCMD facet chips (science, datacenters, platforms, …) |
| `distribution` | URLs, format, license, distributor, `nceiFileIdPrefix`, … |
| `sourceProvenance` | import stamps (−3 vs −2 family) |
| `mode` | `lenient` \| `strict` \| `catalog` (drives `validatePilotState`) |

---

## 24. Wizard step → state (mission profile)

| Step | State prefix |
|------|----------------|
| 1 Mission | `mission.*` |
| 2 Platform | `platform.*` |
| 3 Sensors | `sensors[]` |
| 4 Spatial | `spatial.*` (+ overlap with mission per rules) |
| 5 Keywords | `keywords.*` |
| 6 Distribution | `distribution.*` |

---

## 25. Import vs export (validation implications)

Import accepts **19115-3** (`mdb`) or **19115-2** (`gmi`). Preview/export always emits **19115-2** GMI/GMD from `pilotState`. So `validatePilotState` issues refer to **pilot fields / GMI XPaths**; imported −3 XML may differ until merged and re-serialized.

---

## 26. Batch validation — EUT audit (cross-sample)

- **Command:** `cd react-pilot && npm run audit:manta-samples`
- **Input:** `MANTA End User Testing/samples/*.xml`
- **Flow:** import → merge → validate (lenient / strict / catalog) → `buildXmlPreview` → optional `xmllint` when available
- **Output:** `manta-samples-lenient-rollup.{md,json}`, `manta-samples-lenient-patterns.csv`, `manta-samples-iso2-audit.{md,json}`
- **Stricter gate:** `npm run verify:manta-eut-perfect` (exit 1 if any sample has lenient errors > 0)
- **Pipeline verify:** `npm run verify:manta-pipeline`

Use the rollup to choose **import fixes** (`xmlPilotImport.js`) vs **rule changes** (`pilotValidation.js` / `missionValidationRules.js`).

---

## 27. Deep tables (do not duplicate here)

- **Generated field matrix:** `docs/generated/mission-validation-by-field.generated.md` — regenerate: `npm run docs:mission-validation-rules`
- **Curated narrative:** `docs/mission-validation-by-area.md`

---

## 28. Technical validation summary (ties to §12)

Interactive gate: **`validatePilotState(lenient|strict|catalog)`** on `pilotState`, plus GCMD UUID warnings and abstract hints. XML preview adds **WF** only in the browser; full NOAA XSD is **`xmllint` / catalog** (or CoMET when configured). EUT audit batch-measures samples with the same runtime validator + preview builder to improve import **without** relaxing catalog intent. Stakeholder-facing wording: **§12** above.

---

## 29. Files — quick index

| Role | Path |
|------|------|
| Merge, sanitize, validate | `src/lib/pilotValidation.js` |
| Mission rule wiring | `src/profiles/mission/missionValidationRules.js` |
| XML → partial | `src/lib/xmlPilotImport.js` |
| State → ISO-2 preview | `src/lib/xmlPreviewBuilder.js` |
| Preview sanity (CI) | `src/lib/iso191152PreviewSanity.js` |
| Preview hints | `src/lib/xmlPreviewStructuralHints.js` |
| WF UI | `src/components/XmlPreviewPanel.jsx` |
| Issues UI | `src/components/ValidationPanel.jsx` |
| CI gate | `scripts/verify-pilot.mjs` |
| EUT batch audit | `scripts/audit-manta-end-user-samples.mjs` |
| `xmllint` wrapper | `scripts/validate-xml.mjs` |
| NOAA mirror + sample validate | `scripts/validate-preview-sample.mjs` |
| Rule-pipeline swarm | `scripts/swarm/*.mjs` |
| Batch audits | `scripts/batch/*.mjs` |
| Export rules doc | `scripts/export-mission-validation-rules.mjs` |
| EUT import lanes doc | `docs/EUT_LENIENT_SWARM.md` |
| Rule-pipeline board | `docs/SWARM_IMPLEMENTATION_BOARD.md` |
| **This canonical doc** | `docs/MANTA_ONE_APP_MISSION_XML_README.md` |
| Repomix (LLM pack) | `repomix.config.json` → `npm run repomix` → `repomix-output.xml` (gitignored); **`repomix.critical.config.json`** → `npm run repomix:critical` → `repomix-critical-output.xml` (~15 files, import/validate/preview brain) |

---

*Last expanded: 2026-05 — single canonical doc (Part I + Part II); mission preview vs NOAA `iso19139/schema.xsd`; WF vs xmllint; EUT audit workflows.*
