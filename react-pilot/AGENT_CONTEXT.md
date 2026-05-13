# Manta Lens — AI Agent Context File

Drop this file in `react-pilot/` root. Every AI call (Gemini, Claude, or any future LLM) in this codebase should load this file as system context before doing anything. Cursor can load it via workspace rules; pass it explicitly to Gemini via `/api/manta-intent` or any new agent endpoint.

**Last updated:** May 2026

---

## What this app is

**Manta Lens** is a metadata reconstruction engine for NOAA / OER. It takes messy metadata inputs — broken ISO XML, BEDI templates, expired tokens, CSV exports, CoMET pulls, freeform text — and rebuilds them into clean, validated, hierarchical ISO 19115-2 records (Mission, Collection, Granule) with full provenance for every value.

The UI surface is a multi-step wizard (Mission → Platform → Sensors → Spatial → Keywords → Distribution). The wizard is one output surface among several — not the core engine.

The internal name for the reconstruction engine is the **Reverse Paper Shredder**.

| Item | Detail |
|------|--------|
| Primary codebase | `react-pilot/` |
| Live app | https://symphonious-sunshine-843275.netlify.app |
| Backend | Netlify functions (`netlify/functions/`) + Netlify DB |
| CoMET proxy | `/api/comet-proxy` |
| Validation standard | ISO 19115-2, validated against https://data.noaa.gov/resources/iso19139/schema.xsd |

---

## The people involved

| Person | Role |
|--------|------|
| **Connor Cayson** | Solo developer, NOAA affiliate contractor at NCEI/Stennis |
| **Jason Weick** | NOAA metadata specialist, primary end-user tester; validates in Oxygen against NOAA XSD; confirms CoMET-readiness |
| **Andrew Evans** | NOAA federal; product direction; metadata standards authority |
| **Charlie Burris** | CoMET developer |
| **Megan Cromwell** | ACDO for NOS; expressed interest in broader distribution |

---

## The three validation tiers

Every AI agent must understand these tiers. **Do not conflate them.**

| Tier | Name | Engine | What it checks |
|------|------|--------|----------------|
| **1** | Well-formed | Browser `DOMParser` | Open/closed tags only |
| **2** | Strict XSD | `xmllint-wasm` + ~72 local XSD files | ISO 19139 schema structure |
| **3** | Production ready | CoMET API (`isoValidate` + rubric) | NOAA business rules — Jason’s “valid → can publish” |

Tiers 1–3 all validate **`buildXmlPreview(pilotState)`** output — the live XML the app generates from internal state. They do **not** validate uploaded files directly.

---

## The Reverse Paper Shredder architecture

### Five layers

1. **Layer 1 — Sources** — One parser per input type; emits fragments only.
2. **Layer 2 — Fragments** — Evidence-tagged field values (the contract).
3. **Layer 3 — Identity** — Fingerprinting; matches records across sources.
4. **Layer 4 — Canonical** — Entity graph: Cruise / Platform / Segment / Docucomp.
5. **Layer 5 — Renderers** — Canonical → ISO XML, with export policies.

### The evidence ladder (HIGHEST to LOWEST trust)

This is a **fixed enum**, not a float. Do not invent new levels. Priority is deterministic — higher evidence always wins in reconciliation.

1. `user-confirmed` — User explicitly accepted this value  
2. `on-prod-record` — Pulled from a published OneStop / production record  
3. `comet-pull` — Retrieved from CoMET via record services  
4. `iso-xpath-exact` — Parsed from structurally valid ISO XPath (clean import)  
5. `iso-xpath-recovered` — Parsed from broken XML using a fallback rule  
6. `template-token-resolved` — Resolved from a template placeholder against context  
7. `cruisepack-json` — Read from a CruisePack manifest field  
8. `csv-column-mapped` — Mapped from a CSV / DB column  
9. `scanner-structured` — Lens Scanner suggestion  
10. `llm-suggestion` — Candidate from LLM extraction — **low default trust**  
11. `regex-text` — Heuristic regex hit on freeform text  

### The `MetadataFragment` contract

Every extractor must produce fragments matching this shape. Parsers **observe and emit**. They do **not** decide records.

