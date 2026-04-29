# UxS React Pilot (Isolated)

This folder is the **canonical** metadata wizard: **`pilotState`**, validation, XML preview, and browser import.

**Deployment:** static Vite build + **`HttpHostAdapter`** → **`POST /api/db`** (typically Netlify + Postgres). See **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**.

Classic HTML / generator sources at the repo root (`Index.html`, `*.gs`, …) are **reference only** for XML/schema parity with `METADATA_FIELD_MAP.md`; they are not used by this React shell at runtime.

## Purpose

- Exercise dark/light theme and form layout in a component-based UI.
- Persist through **`HostBridge`** → **`HttpHostAdapter`** → same-origin **`/api/db`**.
- Hold **field parity** with `METADATA_FIELD_MAP.md` **§7** (repo root) and `OVERVIEW_TEMPLATE_ALIGNMENT.csv`.
- **Six-step** workflow: Mission → Platform → Sensors → **Spatial** → Keywords → Distribution.

## Run locally (Vite + hot reload)

```bash
cd react-pilot
npm install
npm run dev
```

From **repository root** (after `npm install` inside `react-pilot/` once):

```bash
npm run pilot:dev
```

The dev server defaults to **port 5173**. Set `VITE_OPEN=0` to skip opening a browser.

Use **`netlify dev`** (or a proxy) so **`/api/db`** is on the **same origin** as the Vite app; otherwise host-backed actions fail at the network layer.

## Desktop app (Electron MVP)

The desktop shell wraps this same React pilot in Electron. It is useful when you want a real app window and native file-open handoff without fighting browser extension permissions.

Development mode uses Vite in one terminal and Electron in another:

```bash
cd react-pilot
VITE_OPEN=0 npm run dev -- --host 127.0.0.1
npm run desktop:dev
```

Pack a local macOS app directory:

```bash
cd react-pilot
npm run desktop:pack
```

Build distributable artifacts:

```bash
cd react-pilot
npm run desktop:dist
```

In the desktop app, use **File → Open Metadata File...** to load XML/JSON/text into the same import/scanner flow used by browser capture.

## Publish static share (`../pilot-share/`)

From repository root:

```bash
npm --prefix react-pilot run publish
```

See [`../PILOT_SHARE_WORKFLOW.md`](../PILOT_SHARE_WORKFLOW.md) and **PRODUCTION_QA_RUNBOOK.md Appendix A** for smoke checks on the static bundle.

## Host bridge & payloads

- **HTTP:** `src/adapters/http/HttpHostAdapter.js` → `POST /api/db` with `{ fn, args }` (see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)).
- **DTO shape:** `src/lib/pilotToLegacyFormData.js` (`pilotStateToLegacyFormData`) maps `pilotState` into the historical `collectFormData()` JSON shape for server handlers.

## Fast verify command

```bash
npm --prefix react-pilot run verify:pilot
```

Runs `lint`, `build`, BEDI parser tests, and `scripts/verify-pilot.mjs` (XML roundtrips, mapper fixtures, optional `xmllint`).

**Optional schema validation:** `npm run validate:xml -- path/to.xml` (requires `xmllint`).

## Migration slices (in repo)

1. **Constraints + license** — Mission: `citeAs`, `otherCiteAs`, `dataLicensePreset`, `licenseUrl`, `accessConstraints`, `distributionLiability`.
2. **Aggregation** — Mission: parent project, related dataset, associated publication; catalog parent project = Mission title **or** Distribution field.
3. **Spatial step + grid + trajectory + providers** — `StepSpatial.jsx`; `spatial.*` + bbox / vertical on `mission.*`; `keywords.providers`.

## QA and documentation chain

1. **Production host:** deployed app + `/api/db`; see [PRODUCTION_QA_RUNBOOK.md](../PRODUCTION_QA_RUNBOOK.md).
2. **Static bundle:** same file, **Appendix A** of that runbook.
3. **Field inventory:** [METADATA_FIELD_MAP.md](../METADATA_FIELD_MAP.md) §2 / §7.
4. **XML alignment:** [OVERVIEW_TEMPLATE_ALIGNMENT.csv](../OVERVIEW_TEMPLATE_ALIGNMENT.csv).
5. **Program tracking:** [NOAA_UXS_MIGRATION_TRACKER.csv](../NOAA_UXS_MIGRATION_TRACKER.csv).

## Validation matrix (mission profile)

Generated from `src/profiles/mission/missionValidationRules.js` — **not** shown in the running app; open these files in the repo or on GitHub:

| File | What it is |
| ---- | ----------- |
| [docs/generated/mission-validation-by-field.generated.md](./docs/generated/mission-validation-by-field.generated.md) | **Field × rules:** one section per `pilotState` path, tables of every check. |
| [docs/generated/mission-validation-rules.generated.md](./docs/generated/mission-validation-rules.generated.md) | **Flat list** of all rules (good for search / diffs). |
| [docs/mission-validation-by-area.md](./docs/mission-validation-by-area.md) | Curated tables: GCMD facets, sensors, modes. |

Regenerate after changing rules: `npm run docs:mission-validation-rules`

## Suggested next increments

1. **METADATA_FIELD_MAP.md §7** — optional in-repo XSD for `validate:xml`.
2. **Accessibility** — `ACCESSIBILITY_VERIFICATION_CHECKLIST.md` on deployed builds.
3. **HTTP / DB** — keep `docs/DEPLOYMENT.md` in sync with your Netlify env (`DATABASE_URL`, CoMET proxy vars).
