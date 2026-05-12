# UxS Metadata Generator Audit README

**Workspace:** `/Users/connorcayson/Downloads/uSX`  
**Primary repo:** `uxs-metadata-generator`  
**Remote:** `https://github.com/CPCayson/uxs-metadata-generator.git`  
**Audit date:** 2026-05-06

This README summarizes the broader audit scope for the UxS / Manta metadata workspace. The audit covered more than the React app: it included source templates, Excel workbooks, CruisePack, metadara validation packages, CoMET, OneStop/WAF references, Netlify APIs, MCP tooling, the Chrome bridge, and QA/regression artifacts.

## Director Summary

The audit covered the full UxS metadata ecosystem, not just one repository. I used `uxs-metadata-generator` as the engineering hub, but reviewed the surrounding workflow: Excel templates, DocuComp components, CoMET validation and draft push, Netlify APIs, SWARM rule compilation, NOAA Drive/MCP discovery, the Manta Chrome bridge, CruisePack 3.3.2, metadara validation packages, Team MetaForce GitLab-derived automation bundles, OneStop/OER/InformationBroker references, GCMD/ROR enrichment, ISO XML import/export, GeoJSON/DCAT outputs, and QA/security/deployment layers.

The current state is a strong validated metadata workbench, with CruisePack and several external source packages audited as reference/input lanes. CruisePack is present and extracted, but not yet implemented as a first-class intake adapter. Based on the audited artifacts, this workspace is ahead of the external script-only lanes in integration depth: it brings authoring, validation, XML import/export, CoMET preflight, DocuComp handling, SWARM rule compilation, and QA reporting into one workflow rather than isolated batch scripts.

## Main Workspace Areas

| Path | Role |
| --- | --- |
| `react-pilot/` | Canonical React/Vite metadata workbench. |
| `react-pilot/src/` | App source: profiles, wizard, Manta Lens, CoMET, XML, validation. |
| `react-pilot/netlify/functions/` | Netlify APIs for database bridge, CoMET, OER, OneStop, mission-list validation, Manta intent. |
| `react-pilot/rules/` | SWARM source rule CSVs. |
| `react-pilot/schemas/` | JSON schemas for rule and field-map validation. |
| `react-pilot/compiled_rules/` | Compiled mission, collection, and granule validation bundles. |
| `react-pilot/scripts/swarm/` | Rule compiler, QA, CoMET pull/search/regression, mission import audit. |
| `react-pilot/fixtures/mission/` | CoMET XML fixtures and generated audit/regression reports. |
| `react-pilot/docs/` | Roadmaps, validation matrices, deployment docs, activity logs, Manta findings. |
| `react-pilot/electron/` | Desktop packaging entry points. |
| `react-pilot/release/` | Built Manta Metadata Desktop artifacts. |
| `pilot-share/` | Published static share build. |
| `manta-chrome-extension/` | Chrome MV3 Manta Pilot Bridge. |
| `mcp/noaa-metadata/` | NOAA metadata MCP for Google Drive/Sheets discovery and extraction. |
| `netlify/functions/` | Root-level Netlify function area. |
| `scripts/` | Root support scripts. |
| `cruisepack_extracted/` | Extracted CruisePack 3.3.2 package. |
| `metadara/` | External metadata validation/reference package set. |

## CruisePack Audit

CruisePack assets found:

- `cruise_pack_v3.3.2-win64.zip`
- `cruisepack_extracted/cruise_pack_v3.3.2-win64/`

Audit finding:

- CruisePack is present and extracted in the workspace.
- The app type system already reserves `cruisepack` as a source provenance value.
- There is not yet a full CruisePack manifest/zip-to-form intake pipeline in the React app.
- Until implemented, CruisePack should be treated as a reference/source-system mapping lane. Current operational intake should use raw ISO/XML zip import, BEDI XML paths, or CoMET pull flows.

Director phrasing:

> I audited CruisePack as a source-system/reference workflow. It is ship/cruise-data oriented and useful for mapping overlaps, but it is not yet wired as a first-class intake adapter.

## metadara / External Validation Packages

