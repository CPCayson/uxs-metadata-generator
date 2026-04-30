# UxS Tag-Up Notes

## Context (Andrew Evans sync)
- Team still needs a storyboard for UxS mission/collection/segment flows.
- Main blocker is not technical only: each group models metadata differently.
- "Collection" is overloaded (project-level grouping vs archive grouping of missions).
- EXIF-style image/video metadata is a known gap in current capture flow.
- MDBC sample workflows are tightly coupled to an Access-based at-sea system.

## Confirmed constraints
- Accession IDs are assigned only after package submission and DCM review.
- CruisePack XML can help mapping but is ship-data-oriented and differs from UxS XML.

## Links (working set)
- Web MANTAS (for tag-up notes): `ADD_WEB_MANTAS_URL_HERE`
- Mapping sheet: https://docs.google.com/spreadsheets/d/1ZgfzeseDQcy75klWLfAieAiLWPJ2Xq-9MpXrWSwZkhc/edit?usp=sharing
- CruisePack download: https://www.ngdc.noaa.gov/mgg/cruisepack/cruise_pack_v3.3.2-win64.zip
- GIS matrix note: `/Users/connorcayson/Downloads/UxS Matrix.xlsx`

## Action items
- Finalize storyboard terminology for `mission`, `collection`, and `segment`.
- Add explicit post-ingest accession-ID lifecycle step in UI/docs.
- Prototype EXIF capture path for image/video segment metadata.
- Review OneStop + WAF harvesting paths for additional structured fields.
- Compare CruisePack XML fields to UxS mission schema and log only reusable overlaps.

Note: the matrix is directionally useful but not perfect yet.

## How `metadara` can help now
- `validate-onestop-metadata-master.zip` includes concrete collection/granule checks we can mirror in pilot validation:
  - title required
  - exactly one `fileIdentifier`
  - granules should carry `parentIdentifier`; collections should not
- `iso-metadata-ncei-nc-master.zip` contains a large ISO 19115-2 corpus and WAF export artifacts (good for mining real-world field patterns and edge cases).
- `iaf-master.zip` has accession and template utilities that can inform our post-submission accession workflow notes (without assuming accession exists pre-review).
- `InformationBroker-master.zip` includes API/architecture docs that can tighten OER/InfoBroker mapping assumptions.

## Suggested next extraction pass
- Build a small rule parity sheet: current mission checks vs OneStop checks (title, fileIdentifier cardinality, parentIdentifier logic).
- Sample 50 ISO records from the `iso-19115-2` corpus and log recurring mission vs segment/granule discriminator fields.
- Add an explicit "accession assigned after DCM review" status stage in storyboard and UI copy.

## Mission spotless scope (DocuComp + other two lanes)
- Lane 1 — DocuComp/component integrity:
  - verify XLink/component references resolve
  - fail if parent looks valid but required component payload is invalid or missing
  - surface component-level errors in preflight summary (not just parent record status)
- Lane 2 — MetaServer validation:
  - run legacy `isovalidatecheck` as an explicit gate in the CoMET panel
  - classify response into pass/check/fail with actionable messaging
- Lane 3 — OneStop parity checks:
  - enforce `title`, single `fileIdentifier`, and collection vs granule `parentIdentifier` rules
  - keep mission/collection/segment mapping consistent with storyboard terms

## Definition of "mission spotless"
- No blocking errors in CoMET validate, link check, rubric, MetaServer validate, or component checks.
- Required identifiers/cardinality constraints pass (`fileIdentifier`, parent-child linkage).
- OneStop parity rules pass for the chosen record type (collection vs granule/segment).

## DocuComp status vs Send2NCEI gaps
- DocuComp status (implemented): mission/BEDI forms, XML preview/export, and import parsing already support docucomp xlinks and related license/contact patterns.
- Send2NCEI status (gap): no first-class Send2NCEI client/service flow is currently wired in main `react-pilot/src` app paths.
- Send2NCEI current presence: mostly comments/test fixtures (references to Send2NCEI/ATRAC behavior and routing), not an operational publish integration.
- Priority recommendation: add explicit Send2NCEI adapter with pull status + push handoff checks so CoMET and Send2NCEI can be validated as parallel publication lanes.
- Spotless mission implication: mission cannot be marked "spotless" until DocuComp/component checks and the selected publication lane (CoMET or Send2NCEI) both pass.

