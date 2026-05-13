# Agents audit — uSX / Manta metadata workspace

This file orients **automated agents** (Cursor, CI bots, swarm lanes) on how to work in this repo without fighting the architecture. Update it when workflows change.

## Repository shape

| Area | Role |
|------|------|
| Repo root | Legacy HTML / Apps Script **reference only** for XML parity — not the runtime shell for the React pilot. |
| `react-pilot/` | **Canonical** Vite app: `pilotState`, validation, wizard steps, Manta widget, lens overlay. |
| `react-pilot/netlify/functions/` | Same-origin `POST /api/db` when using Netlify / `netlify dev`. |
| `schemas/`, `compiled_rules/`, `scripts/swarm/` | Rule pipeline (SWARM board); see `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md`. |
| `react-pilot/docs/EUT_LENIENT_SWARM.md` | **EUT lenient reduction** — parallel lanes (A–D) to drive down `audit:manta-samples` rollup via import/mapping; complements rule-pipeline SWARM. |
| `react-pilot/docs/MANTA_ONE_APP_MISSION_XML_README.md` | **Single canonical doc** — one-app story, commands, XML lineage, **and** validation / swarm / architecture (Part II §15–29). |
| `react-pilot/repomix.config.json` + `npm run repomix` | **Repomix** — packs `react-pilot/` into `repomix-output.xml` (gitignored) for LLM context; excludes `reports/**`, `public/demo-records/**`, `public/**/*.svg`. |
| `react-pilot/repomix.critical.config.json` + `npm run repomix:critical` | **Critical-path Repomix** — 15 files (import, validation, preview + deps) → `repomix-critical-output.xml` (~110k tokens). |

### Metadata baseline — UxS / NCEI

End-user testing, `MANTA End User Testing/samples/`, and **AGENTS** guidance target the **mission** profile: **Unmanned Systems (UxS)** and **NCEI-shaped** ISO 19115-2. The repo may register other metadata profiles for separate workflows; **do not** mix their steps, parsers, or validation into UxS/mission work unless the task explicitly says so.

| Role | Path |
|------|------|
| **Structural reference (NCEI collection template, clean `gmi:MI_Metadata` skeleton)** | `MANTA End User Testing/reference/ncei-collection-metadata/ncei_template-clean.xml` — same content as `NCEI Template/ncei_template-clean.xml` and `react-pilot/public/demo-records/NCEI Template/ncei_template-clean.xml` |
| **Authoritative guidance (PDF)** | `MANTA End User Testing/reference/ncei-collection-metadata/AB-GUID-02823_R1_Guidance for The NCEI Collection Level Metadata Template v1.2.pdf` |
| **EUT import stress corpus** | `MANTA End User Testing/samples/*.xml` |

The template is **collection-level**; mission records are **dataset / acquisition** — expect **block-level** alignment (contacts, identifiers, distribution patterns), not a byte-for-byte match to every collection placeholder.

**External schema / rubric truth** (stricter than in-repo `buildXmlPreview` sanity + `pilotState` validation):

- **`xmllint`:** `cd react-pilot && npm run validate:xml -- path/to.xml` — add `--schema <xsd-or-url>` when validating against XSD. For **offline** resolution of OGC/ISO includes, point libxml2 at a local **XML catalog** (e.g. `XML_CATALOG_FILES` / `SGML_CATALOG_FILES` — see your platform’s libxml2 docs).
- **CoMET:** validate / score / transform endpoints used by `cometClient.js` and `netlify/functions/comet-proxy.mjs` when the environment has credentials and you need service-side rules.

### ISO metadata lineage (19115-3 → 19115-2)

The React pilot **does not** preserve −3 XML verbatim on export. **`importPilotPartialStateFromXml`** accepts **both** ISO **19115-3** (`mdb` / `standards.iso.org/iso/19115/-3`) and **19115-2** (`gmi:MI_Metadata` / classic `gmd`). **`buildXmlPreview` / file export always emits ISO 19115-2-shaped GMI/GMD** (`react-pilot/src/lib/xmlPreviewBuilder.js`). So the canonical transfer is **3 → 2** (or **2 → 2**) through **`pilotState`**. Provenance: `sourceProvenance.importIsoXmlFamily` / `exportPreviewIsoFamily` in `xmlPilotImport.js` (`stampIsoImportProvenance`). XML preview surfaces a hint when the upload was −3 (`XmlPreviewPanel.jsx`).

## Commands agents should actually run