Assets found:

- `metadara/`
- `metadara.zip`
- `metadara/InformationBroker-master.zip`
- `metadara/validate-onestop-metadata-master.zip`
- `metadara/tmf-scripts-MCD001_Abiola.zip`
- `metadara/metadata-apps-master.zip`
- `metadara/s2n-master.zip`
- `metadara/s2n-master(1).zip`
- `metadara/oodp-master.zip`
- `metadara/iaf-master.zip`
- `metadara/cs-iaf-master.zip`
- `metadara/iso-metadata-ncei-nc-master.zip`

Related external folders found under Downloads:

- `InformationBroker-master`
- `InformationBroker-master 2`
- `validate-onestop-metadata-master`
- `validate-onestop-metadata-master 2`
- `iso-metadata-ncei-nc-master`
- `iso-metadata-ncei-nc-master 2`
- `iaf-master`
- `iaf-master 2`

Audit use:

- OneStop validation parity.
- ISO 19115-2 corpus and WAF export pattern review.
- InformationBroker/OER architecture comparison.
- IAF accession, WAF, and keyword utility references.
- Rule candidates for SWARM validation lanes.

## GitLab / Team MetaForce Audit

The `metadara/tmf-scripts-MCD001_Abiola.zip` archive contains multiple GitLab-derived metadata automation repos and README fragments referencing Team MetaForce.

References found:

- The archive README states that automated link update scripts and input files were being used by **Team MetaForce**.
- It references a prior GitLab repo: `https://git.ncei.noaa.gov/myranda.uselton/insert-cloud-snippets`.
- It includes a GitLab remote example for `https://git.ncei.noaa.gov/laura.brenskelle/automated-link-updates.git`.
- Multiple README support sections refer users to the Metadata Team, also called **Team MetaForce**.
- The bundle also references Team MetaRex for earlier NODD cloud link snippets.

MetaForce-related capabilities found in the archive:

- Automated NODD/cloud access link updates.
- OSDD link insertion.
- Stable/offline snippet insertion.
- Data licensing / DocuComp resource constraint insertion.
- Decommissioning information updates.
- Gulf of America / Gulf of Mexico keyword updates.
- GOES-19 keyword and cloud link updates.
- Image URL and metadata ID discovery.
- ISO keyword automation.
- XML WAF scraping/downloading.
- XML UUID scraping.
- XML link checking and bad URL report generation.

Audit conclusion:

- The MetaForce artifacts are useful references for batch XML maintenance and targeted link/keyword updates.
- The UxS/Manta workspace is ahead of those lanes in integrated product scope: it combines guided metadata authoring, profile-specific validation, DocuComp/license handling, CoMET preflight/push, OneStop/WAF readiness concepts, scanner intake, SWARM rule compilation, generated QA reports, and deployable UI/API surfaces.
- A precise director-safe statement is: **"I audited the GitLab-derived metadata automation bundles in metadara, including Team MetaForce scripts. Those assets are valuable for batch link, keyword, licensing, and WAF maintenance, but the UxS/Manta workbench is ahead in end-to-end integration because it turns those concepts into one guided, validated authoring and preflight workflow."**

## OER / BEDI / Cruise XML Templates

Representative source templates found in Downloads and repo-adjacent folders:

- `OER_BEDI_Cruise_Level_Template*.xml`
- `OER_EX_Cruise_Level_Template*.xml`
- `OER_EX_Cruise_Level_Template_noDOI*.xml`
- `Project Metadata Documents/old versions/*.xml`
- `oer/bedi_renderer/*.xml`
- `BIOLUM2009_audit_copies_2026-04-30/oer-bedi-cruise-template-20260424.xml`

Audit use:

- OER/BEDI XML shape comparison.
- Cruise-level vs granule/segment modeling.
- DocuComp xlink preservation.
- DOI and no-DOI template variants.
- Contact, graphic, distributor, license, GCMD, and NCEI accession patterns.

## Excel / CSV Source Workbooks

Key workbook and CSV assets:

- `Metadata Placeholders and Script Generation.xlsx`
- `UxS Matrix.xlsx`
- `UxS Matrix - Feild.csv`
- `UxS Matrix - Rules.csv`
- `OneStop Regeneration - Bulk Metadata Records - EX.xlsx`
- `OneStop Regeneration - Bulk Metadata Records - EX (1).xlsx`
- `WAF metadata.xlsx`
- `Okeanos Explorer Cruise Metrics.xlsx`
- `Okeanos Explorer Cruise Metrics - AllOkeanosCruiseMetrics.csv`
- `MISSION_COMPARE_LIST_TEMPLATE.csv`
- `METADATA_ELEMENT_ALIGNMENT.csv`
- `OVERVIEW_TEMPLATE_ALIGNMENT.csv`
- `EX_CRUISE_COLLECTION_UUIDS.csv`
- `EX_CRUISE_COLLECTION_UUIDS_NOTES.md`
- `NOAA_UXS_MIGRATION_TRACKER.csv`

Audit use:

- Excel-to-React `pilotState` mapping.
- Placeholder extraction and crosswalk generation.
- OneStop regeneration status dimensions.
- WAF publication checks.
- Cruise/collection UUID mapping.
- OER required-field logic.
- SWARM rule generation and field-map alignment.

## React Pilot / Manta Workbench

The React pilot is the canonical runtime app in this workspace.

Implemented or audited areas:

- Mission, collection, BEDI collection, and BEDI granule profiles.
- Six-step mission wizard: Mission, Platform, Sensors, Spatial, Keywords, Distribution.
- XML preview and import paths.
- ISO 19115-2 GMI/GMD output.
- BEDI collection/granule XML preview and parsers.
- Manta Ray assistant widget.
- Manta Lens overlay, scanner suggestions, issue tray, inline glass guidance, and fix workflow.
- Readiness modes: lenient, strict, catalog.
- GCMD and ROR enrichment.
- GeoJSON and DCAT JSON-LD export paths.
- CoMET pull, preflight, validation, and draft push workflows.
- Archive, libraries, intake, OER dashboard, OneStop strip, and desktop packaging surfaces.

## Netlify/API Audit

Key functions:

- `react-pilot/netlify/functions/db.mjs`
- `react-pilot/netlify/functions/comet-proxy.mjs`
- `react-pilot/netlify/functions/mission-list-validate.mjs`
- `react-pilot/netlify/functions/oer-query.mjs`
- `react-pilot/netlify/functions/onestop-stats.mjs`
- `react-pilot/netlify/functions/manta-intent.mjs`

Audited behavior:

- Same-origin `POST /api/db` contract with `{ fn, args }`.
- Postgres-backed CRUD paths for platforms, sensors, templates, and validation logs.
- Stateless routes for GeoJSON, DCAT, server validation, and lens scan.
- CoMET session/token handling.
- CoMET validate, resolver, link check, rubric, MetaServer, search, get, and draft push paths.
- CORS and public endpoint risk review.

## CoMET / MetaServer / OneStop / WAF

Audited lanes:

- CoMET ISO pull.
- CoMET search by record group.
- CoMET preflight.
- CoMET draft push.
- Record-services validation.
- Resolver checks.
- Link checks.
- Rubric checks.
- MetaServer validation.
- OneStop UUID/linkage parity.
- WAF publication and regeneration status.

Known access finding:

- CoMET record group access is scoped. Some searches fail unless the session belongs to the target record group.

## SWARM Validation Pipeline

SWARM assets:

- `react-pilot/rules/rule.csv`
- `react-pilot/rules/field_map.csv`
- `react-pilot/rules/rule_conflict_resolution.csv`
- `react-pilot/rules/rule_set_priority.csv`
- `react-pilot/rules/tmf_rule_candidates.csv`
- `react-pilot/schemas/*.schema.json`
- `react-pilot/compiled_rules/*.json`
- `react-pilot/scripts/swarm/*.mjs`
- `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md`

Audited capabilities:

