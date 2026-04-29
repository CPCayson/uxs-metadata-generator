# Manta roadmap — big picture to execution

This document connects the **metadata operations layer** vision (intake → structure → validate → ISO → handoff → visibility) to **phased delivery** in `react-pilot` and adjacent systems. It is meant for planning and stakeholder alignment, not as a fixed contract.

---

## North star

**Manta helps teams move from messy inputs to archive- and discovery-ready metadata faster** by:

- Making **where work is stuck** visible (validation, readiness, blockers).
- Reducing **blank-form** friction via **scanner-assisted prefill** and imports.
- Producing **trustworthy ISO 19115-2** (and profile-specific XML) without forcing everyone to be an ISO expert.
- Sitting **before** systems of record (e.g. **CoMET**) as a working layer: pull → improve → preflight → push **DRAFT**.

**One-line pitch:** *Turn pipeline diagrams into a working app — one shared metadata engine, many workflow packs.*

### Lens canvas (dual surface)

The Manta Lens HUD portals into `#manta-scanner-host`, which overlays the full **`workspace-grid`** (left form + right Validator / Live XML / CoMET) so both surfaces stay visible through the glass band. Stacking: HUD chrome → optional issues tray (**Wrap ↑**) → **through-glass** (`flex: 1`, pointer-events pass-through) → tray (**Dock ↓**). Host wiring: `WizardShell.jsx` + `MantaScannerFrame.jsx`; extension-oriented APIs: `mantaHostEvents.js`, `scannerEngine.js`.

```text
+------------------------------------------------------------------+
| Lens HUD (bar, readiness, section bars, fix walk…)             |
| +---------------------------+ +-----------------------------+   |
| | workspace-main (form)     | | workspace-side (tabs)       |   |
| | visible through glass       | | XML / Validator / CoMET   |   |
+---------------------------+ +-----------------------------+   |
+------------------------------------------------------------------+
```

---

## Where we are now (baseline)

Already in the codebase (non-exhaustive):


| Area                                  | Status                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mission / dataset wizard**          | Six-step profile, validation, XML preview, ISO import, session persistence                                                                     |
| **Lens Scanner (suggestions)**        | Envelope ingest, heuristic + `/api/db` `lensScan`, accept/reject, merge, keyword UUID union, trust fields (`source` / `model` / `evidence`)    |
| **Manta Ray widget + Lens overlay**   | Quality score, issues, XML highlight, GCMD/ROR search, local ASK KB                                                                            |
| **Fix Issues (auto-fix)**             | Safe mechanical fixes (trim, accession cleanup, `language` default, date/bbox/vertical swaps) + wizard sync via `manta:pilot-auto-fix-request` |
| **Readiness strip (Phase 2 starter)** | Wizard + Manta widget + Lens overlay: three lanes; tap / mode buttons sync `pilotState.mode` (`readinessSummary.js`, `ReadinessStrip.jsx`)     |
| **CoMET**                             | Pull/load event, proxy patterns, push path where host allows                                                                                   |
| **BEDI / collection / granule**       | Profiles, import/preview paths as implemented                                                                                                  |
| **Netlify `/api/db`**                 | DB CRUD + stateless `lensScan`, GeoJSON, DCAT, validate                                                                                        |


Gaps relative to the big picture:

- No **org-wide pipeline dashboard** (missions blocked, NOFO closeout, video queue, etc.).
- Scanner MVP is **narrow** (e.g. title/abstract → GCMD science keywords), not “read any PDF/report/package.”
- **Readiness lanes** beyond the three validation modes (OneStop-ready, archive-handoff-ready, CoMET-preflight state, etc.) are still **not** separate named surfaces.
- **Workflow packs** exist as an **architecture idea** (profiles, capabilities); not yet a catalog of OER-specific recipes with dedicated dashboards and reports.

---

## Phase 0 — Solidify the spine (now → next)

**Goal:** Every team touchpoint feels reliable before scaling recipes.

- Harden **session vs. live wizard** consistency (widget, Lens, auto-fix, scanner merge all agree on source of truth).
- Expand **auto-fix** only where rules are unambiguous (document each rule; add tests in `verify-pilot.mjs`).
- **ISO / gmi** output and import roundtrips: keep parity tests green; fix regressions before new features.
- **CoMET**: document and test **cookie/session** expectations; clear errors when proxy/auth missing.
- **Telemetry / debug** (optional): lightweight events for “scanner merged”, “auto-fix applied”, “CoMET push attempted” for support.