## Swarm execution board (v1 workbench)
- [ ] SWARM-A: validate source rule CSVs against schema and strict enum checks.
- [ ] SWARM-B: compile deterministic rule bundles with trace and conflict resolution.
- [ ] SWARM-C: evaluate `condition_expr` for conditional rules with explain output.
- [ ] SWARM-D: enforce field-map coverage for block/required rules.
- [ ] SWARM-E: add golden bad-XML fixtures with expected issue IDs.
- [ ] SWARM-F: wire compiled bundles into workbench validation lanes.
- [ ] Gate `PASS/CHECK/BLOCK` on compiled lane outputs (template hygiene, MetaServer, OneStop parity, DocuComp integrity).

### Swarm artifacts now in repo
- Board: `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md`
- Schemas: `react-pilot/schemas/*.schema.json`
- Rule sources: `react-pilot/rules/*.csv`
- Compiler/QA scripts:
  - `react-pilot/scripts/swarm/validate-rules-csv.mjs`
  - `react-pilot/scripts/swarm/compile-rules.mjs`
  - `react-pilot/scripts/swarm/check-rules-quality.mjs`
  - `react-pilot/scripts/swarm/evaluate-condition.mjs`
- NPM commands:
  - `npm run swarm:validate`
  - `npm run swarm:compile`
  - `npm run swarm:qa`
  - `npm run swarm:all`

## Andy demo one-pager (today)

### Green (implemented and demo-ready)
| Field area | Current mapping status | Evidence |
|---|---|---|
| Core IDs and citation spine | Implemented (`fileIdentifier`, DOI, accession, metadata ID) | Swarm compile/QA passes; mission/collection/granule bundles compile clean |
| Core descriptive metadata | Implemented (`title`, `abstract`, `purpose`) | Mission template and app mappings are active in wizard/export paths |
| Spatial + temporal extents | Implemented (`bbox`, `start/end`) | `EX_GeographicBoundingBox` and temporal extent emitted by generator |
| Distribution essentials | Implemented (`format`, landing URL, download URL) | Transfer options and distributor format emitted in output XML |
| Platform/instrument baseline | Implemented | Acquisition/platform/sensor mappings active in profile flows |
| In-app validation process | Implemented | CoMET validation loop panel now visible in workbench dashboard |

### Yellow (implemented, hardening in progress)
| Field area | Gap / risk | Action in progress |
|---|---|---|
| `dateStamp` precedence | User confusion about metadata record date vs mission dates | Document precedence and make UI hint explicit |
| Citation date variants | Completion/revision expectations differ by source sheets | Tighten UX labels + validation messaging |
| GCMD keyword strictness | Controlled vocab/type code drift possible | Promote stricter keyword scheme checks |
| Aggregation richness | Parent/related/publication parties lighter than full template | Expand mapping richness where source data exists |
| Content variable detail | Thin when optional sensor fields are blank | Add prompts/rules for variable completeness |

### Red (publish gate priorities)
| Gate | Why it matters | Required pass condition |
|---|---|---|

| License constraint consistency | Validator sensitivity to ordering and block form | Valid license preset selected and emitted in expected constraint structure |
| CoMET roundtrip acceptance | Operational truth over structural-only checks | Import accepted by CoMET and pulled back out as XML |
| Structural vs completeness clarity | Structural pass can hide business completeness gaps | PASS label only after structural + completeness + lane gates pass |

### One-line status for Andy
- We have end-to-end mapping and in-app validation operational now; today’s final hard gates are license-constraint consistency and CoMET roundtrip acceptance.

## MANTAS historical thread notes (consolidated)

### What was decided (important)
- Default direction shifted to ISO 19115-2 (GMI/GMD) for NOAA/NCEI operational compatibility; ISO 19115-3 remained useful but non-primary.
- CoMET converter/interop path was explicitly preferred for supportability over a fully custom transform-only path.
- Public accessibility outside NOAA boundary was repeatedly requested (NGI/MSU or equivalent host), with NOAA pickup later as possible.
- Shared cross-org platform/sensor library was preferred over user-isolated catalogs.
- Metadata correctness beats UI polish ("dead on arrival" risk if metadata quality fails).

### Recurring failures observed in legacy flow
- Deployment/link churn (many Apps Script URLs), causing confusion on "latest" and test target.
- Conversion UX ambiguity (button vs dropdown behavior) leading to operator errors.
- Namespace regressions (duplicate namespace declarations, missing root namespace blocks).
- Sensor/platform serialization regressions (values entered but not emitted, or ID/type swapped).
- Map preview issues introducing noise vs core metadata priorities.
- Example data leakage risk (real phone numbers in sample content).