- Source CSV validation.
- Deterministic rule compilation.
- Condition evaluation.
- Field-map coverage checks.
- Rule quality checks.
- TMF candidate import.
- BEDI collection/granule rule expansion.
- OneStop UUID starter checks.
- CoMET regression harness.
- Mission import audit.
- OER required-field lane.
- PASS/CHECK/BLOCK direction for template hygiene, MetaServer, OneStop parity, and DocuComp integrity.

## NOAA Metadata MCP

Path:

- `mcp/noaa-metadata/`

Tools:

- `list_allowed_sources`
- `search_drive_metadata_files`
- `get_drive_file_metadata`
- `extract_metadata_from_file`
- `download_allowed_file_text`
- `summarize_cruisepack_candidates`
- `browser_test_plan_for_catalog_page`

Audit use:

- Read-only Google Drive and Sheets discovery.
- NOAA/OER/UxS/BEDI metadata file extraction.
- CruisePack candidate discovery.
- Controlled allowlist-based search.

## Chrome Extension / Capture Bridge

Path:

- `manta-chrome-extension/`

Audited behavior:

- Captures page text, selected text, XML/source-like text, and dropped files.
- Stores captured payload in Chrome local storage.
- Opens the pilot at `#manta-capture`.
- Sends capture events into the app using same-origin events and `postMessage`.

Audit notes:

- Host permissions are broad.
- `localhost` vs `127.0.0.1` origin mismatch can affect capture delivery.
- Extension is a bridge into Manta, not a NOAA MCP client.

## Legacy Reference Layer

Root legacy files remain useful as XML parity references, not as the canonical runtime shell:

- `Index.html`
- `Scripts.html`
- `SchemaValidator.gs`
- `ValidationSystem.gs`
- `XMLFunctions.html`
- `PlatformFunctions.html`
- `SensorFunctions.html`
- `MapFunctions.html`
- `Utils.html`
- `EnhancedIntegration.gs`
- `ErrorRecovery.gs`

Audit use:

- Legacy HTML/Apps Script parity reference.
- Historical XML generator behavior.
- Field naming bridge to React `pilotState`.
- Validation behavior comparison.

## QA / Reports / Documentation

Important docs and reports:

- `README.md`
- `AGENTS.md`
- `CHANGES_TODOS.md`
- `CHANGELOG.md`
- `PRODUCTION_QA_RUNBOOK.md`
- `PILOT_SHARE_WORKFLOW.md`
- `METADATA_CHECKLIST.txt`
- `METADATA_FIELD_MAP.md`
- `react-pilot/docs/APRIL_2026_ACTIVITY_LOG.md`
- `react-pilot/docs/SUMD_TECHNICAL_REPORT_APRIL_2026.md`
- `react-pilot/docs/MANTA_ROADMAP.md`
- `react-pilot/docs/MANTA_USX_METADATA_CHAT_FINDINGS.md`
- `react-pilot/docs/uxs-v4-excel-pilot-field-map.md`
- `react-pilot/docs/uxs-ncei-placeholder-xlsx-crosswalk.md`
- `react-pilot/docs/uxs-ncei-template-mission-pilot-matrix.md`
- `react-pilot/docs/generated/mission-validation-rules.generated.md`
- `react-pilot/docs/generated/mission-validation-by-field.generated.md`

Generated reports:

- `react-pilot/fixtures/mission/_repo-audit-report.json`
- `react-pilot/fixtures/mission/_regression-report.json`
- `react-pilot/fixtures/mission/_import-audit-report.json`
- `react-pilot/fixtures/mission/_api-coverage-report.json` when generated.

## Batch Engine — MetaForce Parity (Implemented)

The batch engine closes the gap between the React pilot and the MetaForce standalone script lanes. All scripts live under `react-pilot/scripts/batch/` and use a shared XML parsing layer.

### Files

