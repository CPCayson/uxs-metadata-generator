# Pilot end-user feedback — SWARM routing

**Source:** Mantas Metadata Builder / React pilot (`react-pilot/`) — Netlify preview feedback and internal notes.  
**Purpose:** Route qualitative UX and correctness complaints into parallel work lanes (see [SWARM_IMPLEMENTATION_BOARD.md](./SWARM_IMPLEMENTATION_BOARD.md)) and track product gaps.

---

## Legacy workflow vs new (React pilot) workflow

| Aspect | Legacy (repo root) | New / React pilot (`react-pilot/`) |
|--------|---------------------|--------------------------------------|
| **Surface** | Repo-root HTML (`Index.html`) and Apps Script–style flows; forms like `#missionForm`, `#spatialForm`, `#platformForm`. | Single app shell: wizard steps Mission → Platform → Sensors → Spatial → Keywords → Distribution. |
| **State** | Fragmented DOM / script state per form. | One **`pilotState`** model driving the wizard. |
| **Validation** | Spreadsheet / ad hoc checks (see legacy field inventory). | **Compiled rules** + validation engine aligned to profiles. |
| **Field naming** | Legacy selectors and `METADATA_FIELD_MAP.md` inventory. | React paths mapped to the same semantics; see **`METADATA_FIELD_MAP.md`** for React ↔ legacy names. |
| **Standard** | Same target: ISO 19115-2–style UxS / NCEI alignment. | Same standard — **difference is UX shell, state model, and validation**, not a different metadata schema. |

**CRS, bbox, grid, quality:** live on the **Spatial** step (legacy `#spatialForm`; see section 7 in `METADATA_FIELD_MAP.md`). Mission step narrative should not imply those fields belong under Mission.

---

## Quick wins vs deeper fixes

- **Quick wins:** Dark-mode contrast for XML/validator buttons; inline glossary links (File Identifier, ISO Topic Category); “Beginner / Expert” density toggle (copy density + optional help); empty hero/image placeholder audit; save dirty-state banner (“unsaved changes”).
- **Deeper fixes:** Import → form population reliability; round-trip XML parity (order, spacing, docucomp refs, keywords, timestamps); schemaLocation handling on import; validation UX (errors vs warnings, click-through).

---

## Feedback by SWARM lane

### SWARM-A — Schema guardrails

- Import sometimes yields **missing schema location** → large validation error counts (~151). Users need either bundled/catalog schema resolution or a clear **blocking message** before “validate everything.”
- **Output vs template:** spacing, blank lines, element order — users perceive **non-deterministic or wrong ordering** vs NCEI/UxS template expectations.

### SWARM-B — Compiler / merge

- **Keywords:** template expects **repeat `keyword` tags** / docucomp-style links; pilot output diverges — compiler/export path should match template keyword encoding.
- **Validator surface:** question whether **all validator modes** are needed vs a single **Validate** — product decision; if kept, each option needs a **short explanation** (tooltip or modal).

### SWARM-C — Condition engine

- **Required vs optional:** users want clarity — red box vs rule severity; **which fields block publish** vs advisory.
- **Errors vs warnings:** need plain-language definitions and UI distinction (color, icon, filter).

### SWARM-D — Ingestion + mapping QA

- **Import does not populate fields** (browse/upload) — silent failure is worst-case UX; need **progress, parse result, field mapping stats, and warnings.**
- **Import output mismatch:** output files should **match input structure** where possible (round-trip fidelity).
- **ISO Topic Category “one per line”** — UX says it **does not work**; fix parsing or change control (comma-separated vs newline).
- **Autoselect / contrast:** selected values **hard to read** in some themes — accessibility pass.
- **NCEI Data center prepopulated → 404** — broken default URL or resource; replace with valid stub or remove until verified.

### SWARM-E — Golden regression harness

- Add golden cases for: **import fixture → pilotState → export XML** vs expected bytes (or normalized DOM); **date/time** normalization (`2024-05-09T14:11` vs `2025-01-30T17:16:30Z`).
- **Validation:** “well formed but numerous validation errors” — golden suite should encode **expected issues** per fixture so regressions are visible.

### SWARM-F — Workbench integration

- **Save only on Mission tab?** — consolidate **Save / Export** affordances so users don’t lose work when switching steps.
- **Session recovery:** “Saving shut editor down — how to get back?” — need **recent records / drafts** list or explicit recovery copy.
- **Click-through issues:** next/previous issue navigation from validation tray.
- **Video/meeting:** closing app fixed performance — flag **heavy re-render or media** for profiling (non-functional but worth a perf issue).

---

## UX themes (cross-lane)

### Onboarding & intimidation

- App **looks cool** but **intimidating** — prioritize **Basic mode:** upload XML **or** minimal required fields + export; **Expert mode:** full wizard + validator matrix.
- **Top chrome:** options **hard to discover** — increase affordance (labels, contrast, grouped actions).

### Wizard copy & help

- **Big empty box / missing image** at top — audit placeholder asset or remove container.
- Long explanatory paragraphs (**Identification, citation dates, …**) confuse some users — shorten default copy; link **“What goes here?”** drawers.
- **Examples** (e.g. NCEI Title guidance, File Identifier) — contextual examples or linkouts.
- **How to populate UxS template** — dedicated short guide or preset profile walkthrough.

### XML preview

- **Dark mode:** preview action buttons **low contrast**.
- **Preview options** — popup/tooltip explaining each option.

### Authentication / tenancy

- **“Do user login and only see their records?”** — product decision; if single-user demo, state that explicitly to set expectations.

### Docucomp / template fidelity

- **Cite-as / restrictions / docucomp components** — align with NCEI template patterns; output **does not look right** today.
- **Formatting and order** — export serializer should follow template ordering conventions where specified.

---

## Netlify preview-specific notes

**Preview:** `https://symphonious-sunshine-843275.netlify.app/`  
Track environment issues separately from core pilot bugs (e.g. auth, persistence, API).

---

## Suggested backlog order (for pilot quality)

1. **Silent import failure** → visible parse/map result + errors (SWARM-D).
2. **Dark-mode buttons** (XML preview + validator) (SWARM-F).
3. **Dirty-state / save** clarity + tab discovery (SWARM-F).
4. **Round-trip XML** fidelity and timestamps (SWARM-D/E).
5. **Beginner/Expert** shell + shortened Mission copy (UX).
6. **Schema location / validation explosion** messaging (SWARM-A).
7. **Keywords + docucomp** output parity (SWARM-B/D).

---

## Maintenance

| Date | Notes |
|------|--------|
| 2026-05-11 | Initial consolidation from end-user testing notes and preview feedback. |
