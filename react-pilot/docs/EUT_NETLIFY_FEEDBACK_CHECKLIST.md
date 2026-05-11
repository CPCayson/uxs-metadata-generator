# Netlify pilot feedback — working checklist

**Product scope:** **UxS mission** metadata pilot (ISO 19115-2 / NCEI-shaped); ignore alternate profile flows unless this checklist explicitly mentions them.

Target build: `https://symphonious-sunshine-843275.netlify.app/`  
Use `- [ ]` / `- [x]` to track progress. Link PRs or issues in parentheses when addressed.

---

## A. Workflow context (education / UX copy)

- [ ] **Document legacy vs React pilot** in-product or onboarding: same ISO / UxS semantics; difference is shell, `pilotState`, and validation — not a different metadata standard. Legacy = repo-root HTML (`Index.html`), `#missionForm`, `#spatialForm`, `#platformForm`; React = wizard steps + `METADATA_FIELD_MAP.md` path mapping.
- [ ] **Mission step intro**: shorten or tier helper copy (“Identification, citation dates…” vs Spatial step ownership) so beginners are not overwhelmed; expert/detail optional. *(UxS acquisition framed as primary in `StepMission` intros — further shorten/tier still optional.)*
- [ ] **Beginner vs expert mode** (or **simple / detailed** workspace density): gate long labels, advanced fields, and validator options behind a toggle consistent with existing lens/workspace density patterns.

---

## B. Mission step — layout & comprehension

- [ ] **Top-of-step empty / broken image**: confirm asset path on Netlify (`404` vs missing `public/` asset); fix deploy base URL or replace placeholder.
- [ ] **Field clarity**: File Identifier, Cite as, NCEI title guidance — add tooltips, examples, or links to NCEI template guidance where appropriate.
- [ ] **DocuComp / template parity**: call out that output uses docucomp-oriented blocks per NCEI template; link internal reference (`NCEI Template/`, `METADATA_FIELD_MAP.md`).
- [ ] **Required vs optional**: visible legend (e.g. red asterisk + “Required” strip); align with validation profile — avoid implying everything is required.
- [ ] **Long form / tabs**: evaluate tabbed subsections within Mission vs single scroll (information architecture study / prototype).

---

## C. Dirty state, save, and recovery

- [ ] **“Save with no changes”**: app already tracks **dirty** vs baseline serialized state (`WizardShell`); verify UX shows “no changes” or disables save when `!isDirty` if users expect that guardrail.
- [ ] **Where to save**: **Save draft** currently lives on **Mission** step (`StepMission.jsx`) + keyboard shortcut per banner copy — consider surfacing save/draft affordance globally or clarifying in footer.
- [ ] **Recovery after close**: document autosave / browser storage + how to reload session; optional “resume draft” entry if not obvious.
- [ ] **Per-user records / login**: clarify product stance (static demo vs authenticated `/api/db`); Netlify deploy may not expose same-origin DB — document limitation.

---

## D. Import / XML / round-trip

- [x] **Import → fields not populating**: reproduce browse/upload path; surface parser warnings + merge summary; ensure failures are visible (not silent). *(Shipped: centralized import status + “Review import” messaging; browse → Apply hint.)*
- [x] **Import/output mismatch**: expected when ISO 19115-3 → 19115-2 via `pilotState` (`AGENTS.md`); expose short provenance note in UI + import report. *(Shipped: `SourceProvenancePanel` lineage note after ISO import; import sample report on Apply remains available.)*
- [ ] **Schema location / 151 validation errors**: validate `xsi:schemaLocation`, catalog URLs, and offline catalog behavior; explain “add schema” workflow in UI.
- [ ] **ISO Topic Category — one per line**: fix parsing or UI hint if newline entry fails.
- [ ] **Datetime in output wrong** (e.g. `2024-05-09T14:11` vs expected `2025-01-30T17:16:30Z`): audit `buildXmlPreview` / timestamp sources; UTC `Z` formatting.
- [ ] **Keywords / repeated tags / links**: align keyword emission with template (repeat `keyword` tags, docucomp-style links as in reference XML).
- [ ] **Formatting / order / blank spacing in XML**: compare to template fixture; normalize pretty-print vs canonical order where product requires parity.

---

## E. XML Preview panel

- [x] **Dark mode — preview actions low contrast**: raise button/text contrast for preview toolbar.
- [ ] **Preview options**: short popup or “?” explaining each option (structure hints, pretty-print, etc.).

---

## F. Validator panel

- [x] **Dark mode — buttons hard to see**: same contrast pass as preview.
- [ ] **Button explanations**: tooltips for strict / lenient / catalog modes and auxiliary actions.
- [ ] **Simplify modes?**: decide if primary UX is single **Validate** with advanced modes collapsed.
- [ ] **Errors vs warnings**: one-line explainer (blocking vs advisory) + doc link.

---

## G. Shell / chrome / accessibility

- [x] **Header / top options** low visibility: increase contrast and affordance (discoverability of Import, Lens, density, etc.). *(Shipped: dark-theme toolbar band + stronger header switch/label styling in `futuristic.css`.)*
- [x] **Autofill / select contrast**: selected values in inputs hard to read in theme — fix CSS variables for filled selects. *(Shipped: `--input-autofill-bg` + `color-scheme: dark` on dark root; `form-select` / `option` dark rules in `App.css`.)*
- [ ] **Click-through issues**: strengthen Next/Prev issue navigation from validator (already partially present — verify end-to-end).

---

## H. Deploy-specific / environment

- [x] **NCEI Data center prepopulated → 404**: identify URL(s) hit from deployed app; replace with stable resolver or graceful fallback + message. *(Stub download URL for Navy template enrichment: `…/access/uxs-template-pending-file` → `https://www.ncei.noaa.gov/access`.)*
- [ ] **Meeting video issues**: if reproducible only with app open, capture browser/GPU; likely client/environment — note as external unless tied to heavy animation.

---

## I. Verification (when closing items)

- [x] Run `cd react-pilot && npm run verify:pilot` after code changes.
- [ ] Re-test Netlify build path for assets, import, preview export, and validator.