### Requirements repeatedly requested by Andy/Jason
- Required-field parity with NCEI/AMS/DCM expectations.
- GCMD keyword handling by separate facets (science/place/platform/instrument/project/datacenter), not one opaque selector.
- Licensing statements as selectable presets with docucomp-backed options and clear guidance.
- ORCID linkage for people and ROR linkage for organizations.
- Better metadata completeness checks (not structural validation only).
- Stable demo-ready versions and deterministic release behavior.

### System-level context from forwarded emails
- NCCF/CMR memo implies external catalog roles are shifting; builder should remain decoupled from any single catalog backend.
- DigiCat model is archive-centric and high-scale; integration should likely use indexed/flattened access patterns for file-level workflows.
- TugBoat example reinforces that non-NOAA-hosted interfaces are feasible for wider access.
- EXIF still/video metadata should be treated as a first-class ingest lane (camera/time/exposure/device descriptors).

### Current "fix now" priorities (execution)
- P0: keep one canonical app link/version target and remove ambiguous controls.
- P0: enforce license preset validation and predictable constraint ordering in output.
- P0: enforce CoMET roundtrip pass gate (import + pull-back) before calling a record pass-ready.
- P1: harden GCMD facet UX and mapping confidence checks.
- P1: add EXIF ingest-to-field mapping subset and preflight checks.
- P1: add completeness QA lane that complements structural/XSD checks.

### Action tracker (owner + date)
| Priority | Task | Owner | Due | Status | Done criteria |
|---|---|---|---|---|---|
| P0 | Canonical app link and release target | Connor | 2026-04-30 | In progress | One promoted link in docs + UI footer; old links marked deprecated |
| P0 | License preset ordering + validation gate | Connor | 2026-04-30 | In progress | Missing/invalid preset blocks pass; valid preset renders deterministic constraint order |
| P0 | CoMET roundtrip gate | Connor | 2026-04-30 | In progress | Regression run shows import + pull-back success for fixture set |
| P1 | GCMD facet hardening | Connor + Andy | 2026-05-02 | Pending | Separate facet UX + scheme/type checks pass QA |
| P1 | EXIF lane MVP | Connor | 2026-05-02 | Pending | EXIF subset mapped and validated pre-push in workbench |
| P1 | Completeness QA lane | Connor + Jason | 2026-05-03 | Pending | Completeness score/checklist added beyond structural checks |

## Work log (current session, while waiting)

### Completed in this session
- Expanded swarm sync to include BEDI core collection/granule rules and regenerated compiled bundles.
- Added OneStop UUID starter checks (collection/granule parent linkage fields) and runtime `pattern_regex` enforcement.
- Added CoMET regression utilities:
  - `scripts/swarm/pull-comet-xml-fixtures.mjs`
  - `scripts/swarm/regress-mission-validity.mjs`
- Added npm scripts for repeatable loops:
  - `swarm:pull:comet`
  - `swarm:regress`
  - `swarm:regress:roundtrip`
  - `swarm:api:coverage`
  - `swarm:loop`
- Added CoMET API coverage harness:
  - `scripts/swarm/check-comet-api-coverage.mjs`
  - Runs record-services checks (`isoValidate`, `rubricV2`, `resolver`, `linkcheck`) against fixture XML.
  - Optional lanes for `metadata/search` (with `recordGroup`), `metadata/get+validate` (with `uuid`), and legacy `metaservValidate`.
- Extended `netlify/functions/comet-proxy.mjs` with `action=search` for `metadata/search` passthrough.
- Improved CoMET auth/token flow:
  - Added request-header session override support in proxy (`X-Comet-JSessionId`, `X-Metaserver-JSessionId`) with fallback to env vars.
  - Added `action=sessionStatus` endpoint in proxy to report token availability and source (`header` vs `env`).
  - Added explicit 401 errors on auth-required actions when no session token is available.
  - Added in-app CoMET auth controls in `CometPushPanel` (login CoMET/MetaServer, check token, clear token).
  - Client now stores fetched sessions locally and auto-attaches them to proxy requests.
- Swarmed NCEI "Creating Metadata" core fields into regression harness:
  - `scripts/swarm/regress-mission-validity.mjs` now runs `nceiCore` checks per XML fixture.
  - Blocking checks: title, abstract, bbox, temporal begin, citation identifier, cited responsible party.
  - Advisory checks: descriptive keywords and data license detectability.
  - File PASS now requires both template hygiene pass and zero `nceiCore.block` issues.