**Exit criteria:** Mission path is demo-safe end-to-end (form → validate → XML → optional CoMET handoff) with no silent data loss.

---

## Phase 1 — Scanner as the front door

**Goal:** *Start from something you already have*, not only a blank form.

- Broaden **scanner envelope** coverage: more **fieldPaths**, richer **evidence**, optional **multi-document** ingest (still envelope-first).
- **Server scan** path: optional LLM or rules engine behind fixed JSON schema (same envelope contract).
- **File types:** cruise reports, tables, manifests — start with **one** high-value pilot (e.g. structured text or CSV) before PDF.
- **UI:** keep **accept/reject** and post-merge validation; add “preview diff” if merge complexity grows.

**Exit criteria:** A repeatable demo: “paste / drop / run scan → review suggestions → merge → validation updates.”

---

## Phase 2 — Readiness, not just “valid”

**Goal:** Answer *what kind of ready* is this record?

- **Shipped (starter):** **Readiness** strip in the **Validator** tab, **Manta Ray widget**, and **Lens overlay** — lenient / strict / catalog side-by-side (errors only for ✓/✗); tap syncs `pilotState.mode` via `manta:set-validation-mode` / `manta:wizard-validation-mode-changed` (`readinessSummary.js`, `ReadinessStrip.jsx`).
- Define **readiness types** (e.g. ISO-ready, CoMET-preflight-ready, discovery-ready) as **named check bundles** mapping to existing + new rules.
- Surface in **wizard** (badges or checklist) and optionally in **widget** summary.
- Tie **CoMET preflight** (resolver, validate, linkcheck, rubric) to explicit readiness states where APIs exist.

**Exit criteria:** A user can say “this fails OneStop-related checks” without reading raw ISO.

---

## Phase 3 — Boss view (pipeline dashboard)

**Goal:** Leadership and leads see **blockers and throughput**, not only one record.

- **Aggregates:** counts by state (draft, blocked, ready for push), by profile, by missing facet (keywords, contacts, links).
- **Sources:** start from **exported snapshots** or a minimal **API** if a backend appears; avoid blocking on a full data warehouse on day one.
- **Exports:** CSV / JSON for quarterly-style reporting (align with OER reporting needs).

**Exit criteria:** One screen answers “what’s stuck this week?” for a defined pilot cohort.

---

## Phase 4 — Workflow packs (scale across NOAA)

**Goal:** *This fits my pipeline* without a new app per team.

Package **Manta Core** + a **pack**:


| Pack (example)         | Focus                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Mission PED            | Current mission wizard + ISO + CoMET                       |
| ROV video              | Collection/granule, portal links, keyword + handoff checks |
| NOFO closeout          | Deliverables checklist, archive readiness, PI gaps         |
| CruisePack intake      | Manifest/checksum/inventory → form prefill                 |
| OneStop / discovery QA | Rubric-oriented checks + link health                       |


Each pack: **steps**, **scanner rules**, **validation gates**, **dashboard tiles**, **export templates**.

**Exit criteria:** A second profile/pack ships with its own demo script and docs.

---

## Cross-cutting themes

- **Trust:** preserve Docucomp/XLinks and shared components; never “fix” by deleting structure without explicit user action.
- **Security:** no secrets in the client bundle; tokens/cookies only via documented host/proxy patterns.
- **Accessibility & ops:** keyboard paths for Lens, clear errors when network or auth fails.

---

## Suggested success metrics (pick a few per phase)

- Time from **blank** to **first valid ISO preview** (median).
- **Scanner merge** adoption rate and **post-merge error** rate.
- **CoMET DRAFT** push success rate and **preflight** failure categories.
- **Auto-fix** applications per session (sanity: not infinite loops).
- Dashboard: **records blocked** trend week over week (when Phase 3 exists).

---

## How to use this doc

- **Engineering:** slice phases into issues/PRs; keep `verify-pilot` and integration tests aligned with each slice.
- **Product / OER:** pick **one** Phase 4 pack as the next narrative after Phase 1 demo is stable.
- **Stakeholders:** treat phases as **ordering**, not dates; dates belong on your program plan, not here.

---

*Last updated: aligns with `react-pilot` capabilities as of the Manta Lens auto-fix + Lens Scanner wiring era; revise when major new surfaces ship.*