| File | Purpose |
| --- | --- |
| `scripts/batch/_xml.mjs` | Shared engine: XML parse, URL/UUID/image extraction, NODD/OSDD/DocuComp detection, WAF manifest fetch, HTTP link checker, CSV/JSON writers. |
| `scripts/batch/waf-audit.mjs` | WAF scraper + batch link checker. Accepts a live WAF URL or local XML folder. Outputs `bad_url_report.csv`, `all_urls.csv`, `summary.json`. |
| `scripts/batch/uuid-audit.mjs` | UUID integrity + browse graphic image URL audit. Detects missing, malformed, and duplicate UUIDs. Outputs `uuid-audit.csv`, `image-audit.csv`, `uuid-audit.json`. |
| `scripts/batch/nodd-plan.mjs` | NODD/cloud link patch planner. Reads a CSV of UUIDs + NODD URLs, generates insertion previews, optionally applies with `--apply`. |
| `scripts/batch/osdd-plan.mjs` | OSDD link patch planner. Same pattern as NODD planner. |
| `scripts/batch/batch-report.mjs` | Consolidates all batch lanes into one PASS/CHECK/BLOCK dashboard. Outputs `reports/batch-report.json` and `reports/batch-report.md`. |

### npm Scripts

```
npm run batch:waf:audit -- --xml-dir <path>       # WAF scrape + link check
npm run batch:waf:audit -- --url <waf-url>        # Live WAF index scrape
npm run batch:uuid:audit -- --xml-dir <path>      # UUID + image URL audit
npm run batch:nodd:plan -- --csv nodd.csv --xml-dir <path>   # NODD preview
npm run batch:nodd:plan -- --csv nodd.csv --xml-dir <path> --apply   # NODD apply
npm run batch:osdd:plan -- --csv osdd.csv --xml-dir <path>   # OSDD preview
npm run batch:report                              # Consolidated lane dashboard
npm run batch:all                                 # waf-audit + uuid-audit + report
```

### Lane Coverage vs MetaForce

| MetaForce lane | React pilot batch status |
| --- | --- |
| WAF XML scraping | Implemented — `waf-audit.mjs` |
| Batch link checking / bad URL report | Implemented — `waf-audit.mjs` → `bad_url_report.csv` |
| UUID scraping | Implemented — `uuid-audit.mjs` |
| Image URL lookup | Implemented — `uuid-audit.mjs` → `image-audit.csv` |
| NODD / cloud link insertion | Implemented — `nodd-plan.mjs` (preview + apply) |
| OSDD link insertion | Implemented — `osdd-plan.mjs` (preview + apply) |
| DocuComp license insertion | Existing — XML export, validation rules, CoMET preflight |
| Keyword updates | Existing — GCMD facets, KMS search, SWARM rules |

### Live Test Results (against fixture XML, 2026-05-06)

```
══ MANTA BATCH LANE REPORT ══════════════════════════════════
  ✓ xmlCertification       PASS      6 records analysed
  ~ uuidIntegrity          CHECK     valid=4 missing=2 dupes=1
  ~ noddCloudLinks         CHECK     0 NODD URLs in fixtures (expected)
  ✓ osddLinks              PASS      20 OSDD URLs found
  ✓ docucompIntegrity      PASS      20 DocuComp URLs, 8/8 DocuComp images
  ✓ imageUrlIntegrity      PASS      8 browse graphic URLs found
  ~ wafLinkHealth          CHECK     23/45 URLs broken (fixture/test records)
  ~ noddPlan               CHECK     awaiting CSV input
  ~ osddPlan               CHECK     awaiting CSV input
─────────────────────────────────────────────────────────────
  OVERALL: CHECK   (4 PASS / 5 CHECK / 0 BLOCK)
```

The CHECKs reflect fixture/test data conditions (test XML records share UUIDs by design, NODD links are not present in CoMET fixtures). Against production XML the NODD and UUID lanes should resolve to PASS once records are updated.

## Current Gaps / Follow-Up Items

High-priority gaps:

- CruisePack is audited and present, but not yet a first-class intake adapter.
- Send2NCEI is referenced but not wired as an operational publish integration.
- CoMET access depends on record group membership and current session state.
- Some public Netlify endpoints need CORS/auth hardening before broad exposure.
- Extension permissions should be narrowed before general distribution.
- OneStop/WAF regeneration and UUID linkage lanes should be promoted from starter checks to explicit gates after fixture validation.
- EXIF still/video metadata is a known future lane for segment-level capture.