- Added CoMET similarity search utility:
  - `scripts/swarm/search-comet-similar.mjs`
  - Searches CoMET `metadata/search` by record group and ranks likely-similar records using `fileIdentifier`, `name`, and UUID text similarity.
  - Writes JSON report to `fixtures/mission/_comet-search-results.json` and top UUIDs to `fixtures/mission/comet-uuids.txt`.
  - Added npm script: `swarm:search:comet`.
- Audit fix pass (security + reliability):
  - Switched CoMET auth token storage from `localStorage` to short-lived `sessionStorage` with TTL in `src/lib/cometClient.js`.
  - Tightened proxy CORS behavior in `netlify/functions/comet-proxy.mjs` to allowlist origins (`COMET_PROXY_ALLOWED_ORIGINS`, localhost defaults).
  - Hardened regression semantic checks in `scripts/swarm/regress-mission-validity.mjs`:
    - `isoValidate` now requires parsed `error_count === 0`.
    - `metaservValidate` now uses success/failure text semantics, not HTTP status alone.
  - Fixed MetaServer pass/fail parsing in `src/profiles/mission/useMissionCometActions.js` to treat `0 errors` as pass signal.
  - Updated `swarm:loop` to include `swarm:api:coverage` in `package.json`.
- Added OER DB required-fields lane from `MinFieldsNeeded` workbook semantics:
  - New `oerDbRequired` block in regression output with rule IDs (e.g., `oer_req_cruisename`, `oer_req_keywords_theme`, `oer_req_bbox`, `oer_req_divebegin`).
  - `publishReadiness` now blocks on `oer_db_required` when these requirements fail.
  - Output now includes actionable `ruleId + message` pairs for each failed required field.
- Added TMF-derived swarm rule candidate import draft:
  - `react-pilot/rules/tmf_rule_candidates.csv`
  - Captures reusable candidates from TMF automation scripts for:
    - UUID/fileIdentifier mapping
    - link extraction/checking (`gmd:URL`, `gmx:Anchor@xlink:href`)
    - Docucomp data licensing constraints
    - GCMD keyword presence/anchor enrichment
    - image URL/metadata ID mapping support
  - Marked domain-specific or campaign-specific checks as `warn/recommended` pending profile policy promotion.
- Wired TMF candidates into live sync flow:
  - Updated `react-pilot/scripts/swarm/sync-rules-from-matrices.mjs` to auto-read `rules/tmf_rule_candidates.csv` when present.
  - `swarm:sync` now promotes each candidate into `rules/rule.csv` with:
    - `rule_set=tmf-candidates`
    - `pattern_regex` support for `rule_type=pattern`
    - `condition_expr` support for `rule_type=condition`
  - Added TMF map-row generation into `rules/field_map.csv` with `source_system=tmf_scripts`.
  - Verified end-to-end pipeline:
    - `npm run swarm:sync`
    - `npm run swarm:validate`
    - `npm run swarm:compile`
    - `npm run swarm:qa`
  - Current compile status after TMF wiring:
    - mission: compiled clean
    - granule: compiled clean
    - collection: one unresolved tie warning remains (non-blocking, pre-existing class)
- Swarm import audit (Mission form parity after XML load):
  - `scripts/swarm/audit-mission-import.mjs` — import → merge → validate (lenient/strict/catalog); `byStep` + `fixChecklist` for wizard steps 1–6.
  - `npm run swarm:audit:import` (default: Navy UxS template at repo root if present; override with `--xml`).
  - Report: `fixtures/mission/_import-audit-report.json`.
- Added workbench in-app CoMET validation playbook panel in `OERPipelineDashboard`.
- Upgraded playbook panel to interactive checklist with local persistence + progress meter + reset.
- Added/updated mission ops notes and Andy-ready summary sections in this document.
- Added consolidated MANTAS historical thread notes with decisions, recurring failures, and prioritized fixes.
- Added owner/date execution tracker and done criteria.

### Validation and build results
- `npm run swarm:all` passes after BEDI and conflict updates.
- `npm run build` passes after dashboard/playbook updates.
- Lints checked on edited files; no new linter errors.

### CoMET API work completed
- Session cookie tested and API auth confirmed working.
- Verified `metadata/search` endpoint behavior and required `recordGroup` semantics.
- Confirmed wildcard/group-bypass values are rejected by API.
- Enumerated visible record groups from current API session:
  - `connor.cayson@noaa.gov | Personal Repository`
  - `Manta`
- Successfully queried and pulled one accessible record:
  - UUID: `9f21ce1a-1e11-4461-bc84-81939f73cfc2`
  - Saved XML fixture to `react-pilot/fixtures/mission/9f21ce1a-1e11-4461-bc84-81939f73cfc2.xml`
