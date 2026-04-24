# Mission enhancement roadmap

This document finalizes the highest-value mission workflow enhancements after the April 2026 roadmap and code audit. It is intentionally scoped to changes that improve the canonical `react-pilot` mission profile without inventing a new app or breaking the existing `pilotState` / ISO preview spine.

## Current implementation status

- Shipped: human-readable validation labels, plain-language step status, corrected mission XML/XPath details, `MD_ProgressCode` codelist attributes, native title/abstract GCMD suggestions in the Keywords step, truthful CoMET preflight result handling, scanner `profileId` / `xmlSnippet` consistency, phrase/stopword seed filtering, named readiness bundles, scanner/keyword accessibility improvements, and first-pass UxS operational context fields for deployment/run/sortie/dive.
- Verified in `scripts/verify-pilot.mjs`: readiness bundle predicates and XML-snippet scanner seed behavior are covered alongside the existing pilot, BEDI, scanner merge, XML roundtrip, and validation parity checks.
- Still deployment-blocking: HTTP API auth/CORS hardening, a structured audit event envelope plus persistence sink, and a documented CoMET operator/session model.

## Best enhancements to ship first

### Phase 0 — make the current mission flow clearer and safer

1. **Human-readable validation issues**
   - Replace raw field paths in the validator (`mission.fileId`, `distribution.downloadUrl`) with user-facing labels while preserving the raw path for support.
   - Primary targets: `src/components/ValidationPanel.jsx`, `src/core/registry/FieldRegistry.js` or a small shared field-label module.
   - Why first: users can fix metadata faster without needing to understand internal `pilotState` names.

2. **Plain-language step status**
   - Improve `StepNav` status labels from internal tokens (`ok`, `warn`, `err`) to accessible text such as "No issues", "Warnings", and "Errors".
   - Primary target: `src/components/StepNav.jsx`.
   - Why first: low-risk accessibility and usability win.

3. **Mission step hierarchy and guidance**
   - Add clearer required/optional grouping for identification, dates, contacts, constraints, aggregation, and templates.
   - Shorten long ISO/legacy hints and move deeper explanations into expandable help or docs links.
   - Primary target: `src/features/mission/StepMission.jsx`.
   - Why first: the Mission step is correct but dense; better hierarchy improves completion.

4. **Fix misleading XML/XPath details**
   - Align mission validation XPaths with the actual `gmi:MI_Metadata` preview output.
   - Fix platform and distribution/license rule paths that currently point at confusing or overly generic XML locations.
   - Emit `gmd:MD_ProgressCode` with codelist attributes in mission XML, matching the stronger BEDI preview pattern.
   - Primary targets: `src/profiles/mission/missionValidationRules.js`, `src/lib/xmlPreviewBuilder.js`.
   - Why first: makes Lens/validator/XML review more trustworthy.

5. **Truthful CoMET preflight**
   - Treat CoMET validate, link check, and rubric JSON responses as business results, not just HTTP success.
   - Primary targets: `src/profiles/mission/useMissionCometActions.js`, `src/lib/cometClient.js`.
   - Why first: "preflight passed" must mean the record actually passed the relevant checks.

### Phase 1 — make scanner-assisted metadata feel native

1. **Move abstract-to-GCMD suggestions into the Keywords step**
   - Replace the current "AI keyword suggest (stub)" with the existing heuristic flow.
   - Add a "Suggest from title/abstract" action on `StepKeywords`.
   - Primary targets: `src/features/keywords/StepKeywords.jsx`, `src/components/ScannerSuggestionsDialog.jsx`, `src/lib/lensScanHeuristic.js`.
   - Why next: the scanner already works, but users need it where they choose keywords.

2. **Improve suggestion evidence**
   - Show per-suggestion seed word, matched phrase, confidence, source, and GCMD/KMS link where available.
   - Avoid showing one generic evidence blob for every flattened keyword row.
   - Primary targets: `src/lib/lensScanHeuristic.js`, `src/components/ScannerSuggestionsDialog.jsx`, `src/adapters/sources/ScannerSuggestionAdapter.js`.
   - Why next: scanner trust depends on visible evidence.

3. **Improve GCMD retrieval**
   - Add a stronger GCMD concept search path instead of relying only on first-page scheme filtering.
   - Shipped: stopword filtering and phrase/bigram seeds.
   - Remaining: stronger concept search / bounded ranking to reduce weak substring matches.
   - Primary targets: `src/lib/gcmdClient.js`, `src/lib/lensScanHeuristic.js`.

