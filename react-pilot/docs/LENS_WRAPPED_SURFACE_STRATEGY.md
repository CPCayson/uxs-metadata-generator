# Lens “wrapped surface” strategy — room for Why, chips, and walk

Reference mockups (check into git when ready):

| # | File | Idea |
|---|------|------|
| 1 | `reference/lens-wrapped-surface/01-wrapped-surface-comet-editor.png` | **Form + insights rail**: wrapped glass modules on fields; **right column** for Field Insights, Automations, primary **Ask me more** — dedicated horizontal budget for explanations. |
| 2 | `reference/lens-wrapped-surface/02-manta-glass-strip-vs-split.png` | **Density ladder**: collapsed = **glass strip / full-width form**; expanded = **two-window** (wrapped form left + validator / XML right) with **resizable** divider. |
| 3 | `reference/lens-wrapped-surface/03-manta-expanded-two-window.png` | **Smart chips bar** + **automations row** + grouped fields; global actions separated from **field-local** chips. |
| 4 | `reference/lens-wrapped-surface/04-manta-wrapped-symbiote-walk-agent-mockup.png` | Agent mock: symbiote card + **external** insights rail (two-column page). |
| 5 | `reference/lens-wrapped-surface/05-manta-symbiote-unified-rail-inside-card.png` | **Unified**: field + insights/automations rail **inside one** glowing symbiote container; actions + LLM band still **inside** the same card below the split. |

## Problem we are solving

Inline strips (`manta-lens-inline-glass`) are correct for **signal**, but **Why?**, multi-line answers, chip rows, and LLM streaming need **predictable width and height**. Competing with the wizard column without a strategy produces cramped UI and duplicate chrome (FAB bar + strip + floating stack).

## Strategic layout tiers (pick per mode, not all at once)

1. **Strip mode (current baseline)**  
   Thin dock under `.mfg-field`: Why + a few chips. Good for **quick** fixes; bad for **long** Why or many chips.

2. **Wrapped symbiote card (next)**  
   Same target group gets a **dark glass container** with **minimum height** and **full group width**: field(s) on top, **action rail** + expandable **Why / LLM** body below *inside* the card. Ring/outline (`LensSymbioteFrame`) becomes the **outer edge** of this card, not the only UI.

3. **Split surface (reference 2–3)**  
   When the user needs maximum room: **narrow the form column** and open a **second surface** (validator summary, XML, or dedicated “Lens helper” panel) with a **draggable split**. Chips that are **global** (detected / warnings / suggestions counts) stay in a **top chip bar**; **field-local** actions stay in the symbiote or inline.

## What moves where (anti-redundancy)

| Content | Strip | Wrapped card | Split right rail |
|--------|-------|--------------|------------------|
| Issue one-liner | ✓ | ✓ (header) | optional |
| Why? long copy | cramped | ✓ body | ✓ if user pins “definitions” |
| Fill / safe chips | ✓ | ✓ rail | FAB or rail, not both |
| LLM stream | ✗ | ✓ dock (`data-manta-lens-helper-slot`) | ✓ optional full panel |
| Mode / severity (STEP / ERR) | FAB / lens bar | omit or icon-only | can mirror |

## Implementation order (pilot-friendly)

1. **Wrapped card layout** — extend symbiote from ring-only to a **portal card** under the measured group (reuse `.manta-lens-inline-glass` visuals + spacing tokens); **hide** the old strip when the card is open for that field to avoid double chrome. _(Pilot: `LensSymbioteFrame` deck + inline strip skipped for the symbiote field; expandable Why/LLM body still future work.)_
2. **Chip bar extraction** — one row component fed by validation snapshot (counts + links) optional above the step when `lensMode` + `workspaceDensity` allows.
3. **Split placeholder** — optional `lens-explore-split` width in session storage + CSS grid on `WizardShell` only when flag on (bigger change; do after 1–2).

## Alignment with existing code

- **Field resolution**: `getFieldElementForPilot` + `.mfg-field` / group selectors (`FieldRegistry.js`, `AssistantShell.jsx` inline glass).
- **Symbiote shell**: `LensSymbioteFrame.jsx` — grow into **card + ring**, not a second unrelated overlay.
- **FAB lens**: `LensScannerWorkspacePanel.jsx` remains **global** controls; symbiote is **local** to the focused group.

This doc is the single place to resolve “where does Why live?” before adding LLM: **default = inside wrapped card**; **power user = split rail**.
