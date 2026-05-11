# Agents audit — uSX / Manta metadata workspace

This file orients **automated agents** (Cursor, CI bots, swarm lanes) on how to work in this repo without fighting the architecture. Update it when workflows change.

## Repository shape

| Area | Role |
|------|------|
| Repo root | Legacy HTML / Apps Script **reference only** for XML parity — not the runtime shell for the React pilot. |
| `react-pilot/` | **Canonical** Vite app: `pilotState`, validation, wizard steps, Manta widget, lens overlay. |
| `react-pilot/netlify/functions/` | Same-origin `POST /api/db` when using Netlify / `netlify dev`. |
| `schemas/`, `compiled_rules/`, `scripts/swarm/` | Rule pipeline (SWARM board); see `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md`. |

### ISO metadata lineage (19115-3 → 19115-2)

The React pilot **does not** preserve −3 XML verbatim on export. **`importPilotPartialStateFromXml`** accepts **both** ISO **19115-3** (`mdb` / `standards.iso.org/iso/19115/-3`) and **19115-2** (`gmi:MI_Metadata` / classic `gmd`). **`buildXmlPreview` / file export always emits ISO 19115-2-shaped GMI/GMD** (`react-pilot/src/lib/xmlPreviewBuilder.js`). So the canonical transfer is **3 → 2** (or **2 → 2**) through **`pilotState`**. Provenance: `sourceProvenance.importIsoXmlFamily` / `exportPreviewIsoFamily` in `xmlPilotImport.js` (`stampIsoImportProvenance`). XML preview surfaces a hint when the upload was −3 (`XmlPreviewPanel.jsx`).

## Commands agents should actually run

```bash
cd react-pilot && npm install && npm run verify:pilot   # lint + build + parser checks
cd react-pilot && npm run dev                          # UI only (port 5173)
cd react-pilot && npm run dev:netlify                  # Vite + /api proxy (port 8888 → 5173)
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
2. **Assuming `npm run dev` alone exercises `/api/db`** — use `dev:netlify` or deploy-shaped proxy.
3. **Treating `docs/*.html` mockups** as production behavior — they are UX prototypes unless wired into React.
4. **Spreadsheet-only validation** — runtime truth is `pilotState` + `validationEngine` + profile rules.

## Swarm parallel lanes (reference)

See `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md` for SWARM-A … SWARM-F ownership. “Agent 1–4” there are **human/agent work packages**, not Cursor product agents.

## Audit log (maintenance)

| Date | Finding |
|------|---------|
| 2026-05 | Added `AGENTS.md`; lens inline glass suppresses `.field-error` with `hidden` + `display:none !important` restore on teardown. |
| 2026-05 | Collapsed lens strip: profile-aware “detected” copy, unified issue count, Operational Glass tokens (`--manta-op-*`); corner HUD pulse toned to one-shot settle; `manta-chrome-extension` can open pilot in a separate `windows.create` popup. |
| 2026-05 | Expanded lens: default HUD expanded when `manta-lens-hud-expanded` absent (readiness strip visible); lens tags use semantic `--manta-op-*`; XML primary highlight pulse finite (2 iterations). |
| 2026-05 | Lens portal inset: `WizardShell` sets `--pilot-lens-inset-top` from `.workspace-grid` top vs `.pilot-wizard-lens-stack` (not step-nav height alone) so `#manta-scanner-host` clears the XML tools row and aligns with the form/side grid. |
| 2026-05 | **split-float:** `ReadinessStrip` + `ValidationPanel` portal from `WizardShell` into the right floater host (`workbenchChromeContext` / `registerValidatorHost`); side **Rules** tab shows a short docked hint. Lens: top drag handle + `manta-lens-drag-surface` offset (sessionStorage) without clobbering lens entrance `transform`. |
| 2026-05 | Lens HUD no longer duplicates Left rail: certification/readiness strip + score progress bar removed from expanded lens; section bars + scopes/fix remain. Split-float default **More** off unless `sessionStorage` overrides. |
| 2026-05 | Split-float: standalone ⌕ FAB removed; lens toggle is **⬡ LENS** on `MantaToolsFabDock` only (`lensActive` state + “Lens on” chip). |
| 2026-05 | Split-float: fullscreen `#manta-scanner-host` lens **disabled**; **LENS** is first tab on `MantaToolsFabDock` — scanner UI in sheet (`LensScannerWorkspacePanel.jsx`). Overlay path unchanged for non-split layouts. |
| 2026-05 | Split-float rails: **Navigator** (`LensSectionNavigator.jsx`) floats **left** when `lensMode`; **Issues · Score** (`ReadinessStrip` + `ValidationPanel` portal) floats **right**. FAB LENS sheet omits duplicate section bars (`hideSectionBars`). |
| 2026-05 | App header **Lens** switch (default off) drives `EmbeddableShell` prop `mantaToolsEnabled`; when off the split-float `MantaToolsFabDock` does not mount, floating FAB cluster hidden, lens/window events + auto-open hooks no-op; `WorkbenchChromeProvider` `lensActive` false. |
| 2026-05 | **split-float dedup:** Main step column hides duplicate err/warn/% chips (`WizardShell`); mission strip hides score + lenient/strict/catalog pills (`MantaMissionCapabilityStrip` + `assistantLayout`); FAB `LensScannerWorkspacePanel` drops mini score ring, count tags, and useless **More** when section bars already omitted (`hideSectionBars`). Canonical scores/modes/issues stay on the **Validation** left rail + dock tab affordances. |
| 2026-05 | **Workspace density default `simple`:** new sessions / no `manta-workspace-density-v1` → minimal wizard chrome when Lens is on (`quietSurface`); FAB dock still toggles **Simple** vs **Detailed** (granular). |
| 2026-05 | **Lens HUD simple defaults:** no `manta-lens-hud-expanded` → compact HUD (`manta-lens--hud-compact`, section overview bars hidden); no `manta-tools-fab-sheet-open-v1` → FAB sheet closed until opened (turning Lens on split-float still opens sheet via `AssistantShell` effect). |
| 2026-05 | Import merge surfaces population summary (`importMergeSummary.js`); XmlToolsBar / wizard-start modal show merge stats + parser warnings; Validation panel adds severity explainer, Prev/Next issue stepping, darker-theme button/select contrast; Xml preview optional structural hints (`xmlPreviewStructuralHints.js`); Mission guided intro when workspace density is Simple. |
| 2026-05 | **Mission step density:** long helper copy moved from under inputs into `FieldHintTooltip` / `LabelWithHint` (`FieldHintTooltip.jsx`); `StepMission.jsx` panel titles and UxS/temporal/constraints/aggregation blocks use ⓘ bubbles; `LabelWithHint` default `aria-label` avoids `[object Object]` when `label` is JSX. |
| 2026-05 | **Import sample report:** After XML **Apply** (header `XmlToolsBar` or wizard-start import), **Import report** downloads Markdown (`*-import-report.md`): parser warnings, validation issues, unset tracked paths (`pilotImportReportPaths.js`), line-diff table upload vs `buildXmlPreview` output (`pilotImportSampleReport.js`). Cleared on **Clear form**. |
| 2026-05 | **ISO 19115-3 → 19115-2:** Documented in Agents; import accepts −3 or −2 XML; preview/export is always −2 via `pilotState`. Import sample report clarifies this when provenance stamps −3 uploads. |

When closing a lens-related task, append one row if behavior or ports changed.