- Ran regression report:
  - `react-pilot/fixtures/mission/_regression-report.json`
  - pulled record currently flagged for unresolved placeholder hygiene.

### Current blocker and wait state
- API search by external record groups is access-scoped; endpoint returns:
  - `"The current user does not belong to this record group."`
- Next immediate unblock:
  - exact record group string that is currently selected in UI for target records, or
  - shared group membership / session with access to Andy-target repository.

### Ready-to-run next command once unblocked
- Search + pull by record group and fileIdentifier via CoMET API, then regenerate fixtures and regression report.

## OneStop swarm audit (targeted)

Reference repo reviewed for architecture fit: [cedardevs/onestop](https://github.com/cedardevs/onestop)

### Why this matters for MANTAS swarm
- OneStop is event-driven and ingest/search oriented; our swarm should validate not just XML structure but ingest-ready identity/linkage semantics.
- OneStop supports ISO 19115 ingestion and distributed indexing; this matches our need to gate records before publish handoff.
- Their stack shape (parser/analyzer/index/search services) reinforces our lane model: parse -> validate -> transform -> index readiness.

### Current alignment (good)
- CoMET record-services lane already covers schema/resolve/link/rubric checks.
- Swarm rules now include starter UUID pattern checks for collection/granule linkage.
- Regression harness supports repeat runs and report artifacts.

### Gaps to close (priority)
- P0: Promote OneStop UUID linkage from starter warnings to enforceable profile gates once confirmed by fixture outcomes.
- P0: Add OneStop ingest-readiness lane output in regression report (explicit PASS/CHECK/BLOCK reason code).
- P1: Add field-level parity checks for identifiers used by search/index entities (collection vs granule lineage integrity).
- P1: Add drift tracker: if recurring OneStop/CoMET mismatch appears, auto-open rule-candidate entry.

### Swarm audit acceptance criteria
- 10-record fixture run produces deterministic lane-level verdicts including OneStop-ready status.
- Any UUID/linkage failure is surfaced with exact field key + failing regex/rule id.
- Roundtrip + OneStop lanes both green before record is marked publish-ready.

## External artifact audit (new)

### 1) `ncei_oer_full_pipeline.svg` (operational workflow map)
- Confirms pipeline is multi-lane and parallel (geophysical, ROV video, documents) with distinct ingest/QA/archive checkpoints.
- Explicitly shows critical operational nodes we should model in swarm lanes:
  - security/pre-ingest split
  - metadata generation/enrichment
  - archive storage + WAF
  - GeoPortal/OneStop publication surfaces
- Swarm implication:
  - keep lane-specific PASS/CHECK/BLOCK outputs rather than one generic validator result.
  - retain collection-level + granular-level dual checks (already consistent with current direction).

### 2) `OneStop Regeneration - Bulk Metadata Records - EX (1).xlsx`
- Task sheet confirms priority order: granular/segment-first regeneration; collection-level updates may lag due to DOI/PID timing.
- Cruise list tab provides concrete status dimensions we should mirror in reports:
  - on-prem DB presence
  - collection-level up-to-date
  - collection-level on OneStop WAF
  - segment-level up-to-date
  - segment-level on OneStop WAF
- On-prem DB audit tab provides reconciliation signal (`Missing from DB` counts per cruise).
- Swarm implication:
  - add a regeneration status lane with these exact dimensions to avoid ambiguity during EX batch runs.
  - prioritize segment/granule pass gates before collection promotion.

### 3) `GCMD Keywords.xlsx`
- Contains GCMD controlled vocab exports by facet:
  - Earth Science (theme), Platforms, Instruments, Locations, Providers, Projects
- Includes UUIDs + keyword viewer links and explicitly formatted “ISO keyword string” columns.
- Swarm implication:
  - enforce facet-aware keyword checks (not just “has keywords”).
  - require canonical facet string format per sheet conventions.
  - add advisory/strict mode for UUID-backed keyword lineage where available.

### Immediate implementation targets from this audit
- P0: Add `oneStopRegeneration` report block in regression output:
  - `collectionUpToDate`, `collectionOnWaf`, `segmentUpToDate`, `segmentOnWaf`, `onPremDbParity`.
- P0: Add GCMD facet completeness checks in `nceiCore`/advisory:
  - theme + platform + instrument + place at minimum for OER mission/granule records.
- P1: Add cruise-level reconciliation ingest (from spreadsheet) to emit drift flags when CLASS/on-prem counts diverge.