```typescript
interface MetadataFragment {
  id: string                  // crypto.randomUUID()
  entityType: 'cruise' | 'platform' | 'segment' | 'party' | 'constraint' | 'docucomp' | 'keyword'
  entityFingerprint: string   // set by cruiseFingerprint.js — do not guess
  fieldPath: string           // dot-path e.g. 'mission.title'
  value: unknown              // string, number, array, object — never null/undefined/''
  evidence: EvidenceClass     // from the ladder above
  source: {
    id: string                // filename or record UUID
    kind: 'iso-xml' | 'bedi-xml' | 'csv' | 'comet-pull' | 'scanner' | 'llm' | 'user'
    location: string          // XPath, row/col, or description
  }
  rawSnippet?: string         // verbatim source text, for audit
  extractedAt: string         // ISO 8601
}
```

---

## What is already built

| Component | Status | File |
|-----------|--------|------|
| `MetadataFragment` type + `partialToFragments` | Done | `src/core/fragments/MetadataFragment.js` |
| `EvidenceClass` ladder | Done | `src/core/fragments/MetadataFragment.js` |
| ISO XML fragment extractor | Done | `src/adapters/sources/IsoXmlFragmentExtractor.js` |
| Cruise fingerprinter | Done | `src/core/identity/cruiseFingerprint.js` |
| Import conflict UI (diff + accept/reject) | Done | `src/components/ImportReviewPanel.jsx` |
| `diffPilotStates` | Done | `src/core/fragments/diffPilotStates.js` |
| Canonical entity typedef + mappers | Partial | `src/core/entities/types.js` |
| Automatic reconciler (`evidenceOutranks`) | Done | `src/core/reconcile/reconcileFragments.js` + `src/core/reconcile/mergeWithEvidence.js` (caller wires `mergeWithEvidence`; `mergeLoadedPilotState` unchanged) |
| Multi-source `RebuildReviewPanel` | Done | `src/components/RebuildReviewPanel.jsx` + `src/hooks/useMultiSourceReconstruct.js` |
| BEDI collection renderer | Done | `src/profiles/bedi/bediCollectionXmlPreview.js` |
| BEDI granule renderer | Done | `src/profiles/bedi/bediGranuleXmlPreview.js` |
| Mission / UxS renderer | Done | `src/lib/xmlPreviewBuilder.js` |
| Tier 1 validator | Done | `DOMParser` in `XmlPreviewPanel` |
| Tier 2 validator | Done | `src/hooks/useNoaaValidator.js` + `src/components/ValidationPill.jsx` |
| Tier 3 CoMET validator | Done | `src/hooks/useCometValidator.js` + `src/components/CometValidationPanel.jsx` |
| Intake classifier | Done (fixed) | `src/features/intake/intakeClassifier.js` |
| Gemini extraction agent | Not wired | planned: `/api/manta-intent` action |

---

## What is next (build order)

1. ~~Automatic reconciler~~ — **done** (`reconcileFragments` + `mergeWithEvidence`)
2. ~~`RebuildReviewPanel`~~ — **done** (multi-source conflict / suggestion UI + hook)
3. Wire `RebuildReviewPanel` + `mergeWithEvidence` into the import / merge UX where fragments exist
4. Gemini extraction layer — `llm-suggestion` fragments from freeform text
5. Mission form UX — accordion sections, gap banner, abstract live checklist
6. `AGENT_CONTEXT.md` loaded by all Gemini agent calls

---

## Rules for every AI agent in this codebase

These rules apply to Claude (Cursor), Gemini (app API calls), and any future model.

### NEVER do these

- Auto-apply `llm-suggestion` fragments without user confirmation  
- Overwrite a field that already has `iso-xpath-exact` or higher evidence  
- Invent coordinates (bbox) unless explicit decimal numbers appear in source text  
- Generate ISO XML directly — use the existing renderers (`xmlPreviewBuilder.js`)  
- Run validation logic — use `ValidationEngine.js` and the three tiers  
- Make fingerprinting decisions — use `cruiseFingerprint.js` `normalizeCruiseId()`  
- Make reconciliation decisions — use the evidence ladder, not LLM judgment  
- Return confidence as a float — evidence is an enum, not a score  
- Modify `xmlPilotImport.js` without running `npm run verify:pilot` after  
- Add new npm dependencies without checking bundle size impact (`index.js` is ~1.2MB)  

### ALWAYS do these

