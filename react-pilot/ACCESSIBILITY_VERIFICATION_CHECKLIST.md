# Keyboard and Accessibility Verification Checklist

## Purpose

This document supports structured verification that the React pilot scaffold meets keyboard-only operation, assistive technology compatibility, and visual accessibility expectations appropriate for a federal-adjacent pilot. Use it before signoff to record objective pass/fail results and reproducible evidence.

## Scope

Verification applies to the isolated pilot UI and its supporting assets, not the full legacy application.

| Area | Pilot paths (representative) |
|------|------------------------------|
| Application shell | `src/App.jsx`, `src/App.css` |
| Mission inputs | `src/components/StepMission.jsx` |
| Entry and global styles | `src/main.jsx`, `src/index.css`, `index.html` |
| Host bridge (HTTP vs offline UX) | `src/adapters/HostBridge.js`, `src/adapters/http/HttpHostAdapter.js` |
| Six-step forms + side panels | `StepPlatform.jsx`, `StepSensors.jsx`, `StepSpatial.jsx`, `StepKeywords.jsx`, `StepDistribution.jsx`, `ValidationPanel.jsx`, `XmlPreviewPanel.jsx` |

**Parallel track (manual checks):** After major UI changes, re-verify **Server rules validate**, **Bridge check**, **GeoJSON (server)** / **DCAT JSON-LD (server)** buttons in `ValidationPanel` / `XmlPreviewPanel` when the host bridge is available — `aria-busy` while requests run, disabled state when the bridge is unavailable, and that status text (`aria-live` on the shell status line) updates.

Out of scope for this checklist: production hosting configuration, non-UI server logic outside the pilot bundle, and third-party dependencies beyond their impact on the pilot pages listed above.

## Pre-check setup

- [ ] Use a current supported browser per agency policy (document exact version in evidence).
- [ ] Disable mouse or use a separate keyboard-only session so focus is not restored by pointer movement.
- [ ] Clear cached site data if testing theme persistence (`localStorage`) to avoid stale `data-theme` state.
- [ ] Run the build the same way stakeholders will: local Vite dev (`npm run dev`) and your deployed static/Netlify preview.
- [ ] Install or enable at least one screen reader (NVDA on Windows, VoiceOver on macOS, or agency-approved equivalent) and confirm speech rate and verbosity are set to typical user defaults.
- [ ] Optionally install an automated checker (e.g., axe DevTools) for supplemental findings; automated results do not replace manual keyboard and screen reader verification.

## Keyboard-only verification

Complete each row using **Pass** or **Fail**. For **Fail**, note defect ID or brief description in evidence (see Evidence capture).

| # | Check | Pass | Fail |
|---|--------|:----:|:----:|
| 1 | From page load, **Tab** moves focus in a logical order through all interactive controls (theme toggle, Mission ID field, Organization field, bridge button when enabled). | | |
| 2 | **Shift+Tab** reverses focus order without traps or skipped controls. | | |
| 3 | Focus indicators are visible on every focused control in **light** and **dark** themes (no reliance on hover-only styling). | | |
| 4 | **Mission ID** and **Organization** fields accept keyboard entry, selection, and deletion; no unexpected focus jumps on input. | | |
| 5 | **Space** on the theme checkbox toggles light/dark as expected; **Enter** does not submit an unintended form (none present in scaffold; confirm no accidental navigation). | | |
| 6 | **Run bridge check** button is reachable when enabled; **Enter** or **Space** activates it; **Tab** does not enter the button when `disabled` in a confusing way (focus may skip disabled controls per browser—document behavior). | | |
| 7 | When the bridge button is **disabled**, explanatory text (`bridgeHint`) remains readable and, if linked via `aria-describedby`, association is verified in the accessibility tree. | | |
| 8 | No keyboard trap: focus can always leave the pilot shell (including modals if added later—N/A unless extended). | | |
| 9 | Landmark structure: primary content is inside `<main>`; headings reflect outline (`h1` then `h2` per card). | | |
| 10 | Page **title** and **`lang`** on `<html>` match deployed language (`index.html`). | | |

## Screen reader verification

