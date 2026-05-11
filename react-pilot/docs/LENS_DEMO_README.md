# Manta Lens — demo README

Use this doc when **walking someone through what Lens actually does** in the React pilot (wizard + validation + coaching UI).

## Run the demo locally

```bash
cd react-pilot
npm install
npm run dev
```

Open the app (default **http://127.0.0.1:5173**), load or paste metadata so validation issues appear, then expand **Manta Lens** and try **Fix walk**, chips, and **Ask** flows.

For same-origin **`/api/db`** (host-backed save), use Netlify dev per [`README.md`](../README.md).

---

## What the real Lens actually does

| Feature | What it actually does | Wired? |
| :------ | :-------------------- | :----- |
| **Fix walk** | Queues all issues with a `field`, walks them one by one, shows coaching + chips | Real — `buildFixGuideQueue` |
| **Auto-fix** | Trims whitespace, normalizes ISO dates, reorders bbox, sets default lang/charset. Does **not** invent content | Real — `applyPilotAutoFixes` via `manta:pilot-auto-fix-request` |
| **Ask Q&A** | Knowledge-base pattern matching — **not** an LLM. Pre-built answers about field, abstract, GCMD, validation modes | Real — `answerQuestion` |
| **Inline glass** | Injects `manta-lens-inline-glass` nodes after fields that have issues in the active lens scope | Real — DOM injection + scope driven from lens state (see **Source map** below) |
| **`manta:lens-goto-field`** | Host receives → jumps to correct step + scrolls to field DOM node | Real — e.g. “Ask me more” / navigation flows fire this |
| **`manta:set-pilot-field`** | Host receives → sets field value in `pilotState` | Real — chips from the Lens fix walk use this |
| **`getLensChipsForIssue`** | Primary chips include **Why?** and **Safe defaults**; field-specific quick-fill chips are **pattern-based** and limited | **Gap** — not every issue gets tailored fill values; behavior grows over time |

### Technology note

- **Ask Q&A** uses curated pattern matching, **not** a hosted LLM.

### Source map (where to read the code)

| Topic | Location |
| :---- | :------- |
| Fix queue + coaching | `src/lib/lensFixGuide.js` — `buildFixGuideQueue` |
| Auto-fix rules | `src/lib/pilotAutoFix.js` — `applyPilotAutoFixes` |
| Q&A answers | `src/shell/metadataKnowledgeBase.js` — `answerQuestion` |
| Inline glass DOM | `src/shell/AssistantShell.jsx` — `.manta-lens-inline-glass` |
| Events (`goto-field`, `set-pilot-field`, auto-fix) | `src/shell/WizardShell.jsx` + `src/lib/mantaHostEvents.js` |
| Chips per issue | `src/lib/lensIssueChips.js` — `getLensChipsForIssue` |

---

## Quick demo script (5 minutes)

1. **Import** a fixture XML from `react-pilot/fixtures/mission/` or use **demo records** if exposed in your build.
2. Open **Lens** and confirm **readiness / issue counts** match what you expect from validation.
3. Start **Fix walk** — advance issue-by-issue; use **Why?** and **Safe defaults** where shown.
4. Click a **field chip** that applies a value and confirm the wizard field updates (`manta:set-pilot-field`).
5. Use **Ask** with a question that matches a known pattern (e.g. abstract length, GCMD) and confirm you get a **static** answer, not chat completions.

---

*Maintainers: if Lens ports, events, or chip behavior change, update the table and source map in this file.*
