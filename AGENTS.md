# Agents audit — uSX / Manta metadata workspace

This file orients **automated agents** (Cursor, CI bots, swarm lanes) on how to work in this repo without fighting the architecture. Update it when workflows change.

## Repository shape

| Area | Role |
|------|------|
| Repo root | Legacy HTML / Apps Script **reference only** for XML parity — not the runtime shell for the React pilot. |
| `react-pilot/` | **Canonical** Vite app: `pilotState`, validation, wizard steps, Manta widget, lens overlay. |
| `react-pilot/netlify/functions/` | Same-origin `POST /api/db` when using Netlify / `netlify dev`. |
| `schemas/`, `compiled_rules/`, `scripts/swarm/` | Rule pipeline (SWARM board); see `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md`. |

## Commands agents should actually run

```bash
cd react-pilot && npm install && npm run verify:pilot   # lint + build + parser checks
cd react-pilot && npm run dev                          # UI only (port 5173)
cd react-pilot && npm run dev:netlify                  # Vite + /api proxy (port 8888 → 5173)
```

Do not instruct users to run commands you can run yourself unless blocked by secrets.

## Lens + validation (common confusion)

- **Manta Lens** (`AssistantShell.jsx` + `#manta-scanner-host` in `WizardShell.jsx`) portals HUD chrome over the workspace; **issues tray + Fix Issues** port to `#manta-lens-step-footer-host` at the **bottom of the active step column**.
- **Inline glass** strips are injected in `AssistantShell` for `lensIssuesScoped` fields. Native wizard `<p class="field-error">` rows are **suppressed** while glass is shown (`data-manta-lens-suppressed`) so text is not duplicated — if duplication persists, audit DOM order (wrapped inputs, conditional `show()`).
- **STEP vs ALL** scope filters which issues drive glass — mismatched expectation often looks like “wrong step” bugs.

## Anti-patterns for agents

1. **Editing repo-root legacy generators** expecting the React app to pick them up — it will not.
2. **Assuming `npm run dev` alone exercises `/api/db`** — use `dev:netlify` or deploy-shaped proxy.
3. **Treating `docs/*.html` mockups** as production behavior — they are UX prototypes unless wired into React.
4. **Spreadsheet-only validation** — runtime truth is `pilotState` + `validationEngine` + profile rules.

## Swarm parallel lanes (reference)

See `react-pilot/docs/SWARM_IMPLEMENTATION_BOARD.md` for SWARM-A … SWARM-F ownership. “Agent 1–4” there are **human/agent work packages**, not Cursor product agents.

## Audit log (maintenance)

| Date | Finding |
|------|---------|
| 2026-05 | Added `AGENTS.md`; lens inline glass suppresses `.field-error` with `hidden` + `display:none !important` restore on teardown. |

When closing a lens-related task, append one row if behavior or ports changed.