- Read before writing — audit the relevant files before generating code  
- Run `npm run verify:pilot` after any code change  
- Keep `llm-suggestion` fragments at the bottom of the evidence ladder  
- Return plain JSON from extraction calls — `fieldPath` + value pairs only  
- Surface LLM suggestions as chips/amber indicators, never as committed values  
- Preserve the partial return from `IsoXmlFragmentExtractor` for backward compat  
- Keep BEDI and Mission profiles separate — do not merge their parsers  
- Use the existing CoMET proxy (`/api/comet-proxy`) for all CoMET calls  
- Strip `gmi:` and `MI_Metadata` from classifier signals — they match all ISO files  

---

## Where LLM adds value (and where it does not)

### USE LLM for these — low lock-in, high value

| Use case | Why safe | Output stored as |
|----------|----------|-------------------|
| Abstract rewriting | User reviews before save | `mission.abstract` (plain text) |
| Gap filling from freeform text | `llm-suggestion` evidence; user confirms | Normal field values |
| GCMD keyword suggestion | User picks from chips | Normal keyword objects |
| Validation error translation | Explains XSD errors in plain English | Tooltip text only, not stored |
| Classifier confidence | Supplements keyword matching | `profileId` string |
| Cruise report / PDF text extraction | Best available for unstructured text | `llm-suggestion` fragments |

### DO NOT USE LLM for these — creates dependency or breaks determinism

| Use case | Use instead |
|----------|-------------|
| Generating ISO XML | `xmlPreviewBuilder.js` / BEDI renderers |
| Running validation | `ValidationEngine` + `xmllint-wasm` + CoMET |
| Fingerprinting records | `cruiseFingerprint.js` `normalizeCruiseId()` |
| Reconciling conflicts | `reconcileFragments` / `mergeWithEvidence` + evidence ladder in `MetadataFragment.js` |
| Fetching GCMD UUIDs | GCMD KMS API (`gcmdClient.js`) |
| Fetching ROR IDs | ROR API (`rorClient.js`) |
| Deciding which record wins | `evidenceOutranks()` — deterministic |

---

## Key NCEI metadata rules every agent must know

These are the rules Jason Weick validates against in Oxygen and CoMET. Any agent generating or reviewing metadata must follow them.

### Mandatory fields for a Mission-level record

- **Title** — unique; must match DOI title exactly  
- **Abstract** — must mention platform/vessel, sensor/instrument, geographic area, date range, data product type  
- **Purpose** — default: `This data is available to the public for a wide variety of uses including scientific research and analysis.`  
- **Status** — `completed`, `onGoing`, or `historicalArchive`  
- **DOI** — format: `10.xxxx/...`  
- **NCEI Accession ID** — alphanumeric  
- **Publication date** — `YYYY-MM-DDThh:mm:ssZ` (UTC, trailing `Z` required)  
- **Bounding box** — West ≤ East, South ≤ North, decimal degrees  
- **Begin + end dates** — end ≥ begin; use `nilReason="unknown"` if ongoing  
- **NCEI org keyword** — exact string required: `DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce`  
- **Publisher** — always NOAA National Centers for Environmental Information  
- **Data license** — `CC0-1.0` or `CC-BY-4.0`  

### GCMD keyword rules

Each facet must be in its own `gmd:MD_Keywords` block with a thesaurus citation.

Facets: Science (theme), Platform, Instrument, Location (place), Project, Data center (dataCentre).

Concept UUIDs (`xlink:href` anchors from KMS) are required for discovery-readiness. Missing UUIDs generate **warnings**, not errors — they do not block CoMET.

### XML namespace root (Jason confirmed — do not change)

```xml
<gmi:MI_Metadata
  xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:gco="http://www.isotc211.org/2005/gco"
  xmlns:gmd="http://www.isotc211.org/2005/gmd"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:gsr="http://www.isotc211.org/2005/gsr"
  xmlns:gss="http://www.isotc211.org/2005/gss"
  xmlns:gts="http://www.isotc211.org/2005/gts"
  xmlns:srv="http://www.isotc211.org/2005/srv"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.isotc211.org/2005/gmi https://data.noaa.gov/resources/iso19139/schema.xsd">
```

### Smart scavenging rules (auto-correction on import)