## Certification End Goal

The end goal is not to expose other teams' script names in the product. Those repositories are useful audit/source intelligence, but Manta should present a neutral NOAA metadata certification workflow.

Target product statement:

> Manta becomes a certification workbench for NOAA metadata: it can ingest source records, validate XML, verify DocuComp/license/keyword/link/UUID/image evidence, run CoMET preflight, produce PASS/CHECK/BLOCK readiness lanes, and export an audit pack a director can trust.

What this means in practice:

- **Guided authoring:** users can create or repair metadata through the React pilot instead of editing XML by hand.
- **Certification lanes:** every important operational concern has a named status, not just a generic validation score.
- **Evidence-backed passes:** every PASS should explain what was checked, where it was found, and which XML path or source artifact supports it.
- **Reviewable fixes:** generated changes should produce before/after diffs before any XML is overwritten.
- **Batch coverage:** WAF folders, XML folders, and source spreadsheets can be audited as batches, not one record at a time.
- **Exportable audit pack:** every run can produce CSV/JSON/Markdown evidence for directors, data managers, or submission reviewers.

Target certification lanes:

| Lane | Purpose | Final PASS evidence |
| --- | --- | --- |
| XML Certification | Confirm ISO/XML shape and local schema-oriented rules. | XML exists, strict validation has no blocking errors, optional `xmllint`/CoMET validation evidence attached. |
| CoMET Certification | Confirm operational preflight against CoMET-facing checks. | CoMET validate, resolver, rubric, linkcheck, and MetaServer checks pass. |
| DocuComp Integrity | Confirm license/contact/graphic component references are present and correct. | Valid `data.noaa.gov/docucomp/...` hrefs, known license preset, component-level evidence. |
| Keyword Quality | Confirm discovery keywords are present and controlled. | GCMD facets present, UUIDs or concept links attached, facet types preserved. |
| Link Health | Confirm online resources resolve. | `gmd:URL` and `gmx:Anchor@xlink:href` checked with HTTP/FTP status evidence. |
| UUID Integrity | Confirm root and collection/granule UUID linkage. | `gmi:MI_Metadata@uuid`, collection UUID, parent UUID, and fileIdentifier relationships pass policy. |
| Image URL Integrity | Confirm browse graphics and image URLs are usable. | Browse graphic URL exists, maps to DocuComp/image where required, and resolves. |
| WAF Batch Evidence | Confirm WAF XML can be discovered and audited. | WAF manifest, record count, XML downloads, and lane summaries attached. |
| NODD / OSDD Evidence | Confirm cloud/access snippets are planned or present. | Patch plan or XML evidence for required NODD/OSDD links. |

## Claude Handoff Plan

These tasks are designed to be handed off as separate, bounded work packages. They should use neutral product names in code. Do not use team names or audit-source names in runtime labels, UI strings, generated lane names, or public report headings.

### 1. Neutralize Internal Naming

Goal: remove audit-source naming from code and generated product artifacts.

Tasks:

- Rename `tmf_rule_candidates.csv` to `batch_rule_candidates.csv`.
- Rename `tmf_*` rule IDs to neutral `batch_*` IDs.
- Rename `tmf-candidates` rule set to `batch-candidates`.
- Rename `tmf_scripts` source system to `batch_xml_scripts` or `external_batch_scripts`.
- Update:
  - `react-pilot/rules/rule.csv`
  - `react-pilot/rules/field_map.csv`
  - `react-pilot/rules/rule_set_priority.csv` if needed
  - `react-pilot/scripts/swarm/sync-rules-from-matrices.mjs`
  - `react-pilot/compiled_rules/*.json`
- Regenerate compiled rules with the existing SWARM commands.

Done criteria:

- `rg -n -i "metaforce|tmf"` returns no hits under `react-pilot/src`, `react-pilot/scripts`, `react-pilot/rules`, or `react-pilot/compiled_rules`.
- `npm run swarm:all` passes.
- `npm run verify:pilot` passes.

### 2. Batch WAF Audit CLI

Goal: implement the WAF scraping and link-checking parity lane.

Suggested file:

- `react-pilot/scripts/batch/audit-waf.mjs`

Inputs:

- `--url <waf-url>` for live WAF scrape.
- `--xml-dir <path>` for an existing XML folder.
- `--out <path>` for report output.

Outputs:

- `waf_manifest.json`
- `bad_url_report.csv`
- `link_health.json`
- downloaded XML folder when `--url` is used

Checks:

- Find XML links from WAF HTML pages.
- Extract URLs from:
  - `gmd:URL`
  - `gmx:Anchor@xlink:href`
  - `gmd:graphicOverview`
- Detect:
  - unreachable URLs
  - non-HTTP(S) URLs
  - duplicate URLs
  - DocuComp URLs
  - non-DocuComp URLs

Done criteria:

- Can run against a local XML folder without network.
- Can emit a CSV equivalent to `bad_url_report.csv`.
- Produces a JSON summary Manta can ingest later.

### 3. UUID + Image Evidence CLI

Goal: implement UUID and image URL evidence lanes.

Suggested file:

- `react-pilot/scripts/batch/audit-assets.mjs`

Inputs:

- `--xml-dir <path>`
- optional `--comet-search-json <path>`
- `--out <path>`

Outputs:

- `uuid_report.csv`
- `image_url_report.csv`
- `asset_evidence.json`

Extract:

- root `gmi:MI_Metadata@uuid`
- `gmd:fileIdentifier`
- `gmd:parentIdentifier`
- browse graphic URLs
- DocuComp image URLs
- image filename-to-UUID matches where available

Done criteria:

- Reports missing root UUIDs.
- Reports invalid UUID shape.
- Reports missing browse graphics where profile policy requires them.
- Emits evidence by fileIdentifier.

### 4. NODD / OSDD Patch Planner

Goal: generate reviewable patch plans instead of blindly rewriting XML.

Suggested file:

- `react-pilot/scripts/batch/plan-cloud-links.mjs`

Inputs:

- `--mode nodd|osdd`
- `--csv <path>`
- `--xml-dir <path>`
- `--out <path>`
- optional `--apply`

Outputs:

- `patch_plan.json`
- `patch_plan.csv`
- `before_after_diff.html`
- `fixed_xml/` only when `--apply` is passed

Rules:

- Default mode is plan-only.
- Every planned insertion must include:
  - fileIdentifier
  - target XML path
  - snippet type
  - source row
  - before/after preview

Done criteria:

- Produces patch plans without modifying XML by default.
- `--apply` writes fixed XML to a new folder, never overwrites source XML.

### 5. Certification Evidence Pack Export

Goal: produce a director/reviewer-ready evidence package.

Suggested file:

- `react-pilot/scripts/batch/export-certification-pack.mjs`

Inputs:

- outputs from WAF, asset, NODD/OSDD, CoMET, and XML validation lanes

Output folder:

```text
certification-pack/
  manifest.json
  executive_summary.md
  record_scorecard.csv
  issue_register.csv
  evidence.json
  bad_url_report.csv
  uuid_report.csv
  image_url_report.csv
  patch_plan.csv
  fixed_xml/
  diffs/
```

Done criteria:

- One command produces a portable folder with evidence.
- Executive summary includes counts by PASS/CHECK/BLOCK and top blockers.
- Every issue includes record ID, lane, severity, message, and evidence path.

### 6. Manta Lens Evidence Ingest

Goal: let the UI consume evidence packs and promote CHECK lanes to PASS/BLOCK.

Tasks:

- Add evidence-pack parser to `react-pilot/src/lib`.
- Feed parsed evidence into `computeCertificationBundles`.
- Add UI affordance to import evidence pack JSON.
- In Manta Lens, show:
  - lane status
  - evidence count
  - top blocker
  - field/XML jump target when available

Done criteria:

- WAF, UUID, image, link, and NODD/OSDD lanes no longer remain static CHECK when evidence exists.
- Manta Lens can explain why a lane is PASS, CHECK, or BLOCK.

## CruisePack Code Usage Map

CruisePack is present in the workspace as an artifact, but it is **not currently a live React Pilot intake adapter**.

