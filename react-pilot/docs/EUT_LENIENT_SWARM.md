# EUT Lenient Rollup — Parallel Swarm Lanes

Cross-reference: `npm run audit:manta-samples` → `MANTA End User Testing/reports/manta-samples-lenient-rollup.{md,json}`.

These lanes split **remaining** lenient errors/warnings after platform-type + license import heuristics (see `xmlPilotImport.js`). Run lanes in parallel; merge via small focused PRs.

## SWARM-EUT-A — Keywords facets + UUID hydration

**Rollup:** `keywords.instruments` / `keywords.platforms` / `keywords.projects` / `keywords.locations` missing; many `keywords.*.[n].uuid` warnings.

**Goal:** Import fills required facets from ISO `descriptiveKeywords`; hydrate `uuid` from `gmx:Anchor` `@xlink:href` / KMS patterns where label alone is insufficient.

**Primary files:** `react-pilot/src/lib/xmlPilotImport.js` (`parseKeywords`, keyword chips), `keywordUuidFromConceptHref`.

**Exit:** Rollup shows fewer “at least one keyword required” errors for instruments/platforms/projects/locations; UUID warnings reduced where Anchor provides concept id.

## SWARM-EUT-B — Mission core fields

**Rollup:** `mission.purpose`, `mission.endDate`, `mission.individualName`, `mission.accession` (format), occasional `mission.email`.

**Goal:** Map ISO fields into pilot mission (CI_ResponsibleParty, citation dates, purpose, temporal extent end).

**Primary files:** `xmlPilotImport.js` (19115-2 + 19115-3 paths), `mergeLoadedPilotState` / `sanitizePilotState` if normalization needed.

**Exit:** Fewer mission-step errors on EUT samples without weakening catalog rules.

## SWARM-EUT-C — Platform ID + description

**Rollup:** `platform.platformId`, `platform.platformDesc` errors (often paired — acquisition block partial).

**Goal:** Derive ID from `MI_Platform`/identifier/code; derive description from platform `description`, instrument context, or abstract slice.

**Primary files:** `xmlPilotImport.js` (`parseAcquisitionInfo`, `parseAcquisition3`, heuristics).

**Exit:** Rollup drops platform ID/description errors for samples that carry platform metadata in XML.

## SWARM-EUT-D — Sensors + distribution format

**Rollup:** `sensors[0].modelId`, `distribution.format`.

**Goal:** Map first instrument to sensor row IDs; map `MD_Format` / distributionFormatName into `distribution.format` / format name fields.

**Primary files:** `xmlPilotImport.js`, `sensorInstrumentDescription.js` if dedupe affects IDs.

**Exit:** Fewer sensor/distribution errors on samples with acquisition or distribution format metadata.

## Progress (import code)

- **EUT-C / EUT-D (partial):** `xmlPilotImport.js` now (a) scans **all** `distributionInfo` blocks for `MD_Format` with **gmdAnchorOrCharacterString** / `mccAnchorOrText` names, (b) **normalizes sensor id/model** from type/variable when instrument code is empty, (c) **xlink `gmi:platform` / `mac:platform`** → id + title, (d) **GCMD `keywords.platforms[0]`** and **mission title/abstract** backfill `platformId` / `platformDesc` (bugfix: do not return early when the platforms facet is empty). EUT rollup: **`platform.platformId` / `platform.platformDesc` → 0**; **`sensors[0].modelId` → 0**; **`distribution.format` still 8** samples (no `MD_Format` in XML — needs a product default or a different ISO path).
- **Next:** EUT-A (keyword facets + UUIDs), EUT-B (mission purpose/dates/accession), optional safe default for `distribution.format` when missing.

## Governance

- Prefer **import fixes** over relaxing `pilotValidation.js` unless product agrees catalog intent changes.
- After each lane merges, run `cd react-pilot && npm run audit:manta-samples` and append one line to repo `AGENTS.md` audit log only if automation or report paths change.

## Parallel assignment (Cursor / humans)

| Agent | Lane | Primary focus |
|-------|------|----------------|
| 1 | **EUT-A** | `parseKeywords` / `parseKeywords3` — facet routing, `keywordUuidFromConceptHref` patterns, optional bridge from acquisition → instrument/platform chips |
| 2 | **EUT-B** | Mission: `gmdAnchorOrCharacterString` for purpose, **all** `extent` siblings for temporal dates, accession URL stripping, optional −2 MI_Operation dates |
| 3 | **EUT-C** | Platform: iterate multiple `gmi:platform`, xlink `@title`/`@href`, keywords.platforms → id/desc fallbacks, instrument-derived synthetic id |
| 4 | **EUT-D** | Anchor-aware `MD_Format` name; multi–`distributionInfo` scan; sensor `modelId` when code empty; consider `modelId` in dedupe key |

Suggested merge order for fewer conflicts: **EUT-D** (localized parsers) → **EUT-C** (heuristics next to existing `applyIsoImportHeuristics`) → **EUT-B** (mission blocks) → **EUT-A** (keywords touch many facets).

## Swarm reconnaissance summary (rollup-aligned)

- **A — Keywords:** Failures cluster when `facetFrom*` drops blocks (thesaurus title mismatch) or keywords are plain `CharacterString` (empty uuid). Fixes: broaden facet detection; improve href→uuid extraction; optionally seed instruments/platforms from acquisition when facets are empty.
- **B — Mission:** Purpose may need anchor-aware read; `endDate` can miss when only non-first `extent` has temporal data or citation uses non-`completion` date types; accession may include URL characters—normalize in `citationIdentifiers`(*3).
- **C — Platform:** ~10 EUT files lack inline `MI_Platform` (xlink-only platform, keywords-only, instruments-only). Fixes: walk all platform children; map xlink title; backfill id/desc from `keywords.platforms[0]` and mission text.
- **D — Sensors / format:** `parseDistribution` uses first block only and plain `gcoCharacterString` for format name (no Anchor). Sensor rows can exist with `type`/`variable` but empty `code`—backfill `modelId` or tighten “has content” rules; consider −3 `parseSensors` parity.