| Issue found in source | Auto-fix applied |
|------------------------|------------------|
| Date missing UTC `Z` (e.g. `2024-05-09T14:11`) | Append `:00Z` |
| Generic `otherConstraints` license text | Map to CC0-1.0 or CC-BY-4.0 preset |
| Missing purpose field | Insert NCEI standard string |
| NOAA acronyms in abstract (CPO, MDBC, UxS) | Expand on first use |
| ISO 19115-3 namespaces (`mri`, `mdb`, `mac`) | Translate to ISO 19115-2 (`gmd`, `gmi`) |
| Missing end date | Add `nilReason="unknown"` |
| Missing NCEI publisher block | Inject automatically |

---

## Gemini extraction prompt template

When calling Gemini to extract metadata from freeform text, use this system prompt as the base. **Load this file first**, then append it.

```text
You are a metadata extraction assistant for NOAA ISO 19115-2 records.
Your job is to extract structured field values from the provided text.

Rules:
1. Return ONLY a valid JSON object. No preamble, no explanation, no markdown fences.
2. Use only these exact fieldPath keys (omit any field not clearly present in the text):
   - mission.title
   - mission.abstract
   - mission.cruiseId
   - mission.vesselName
   - mission.dateStart       (ISO 8601 format: YYYY-MM-DDThh:mm:ssZ)
   - mission.dateEnd         (ISO 8601 format: YYYY-MM-DDThh:mm:ssZ)
   - mission.bbox.west       (decimal degrees)
   - mission.bbox.east       (decimal degrees)
   - mission.bbox.south      (decimal degrees)
   - mission.bbox.north      (decimal degrees)
   - mission.pointOfContact.name
   - mission.pointOfContact.email
   - mission.pointOfContact.organization
   - mission.doi
   - mission.accession
3. Do NOT invent values. If a field is ambiguous or absent, omit it entirely.
4. Do NOT guess coordinates. Only return bbox values if explicit decimal numbers
   or named regions with clear bounding boxes appear in the text.
5. Acronyms: expand on first use — UUV = Uncrewed Underwater Vehicle,
   AUV = Autonomous Underwater Vehicle, CTD = Conductivity Temperature Depth.
6. Your output will be wrapped as llm-suggestion fragments with the lowest evidence
   trust level. A human will review and accept or reject every value.

Return format example:
{
  "mission.title": "Point Sur 2024 Leg 18 Multibeam Survey",
  "mission.cruiseId": "PS2418L0",
  "mission.dateStart": "2024-05-05T15:10:00Z",
  "mission.bbox.west": -95.0
}
```

---

## Test commands

```bash
cd react-pilot

# Full verify (lint + build + bedi tests + verify-pilot suite)
npm run verify:pilot

# Refresh NOAA schemas (~72 XSD files in public/schemas/)
npm run schemas:noaa-public

# Mirror NOAA schemas if public/schemas is stale
node scripts/mirror-noaa-schemas-public.mjs
```

---

## Glossary

| Term | Meaning |
|------|---------|
| **pilotState** | The flat internal state object the wizard is bound to |
| **partial** | The subset of `pilotState` returned by `xmlPilotImport` after an import |
| **fragment** | A single field value with evidence, source, and fingerprint attached |
| **fingerprint** | A normalized deterministic key identifying a logical entity (e.g. `cruise:biolum2009`) |
| **reconciler** | The logic that picks the winning fragment value when sources disagree |
| **renderer** | A pure function: canonical model → ISO XML string |
| **DocuComp** | NCEI’s reusable XML snippet system (`xlink:href` to components); often breaks on resolution |
| **BEDI** | Benthic Environmental Data Ingest — a specific NCEI data pipeline and XML profile |
| **UxS** | Uncrewed Systems — the platform category for AUVs, UUVs, gliders, saildrones |
| **KMS** | GCMD Keyword Management Service — the API for GCMD concept UUIDs |
| **ROR** | Research Organization Registry — persistent IDs for institutions |
| **ORCID** | Persistent IDs for individual researchers |
| **CoMET** | Collection Metadata Editing Tool — NOAA’s authoritative metadata catalog |
| **OneStop** | NOAA’s metadata discovery portal |
| **CruisePack** | NOAA’s cruise data packaging tool |
| **Send2NCEI** | NOAA’s data submission tool |
| **DigiCat** | NOAA’s Digital Archive Catalog |