```bash
cd react-pilot && npm install && npm run verify:pilot   # lint + build + parser checks
cd react-pilot && npm run dev                          # Netlify dev (8888) + Vite — `/api/*` + CoMET same-origin
cd react-pilot && npm run dev:vite                     # Vite only (5173); use `dev:with-api-proxy` if 8888 is up
cd react-pilot && npm run dev:netlify                  # alias of `npm run dev` (Netlify dev)
cd react-pilot && npm run audit:manta-samples          # EUT XML samples → import → validate → ISO-2 preview audit + lenient rollup JSON/MD/CSV (writes ../MANTA End User Testing/reports/)
cd react-pilot && npm run verify:manta-eut-perfect    # same as verify:manta-pipeline **plus** exit 1 if any sample has lenient **errors** > 0 (UxS EUT “perfect” target)
cd react-pilot && npm run repomix                     # pack react-pilot → repomix-output.xml (LLM context; gitignored; see repomix.config.json)
cd react-pilot && npm run repomix:critical            # ~15 critical files → repomix-critical-output.xml (~110k tokens; import/validate/preview)
```

Do not instruct users to run commands you can run yourself unless blocked by secrets.

## AI change control

Before broad Gemini / Antigravity / Cursor edits, read `AI_CHANGE_CONTROL.md`. Keep edits scoped with an `allowedFiles` list, preserve `npm run verify:pilot`, and do not weaken validation gates or score thresholds just to make a run pass. If an agent changes XML import/export, compiled rules, Chrome extension permissions, or large shell/CSS files, require manual review before committing.

## Lens + validation (common confusion)

- **Manta Lens** (`AssistantShell.jsx` + `#manta-scanner-host` in `WizardShell.jsx`) portals HUD chrome over the workspace; **issues tray + Fix Issues** port to `#manta-lens-step-footer-host` at the **bottom of the active step column**.
- **Inline glass** strips are injected in `AssistantShell` for `lensIssuesScoped` fields. Native wizard `<p class="field-error">` rows are **suppressed** while glass is shown (`data-manta-lens-suppressed`) so text is not duplicated — if duplication persists, audit DOM order (wrapped inputs, conditional `show()`).
- **STEP vs ALL** scope filters which issues drive glass — mismatched expectation often looks like “wrong step” bugs.

## Anti-patterns for agents

1. **Editing repo-root legacy generators** expecting the React app to pick them up — it will not.
2. **Assuming `npm run dev:vite` alone exercises `/api/db` or CoMET** — it does not; use `npm run dev` (Netlify) or `dev:with-api-proxy` toward a running Netlify dev port.
3. **Treating `docs/*.html` mockups** as production behavior — they are UX prototypes unless wired into React.
4. **Spreadsheet-only validation** — runtime truth is `pilotState` + `validationEngine` + profile rules.

## Swarm parallel lanes (reference)

See `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md` for SWARM-A … SWARM-F ownership. “Agent 1–4” there are **human/agent work packages**, not Cursor product agents.

## Audit log (maintenance)

| Date | Finding |
|------|---------|
| 2026-05 | **Assistant bridges:** ISO import infers license preset + `distribution.license` from `useLimitation`/`otherConstraints` prose; post-import fills NCEI docucomp `licenseUrl` when preset is NCEI. Keywords step: bulk **KMS resolve** + per-chip **KMS** on label-only rows (index-based remove fixes empty-UUID chip keys); Distribution (mission): **CoMET ISO validate** on live preview; XML preview **WF** well-formed pill (DOMParser); Mission: **contact library** presets; lens heuristic accepts `fileId` and may suggest `mission.startDate` / `platform.platformType`. |
| 2026-05 | Added `AGENTS.md`; lens inline glass suppresses `.field-error` with `hidden` + `display:none !important` restore on teardown. |
| 2026-05 | Collapsed lens strip: profile-aware “detected” copy, unified issue count, Operational Glass tokens (`--manta-op-*`); corner HUD pulse toned to one-shot settle; `manta-chrome-extension` can open pilot in a separate `windows.create` popup. |
| 2026-05 | Expanded lens: default HUD expanded when `manta-lens-hud-expanded` absent (readiness strip visible); lens tags use semantic `--manta-op-*`; XML primary highlight pulse finite (2 iterations). |
| 2026-05 | Lens portal inset: `WizardShell` sets `--pilot-lens-inset-top` from `.workspace-grid` top vs `.pilot-wizard-lens-stack` (not step-nav height alone) so `#manta-scanner-host` clears the XML tools row and aligns with the form/side grid. |
| 2026-05 | **split-float:** `ReadinessStrip` + `ValidationPanel` portal from `WizardShell` into the right floater host (`workbenchChromeContext` / `registerValidatorHost`); side **Rules** tab shows a short docked hint. Lens: top drag handle + `manta-lens-drag-surface` offset (sessionStorage) without clobbering lens entrance `transform`. |
| 2026-05 | Lens HUD no longer duplicates Left rail: certification/readiness strip + score progress bar removed from expanded lens; section bars + scopes/fix remain. Split-float default **More** off unless `sessionStorage` overrides. |
| 2026-05 | Split-float: standalone ⌕ FAB removed; **⬡ LENS** is the first tab on `MantaToolsFabDock` only (no duplicate bar button, no “Lens on” meta chip). Active lens tab uses `tab--lens` styling; issue/readiness chips in the meta row hide while the lens tab is open. |
| 2026-05 | Split-float: fullscreen `#manta-scanner-host` lens **disabled**; **⬡ LENS** is first tab on `MantaToolsFabDock` — scanner UI in sheet (`LensScannerWorkspacePanel.jsx`). Overlay path unchanged for non-split layouts. |
| 2026-05 | Split-float rails: **Navigator** (`LensSectionNavigator.jsx`) floats **left** when `lensMode`; **Issues · Score** (`ReadinessStrip` + `ValidationPanel` portal) floats **right**. FAB LENS sheet omits duplicate section bars (`hideSectionBars`). |
| 2026-05 | App header **Lens** switch (default off) drives `EmbeddableShell` prop `mantaToolsEnabled`; when off the split-float `MantaToolsFabDock` does not mount, floating FAB cluster hidden, lens/window events + auto-open hooks no-op; `WorkbenchChromeProvider` `lensActive` false. |
| 2026-05 | **split-float dedup:** Main step column hides duplicate err/warn/% chips (`WizardShell`); mission strip hides score + lenient/strict/catalog pills (`MantaMissionCapabilityStrip` + `assistantLayout`); FAB `LensScannerWorkspacePanel` drops mini score ring, count tags, and useless **More** when section bars already omitted (`hideSectionBars`). Canonical scores/modes/issues stay on the **Validation** left rail + dock tab affordances. |
| 2026-05 | **Workspace density default `simple`:** new sessions / no `manta-workspace-density-v1` → minimal wizard chrome when Lens is on (`quietSurface`); FAB dock still toggles **Simple** vs **Detailed** (granular). |
| 2026-05 | **Lens HUD simple defaults:** no `manta-lens-hud-expanded` → compact HUD (`manta-lens--hud-compact`, section overview bars hidden); no `manta-tools-fab-sheet-open-v1` → FAB sheet closed until opened (turning Lens on split-float still opens sheet via `AssistantShell` effect). |
| 2026-05 | Import merge surfaces population summary (`importMergeSummary.js`); XmlToolsBar / wizard-start modal show merge stats + parser warnings; Validation panel adds severity explainer, Prev/Next issue stepping, darker-theme button/select contrast; Xml preview optional structural hints (`xmlPreviewStructuralHints.js`); Mission guided intro when workspace density is Simple. |
| 2026-05 | **Mission step density:** long helper copy moved from under inputs into `FieldHintTooltip` / `LabelWithHint` (`FieldHintTooltip.jsx`); `StepMission.jsx` panel titles and UxS/temporal/constraints/aggregation blocks use ⓘ bubbles; `LabelWithHint` default `aria-label` avoids `[object Object]` when `label` is JSX. |
| 2026-05 | **Import sample report:** After XML **Apply** (header `XmlToolsBar` or wizard-start import), **Import report** downloads Markdown (`*-import-report.md`): parser warnings, validation issues, unset tracked paths (`pilotImportReportPaths.js`), line-diff table upload vs `buildXmlPreview` output (`pilotImportSampleReport.js`). Cleared on **Clear form**. |
| 2026-05 | **ISO 19115-3 → 19115-2:** Documented in Agents; import accepts −3 or −2 XML; preview/export is always −2 via `pilotState`. Import sample report clarifies this when provenance stamps −3 uploads. |
| 2026-05 | **`audit:manta-samples`:** Batch-runs `MANTA End User Testing/samples/*.xml` through import → merge → lenient/strict/**catalog** validate → `buildXmlPreview`, preview→import round-trip, optional **xmllint**; writes `manta-samples-iso2-audit.{md,json}` with per-sample **`lenientIssues[]`**, plus **`manta-samples-lenient-rollup.{json,md}`** and **`manta-samples-lenient-patterns.csv`** (cross-sample frequency). Optional **`--fail-if-lenient-errors`** for CI when samples must be clean. |
| 2026-05 | **EUT lenient swarm:** `react-pilot/docs/EUT_LENIENT_SWARM.md` — parallel lanes EUT-A (keywords) / EUT-B (mission) / EUT-C (platform id/desc) / EUT-D (sensors + distribution format) to continue rolling up import fixes against `manta-samples-lenient-rollup.*`. |
| 2026-05 | **Docs:** `react-pilot/docs/MANTA_ONE_APP_MISSION_XML_README.md` — **single canonical doc** (one-app + validation/swarm architecture, Part II §15–29); `docs/SWARM_VALIDATION_ARCHITECTURE_SNAPSHOT.txt` redirects there. `react-pilot/README.md` links the canonical doc. |
| 2026-05 | **Lens symbiote (wrapped card, ref 05):** `LensSymbioteFrame.jsx` — ring wraps **field void + glass deck** (`min-height` 120px): insights column (Lens / guided / title / message / **Why?**), automations column (**fill** + abstract chips via `getLensChipsForIssue`), footer **Assistant / LLM** slot + **Safe defaults**; viewport **deck-top** flip. `AssistantShell.jsx` skips **inline glass** for the active symbiote field and wires callbacks mirroring inline strip. |
| 2026-05 | **Default `npm run dev`:** from `react-pilot/`, runs **Netlify dev** on **8888** (same-origin **`/api/db`** + **`/api/comet-proxy`**); **`dev:vite`** is Vite-only **5173**; explicit **`/api/comet-proxy`** + **`/api/db`** redirects in `netlify.toml`. |