4. **Use all scanner input consistently**
   - Include `xmlSnippet` in scanner seed generation when supplied by the UI or `/api/db`.
   - Pass `profileId` through scanner UI paths so profile-specific scanner behavior works consistently.
   - Status: implemented for browser and host scanner paths.
   - Primary targets: `src/lib/lensScanHeuristic.js`, `src/components/ScannerSuggestionsDialog.jsx`, `src/adapters/http/HttpHostAdapter.js`.

5. **Abstract quality checks**
   - Add non-blocking warnings for thin abstracts: too short, missing platform/sensor terms, missing temporal/spatial context, or unexplained acronyms.
   - Primary target: `src/profiles/mission/missionValidationRules.js`.

### Phase 2 — readiness, governance, and richer NCEI fidelity

1. **Named readiness bundles**
   - Add explicit bundles such as `ISO-ready`, `discovery-ready`, `CoMET-preflight-ready`, and `archive-handoff-ready`.
   - Keep `lenient` / `strict` / `catalog` as validation modes, but stop treating them as the only readiness language.
   - Status: implemented as additive predicates over strict/catalog validation, CoMET preflight state, and dirty state.
   - Primary targets: `src/lib/readinessSummary.js`, `src/components/ReadinessStrip.jsx`, `src/components/ValidationPanel.jsx`, `src/profiles/mission/missionValidationRules.js`.

2. **Mission audit event envelope**
   - Emit structured client events for scanner merges, auto-fixes, validation runs, draft saves, and CoMET pull/preflight/push.
   - Include profile id, mode, issue counts, readiness state, action result, and an anonymized record identifier where possible.
   - Primary targets: `src/shell/WizardShell.jsx`, `src/profiles/mission/useMissionCometActions.js`, `src/lib/sourceProvenance.js`, future `/api/db` audit sink.

3. **Access constraints codelist UX**
   - Replace free-text-only access constraints with a controlled codelist plus an "other constraints" narrative field.
   - Primary targets: `src/features/mission/StepMission.jsx`, `src/profiles/mission/missionValidationRules.js`, `src/lib/xmlPreviewBuilder.js`.

4. **Explicit UxS collection layers**
   - Do not treat mission as the same thing as dataset. A NOAA UxS record can represent a dataset/product while also linking to parent mission/project, deployment/run, acquisition, variable coverage, platform, instrument, and cross-reference collections.
   - Add a first-class deployment/run decision before building archive/search UX so sorties, dives, runs, failed operations, and run-level products do not get buried in dataset title text.
   - Status: first-pass optional Mission step context is implemented as `mission.uxsContext`; XML aggregation export/import mapping remains the next controlled slice.
   - Separate hierarchy (`largerWorkCitation`) from graph relationships (`crossReference`) in UI labels and export/import mapping.
   - Primary targets: `src/features/mission/StepMission.jsx`, `src/lib/xmlPreviewBuilder.js`, `src/lib/xmlPilotImport.js`, `docs/uxs-ncei-template-mission-pilot-matrix.md`.

5. **Richer citation and contact modeling**
   - Support multiple authors, publishers, originators, and fuller `CI_Contact` detail when NCEI template fidelity requires it.
   - Primary targets: `src/features/mission/StepMission.jsx`, `src/lib/xmlPreviewBuilder.js`, `src/lib/xmlPilotImport.js`.

6. **Roundtrip parity upgrades**
   - Decide whether to emit real `gml:timeInterval` when mission interval fields are filled, or document/comment that preview remains intentionally lossy.
   - Revisit root `metadataMaintenance` vs identification `resourceMaintenance` placement against the NCEI fixture.
   - Add fixture-backed checks for collection relationship semantics: mission/project parent, deployment/run, dataset/product, platform/instrument acquisition, variable coverage, and cross-reference edges.
   - Primary targets: `src/lib/xmlPreviewBuilder.js`, `src/lib/xmlPilotImport.js`, `docs/uxs-ncei-template-mission-pilot-matrix.md`.

## Recommended implementation order

1. Human-readable validator labels + StepNav status labels.
2. XML/XPath trust fixes and `MD_ProgressCode` codelist attributes.
3. Replace Keywords step stub with "Suggest from title/abstract".
4. Per-suggestion scanner evidence and better GCMD retrieval.
5. Truthful CoMET preflight response interpretation.
6. Named readiness bundles.
7. Audit event envelope.
8. Explicit UxS collection layers, starting with deployment/run.
9. Richer citation/contact and roundtrip parity upgrades.

## Keep out of the first pass

- Full LLM scanner until the deterministic GCMD heuristic has better evidence and native UX.
- Full arbitrary-depth NCEI citation trees until the common mission author/publisher/originator cases are clean.
- Large dashboard work until named readiness bundles and audit events exist.