| # | Check | Pass | Fail |
|---|--------|:----:|:----:|
| 1 | Screen reader announces page title and moves by headings in a sensible order (`h1`, then section `h2`s). | | |
| 2 | **Mission ID** and **Organization** labels are announced with their fields (native `<label>` / `htmlFor` association). | | |
| 3 | Theme control is announced as a checkbox; checked state reflects dark mode; state change is announced on toggle. | | |
| 4 | **Run bridge check** button name updates appropriately for loading vs idle; `aria-busy` state change is sensible in the chosen screen reader. | | |
| 5 | Runtime / host connection status is discoverable without relying on color alone. | | |
| 6 | No inappropriate repetition of static boilerplate on every focus move (adjust if pilot adds decorative elements). | | |

## Color and contrast verification

| # | Check | Pass | Fail |
|---|--------|:----:|:----:|
| 1 | Text and interactive control boundaries meet **WCAG 2.x** contrast targets for normal and large text in **light** theme (target: **4.5:1** normal, **3:1** large; **3:1** non-text UI components where applicable). | | |
| 2 | Same as row 1 for **dark** theme after toggle. | | |
| 3 | Information is not conveyed by **color alone** (e.g., status and hints use text or structure, not only hue). | | |
| 4 | Focus ring or outline meets **3:1** against adjacent colors or uses a sufficient dual-ring pattern per design system. | | |
| 5 | Disabled button styling remains legible; disabled state is not communicated by color alone (use `disabled` attribute and visible label). | | |

## Status messages and live regions

| # | Check | Pass | Fail |
|---|--------|:----:|:----:|
| 1 | Status container uses `role="status"` (or equivalent live region) with `aria-live="polite"` and `aria-atomic="true"` as implemented in `App.jsx`. | | |
| 2 | Initial “Ready” message is exposed in the accessibility tree without excessive duplication. | | |
| 3 | **Bridge check** progress is announced when status text updates. | | |
| 4 | Success (“Bridge check succeeded.”) and failure (error message) announcements occur without stealing focus from the triggering control unless design requires otherwise (document if focus moves). | | |
| 5 | Rapid successive updates do not cause unintelligible chatter; polite live region behavior is acceptable for this pilot (document if `assertive` is ever required). | | |

## Dialogs and scanner workflows

| # | Check | Pass | Fail |
|---|--------|:----:|:----:|
| 1 | Scanner suggestion dialog opens with focus moved inside the dialog and `aria-modal="true"` exposed in the accessibility tree. | | |
| 2 | **Tab** and **Shift+Tab** cycle within the scanner dialog; focus does not escape behind the modal until it closes. | | |
| 3 | **Escape**, **Close**, and backdrop click close the scanner dialog; focus returns to the control that opened it. | | |
| 4 | Scanner suggestion checkboxes announce the target field and value, not only an internal row key. | | |
| 5 | Keywords step "Suggest from title / abstract" status is announced through a polite live region, and keyword chips expose clear remove names. | | |

## Evidence capture

For each verification session, retain:

- Date, tester name or role, browser and version, operating system, and screen reader product and version.
- Theme(s) exercised (light, dark, both).
- Environment (Vite dev URL vs deployed Netlify URL).
- Exported or summarized automated scan results (tool name, rule set, counts of violations by severity).
- Short screen recording or step log for any **Fail** item, including steps to reproduce and expected vs actual behavior.
- Issue tracking reference (ticket ID) when defects are filed.

Store evidence per agency records management policy; do not commit secrets or PII into the repository.

## Exit criteria (pilot signoff)

Signoff is appropriate when **all** of the following are true:

1. Every **Keyboard-only** row is **Pass**, or **Fail** items are tracked with agreed remediation owners and dates.
2. **Screen reader** checks are **Pass** for the agency-approved reader/browser combination, or documented exceptions are risk-accepted in writing.
3. **Color and contrast** checks are **Pass** for both themes, or a design deviation is documented with compensating measures.
4. **Status / live region** behavior is **Pass** for success, failure, and loading paths exercised in the pilot.
5. Evidence package for the session is complete and linked from the pilot release record.

---

*Document version: pilot scaffold. Update this checklist when new interactive components, routes, or embed contexts are added.*