Current assets:

- `cruise_pack_v3.3.2-win64.zip`
- `cruisepack_extracted/cruise_pack_v3.3.2-win64/`

Current code/documentation references:

| Location | Current use | Runtime impact if CruisePack artifact is broken |
| --- | --- | --- |
| `mcp/noaa-metadata/src/config.js` | Adds `cruisepack` and `cruise pack` to default Google Drive search keywords. | MCP search still runs; fewer/default keyword matches if removed. Does not affect React app runtime. |
| `mcp/noaa-metadata/src/extractors.js` | Treats CruisePack text/name matches as metadata candidate signals. | MCP candidate scoring changes only. Does not affect React app runtime. |
| `mcp/noaa-metadata/src/server.js` | Exposes `summarize_cruisepack_candidates` tool. | Only affects MCP CruisePack candidate search. Does not affect React app runtime. |
| `mcp/noaa-metadata/README.md` | Documents the MCP CruisePack candidate search workflow. | Documentation only. |
| `react-pilot/src/core/registry/types.js` | Reserves `'cruisepack'` in `SourceProvenanceType`. Comment says not implemented. | Type/comment only; no active adapter depends on it. |
| `react-pilot/src/lib/sourceProvenance.js` | Documents CruisePack as future provenance; says no manifest/zip pipeline exists yet. | Comment/helper context only. |
| `react-pilot/src/adapters/sources/RawIsoAdapter.js` | Mentions future CruisePack loaders can share raw import contracts. | Comment only. |
| `react-pilot/src/features/intake/IntakeScreen.jsx` | UI copy says examples include `CruisePack JSON`. | Display text only. No parsing path. |
| `react-pilot/src/testing/manta-profile-wizard/*` | Test/demo intake copy and keyword pattern include `cruisepack`. | Test/demo classifier only. |
| `react-pilot/docs/MANTA_ROADMAP.md` | Lists CruisePack intake as a future workflow pack. | Documentation/backlog only. |
| `react-pilot/docs/MANTA_USX_METADATA_CHAT_FINDINGS.md` | Calls CruisePack a product gap / future span. | Documentation/backlog only. |
| `CHANGES_TODOS.md` | Notes CruisePack XML can help mapping but differs from UxS XML. | Planning note only. |

Conclusion:

- If you "broke CruisePack" by damaging the extracted `cruisepack_extracted/` folder or zip, the current React pilot should still build and run.
- The only active functional area that mentions CruisePack is the NOAA MCP search/summarization tool.
- There is no current code path that parses CruisePack output into `pilotState`.
- The future implementation should be a dedicated adapter, probably named `CruisePackAdapter`, that maps manifest/checksum/inventory/cruise XML fields into the existing scanner/provenance contract.

Recommended future CruisePack adapter shape:

```text
CruisePack package / XML / JSON
        ↓
CruisePackAdapter
        ↓
ScannerSuggestionEnvelope or profile partial state
        ↓
Manta review/merge
        ↓
Validation + certification lanes
```

Minimum first version:

- Accept CruisePack XML or exported JSON.
- Extract cruise ID, title, dates, ship/platform, chief scientist/contact, bbox, instruments, files/checksums if present.
- Generate scanner suggestions instead of directly mutating state.
- Stamp source provenance as `cruisepack`.
- Let users accept/reject fields in Manta before merge.

## Demo Talking Point

Use this concise version:

> The audit covered the full UxS metadata ecosystem, not just the React repo. I reviewed `uxs-metadata-generator`, the React pilot, Manta Lens, Netlify APIs, CoMET workflows, SWARM validation rules, NOAA MCP tooling, the Chrome capture bridge, CruisePack 3.3.2, metadara validation packages, OneStop/WAF/InformationBroker references, OER/BEDI cruise XML templates, UxS and NCEI Excel workbooks, GCMD/ROR enrichment, DocuComp xlinks, and QA/regression outputs. The main finding is that we have a strong validated metadata workbench now, with CruisePack and some external source packages audited as reference/input lanes but not yet fully implemented as first-class intake adapters.
