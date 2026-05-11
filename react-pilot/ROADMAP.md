# Manta UxS Metadata Workbench — Roadmap

**Owner:** Connor Cayson / NCEI Ocean Exploration & Research  
**Last updated:** May 2026  
**Goal:** Make Manta the standard metadata workbench for NOAA UxS, OER, and NCEI workflows.

---

## Current State (May 2026)

| Capability | Status |
|---|---|
| Multi-profile wizard (Mission, Collection, BEDI Collection, BEDI Granule) | Live |
| SWARM validation engine — 152 compiled rules, lenient/strict/catalog | Live |
| Manta Lens — issue tray, inline guidance, auto-fix | Live |
| CoMET round-trip — pull, preflight, validate, resolver, linkcheck, rubric, draft push | Live |
| DocuComp integration — license presets, xlink preservation, validation | Live |
| GCMD / ROR / DOI authority lookups | Live |
| ISO 19115-2 XML, GeoJSON, DCAT export | Live |
| Netlify deployment — 7 API functions | Live |
| Batch engine — WAF audit, UUID audit, NODD/OSDD plan, lane report | Live |
| SUMD-aware intake classifier | Live |
| Archive inventory with 8 demo records, click-to-load | Live |
| OER Pipeline Dashboard | Live |
| OneStop / DocuComp / WAF readiness bundles in ReadinessStrip | Live |
| NOFO Closeout lane | Active (basic routing) |
| CruisePack intake adapter | Planned |
| OneStop API parity checks | In progress |
| Production QA runbook | In progress |
| Dashboard live PASS/BLOCK/READY status | Next |

---

## Phase 1 — Demo & Stabilization (May 2026)

**Target:** UxS stakeholder demo + April report submission

- [x] Rebrand to Manta UxS — NOAA ocean teal theme
- [x] Nav: Command Center, Start Record, Records Archive, Libraries
- [x] NOFO Closeout activated (removed "coming soon")
- [x] OneStop + DocuComp + WAF named readiness lanes in ReadinessStrip
- [ ] Dashboard live status — wire batch report output to Command Center
- [ ] UxS demo: GOOD/BAD record side-by-side with validation walkthrough
- [ ] Production QA runbook pass (Apps Script deployed tool)

---

## Phase 2 — Operational Shell (June 2026)

**Target:** Director-presentable, ops-ready workbench

### 2a — Command Center dashboard
- Real record status per lane: Draft / Blocked / Ready / Pushed
- Feeds from: batch report JSON, CoMET preflight results, SWARM validation
- Table view: cruise/record ID | profile | readiness % | blockers | last CoMET run | status
- Export: quarterly report CSV

### 2b — OneStop readiness as a real validation lane
- GCMD keyword parity check (required facets present)
- UUID linkage check (root UUID, parentIdentifier, fileIdentifier shape)
- WAF registration status
- Link health (from batch:waf:audit)
- PASS/CHECK/BLOCK output into readiness strip

### 2c — NOFO Closeout lane (full)
- PI materials intake (PDF, report, DISP)
- Package review checklist
- Metadata readiness output
- Archive/discovery handoff

### 2d — Production QA
- Complete PRODUCTION_QA_RUNBOOK.md pass
- Template load/save round-trip
- XML import validation
- Platform/sensor upserts
- ROR/GCMD live paths
- GeoJSON/DCAT export parity
- Rollback guidance and deployment prerequisites documented

---

## Phase 3 — BEDI / OER Hardening (July 2026)

**Target:** BEDI pipeline fully automated from CSV to CoMET-ready bundle

- BEDI Collection and Granule profiles hardened against BIOLUM2009, ODS2007, ETTA2004
- Batch engine integrated into BEDI generation loop (replace link_resolver.py, OSIM passes)
- InfoBroker live query wired to OER Pipeline Dashboard
- BIOLUM2009 production-alignment deltas closed (title, abstract, FileIdentifier, ParentIdentifier, vertical extent)
- ODS2007 and ETTA2004 mapped to same conventions
- WoRMS taxonomy lookup wired into BEDI granule profile
- Broker-connected bedi_videos read confirmed vs CSV export parity

---

## Phase 4 — UxS Reference Implementation (August 2026)

**Target:** Manta as the named reference implementation for NCEI + Navy UxS metadata

- UxS profile hardened against NCEI/Navy beta template (March 2026 version)
- CruisePack intake adapter (manifest/checksum/inventory → pilotState fragments)
- Multi-platform UxS mission support (AUV, UUV, USV, ROV)
- Segment/dive-level sub-record support
- UxS-specific validation lanes (platform ID, dive log linkage, sensor model)
- Submission to NCEI + Navy CNMOC feedback channel

---

## Phase 5 — DigiCat / Archive Inventory (September 2026)

**Target:** Manta as metadata + archive visibility workbench

- DigiCat JSON ingest → flatten archive contents → searchable file inventory
- Link DigiCat records to metadata records by UUID/fileIdentifier
- Browse graphic / image URL audit across archive
- Send2NCEI / ATRAC handoff lane
- Archive inventory lane in left nav: file → metadata → CoMET → archive

---

## Phase 6 — AI-Assisted Reconstruction Engine (Q4 2026)

**Target:** Manta as a metadata reconstruction platform, not just an editor

This is the "Reverse Paper Shredder" architecture:

- Fragment-based extraction from any messy input (broken XML, PDFs, spreadsheets, CoMET exports)
- Evidence priority ladder (on-prod-record > comet-pull > template-token > csv-mapped > llm-suggestion)
- Entity fingerprinting for identity resolution across conflicting sources
- Canonical graph model (Cruise / Platform / Segment / Docucomp entities with edges)
- Conflict review queue — accept/reject/edit per field with provenance
- Phased LLM-assisted extraction (suggestions only, lowest priority, never auto-lock)
- NCEI cloud/AI alignment story

**Phase 6a (MVP):** BEDI Collection slice only — BIOLUM2009 oracle test
**Phase 6b:** BEDI Granule + parent linkage
**Phase 6c:** Mission + CruisePack
**Phase 6d:** Full reconstruction pipeline UI in Manta

---

## Pilot Cut (Director Pitch)

**Pilot 1 — Mission/PED + NOFO (Phase 1–2)**
> Most accessible for OER leadership. Mission metadata plus grant closeout in one workbench.

**Pilot 2 — BEDI/OER (Phase 3)**
> Targets the 1.4M+ DSCRTP/benthic records running on Excel-by-email today.

**Pilot 3 — UxS Reference Implementation (Phase 4)**
> Time-sensitive — no tool has claimed reference-implementation status for the March 2026 NCEI/Navy UxS beta template.

---

## Strategic Positioning

| Opportunity | Status | Urgency |
|---|---|---|
| UxS metadata reference implementation | Phase 4 target | High — 2026 window |
| DSCRTP / BEDI benthic pipeline modernization | Phase 3 target | Medium — production-ready path exists |
| OSTP Nelson Memo PID compliance (ROR + ORCID + DOI) | Already built | Mandate — 2027 deadline |
| NCEI cloud migration alignment | Built browser-native from day 1 | Ongoing |
| NCEI AI/automation investment | Phase 6 — Reverse Paper Shredder | Long-term positioning |

---

## What Not To Build Yet

- Do not add more random intake sources until Command Center dashboard is real
- Do not expose LLM extraction until evidence ladder and review queue are built
- Do not build DigiCat until BEDI/OER pipeline is hardened
- Do not expand UxS profile until CruisePack adapter spec is finalized
- Do not deploy prod until QA runbook pass is complete and security posture is defined
