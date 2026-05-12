# AI Change Control For uSX / Manta

Use this when Gemini, Antigravity, Cursor, or another agent makes broad changes in this repo.

## Current Runtime Truth

- Repo root is legacy/reference material.
- `react-pilot/` is the canonical Vite app.
- Runtime truth is `pilotState` plus profile rules plus `ValidationEngine` plus XML preview/import/export paths.
- Mockup HTML files are reference only unless explicitly wired into React.
- Extension code in `manta-chrome-extension/` must not silently change React runtime behavior without a matching React-side verification.

## Safe AI Workflow

Before asking an AI agent to edit code:

1. State the exact goal in one sentence.
2. Give an `allowedFiles` list.
3. Tell the agent which files are reference-only.
4. Tell the agent to preserve `npm run verify:pilot`.
5. Tell the agent not to soften validation gates just to make tests pass.

After the agent edits code:

1. Run `cd react-pilot && npm run verify:pilot`.
2. Review `git diff --stat` for unexpected blast radius.
3. Review any validation, import, XML, schema, or score-threshold changes manually.
4. Confirm generated reports/fixtures are expected before committing them.
5. If UI changed, run the app and inspect the affected flow manually.

## Hard Stop Patterns

Stop and review before continuing if an AI change does any of these:

- changes more than 10 source files for a small UI/task request
- rewrites `AssistantShell.jsx`, `WizardShell.jsx`, or large CSS files without a scoped reason
- changes XML import/export behavior and UI behavior in the same pass
- weakens a test threshold, score gate, or validation severity
- edits compiled rules without also updating the source matrices or explaining the generation path
- adds generated reports/fixtures without naming why they are durable repo artifacts
- changes Chrome extension permissions or host matches
- uses mockup HTML as if it were production implementation

## Verification Gates

Minimum local gate:

```bash
cd react-pilot
npm run verify:pilot
```

For stricter BEDI quality gates when fixtures are stable:

```bash
cd react-pilot
VERIFY_BEDI_COLLECTION_MIN_SCORE=70 VERIFY_BEDI_GRANULE_MIN_SCORE=60 npm run verify:pilot
```

For fixture import coverage:

```bash
cd react-pilot
node scripts/test-fixtures.mjs
```

For swarm/rules work:

```bash
cd react-pilot
npm run swarm:all
npm run swarm:regress
```

## Recommended Prompt For Future AI Work

```text
You are editing /Users/connorcayson/Downloads/uSX.

Read AGENTS.md and AI_CHANGE_CONTROL.md first.

The canonical app is react-pilot/. Repo-root legacy HTML and docs/*.html mockups are reference only.

Do not broaden scope. Use only the allowedFiles list below. Do not weaken validation gates, score thresholds, XML import/export semantics, or extension permissions unless explicitly requested.

After edits, run: cd react-pilot && npm run verify:pilot.

Report:
- files changed
- behavior changed
- verification output
- any validation gates changed
- anything that needs manual browser QA

Allowed files:
- <list files here>

Goal:
- <one sentence>
```

## Current Gemini Diff Risk Notes

As of this handoff, `npm run verify:pilot` passes. The remaining risk is review risk, not build risk:

- The active diff is large across React shell, CSS, scanner/lens, extension, compiled rules, and QA docs.
- `react-pilot/scripts/verify-pilot.mjs` now makes BEDI collection/granule score floors optional unless environment variables are set. This may be reasonable for drifting external fixtures, but do not treat it as proof that metadata quality stayed high.
- Large CSS changes in `react-pilot/src/futuristic.css` and `react-pilot/src/App.css` need manual visual QA.
- Extension manifest/service-worker changes need permission/behavior review.

