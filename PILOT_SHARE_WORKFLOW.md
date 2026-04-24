# React Pilot Sharing Workflow

This document complements the root [README.md](README.md) and [react-pilot/docs/DEPLOYMENT.md](react-pilot/docs/DEPLOYMENT.md) (HTTP-only pilot). [PRODUCTION_QA_RUNBOOK.md](PRODUCTION_QA_RUNBOOK.md) **Appendix A** covers this static bundle. Field-level expectations are in [METADATA_FIELD_MAP.md](METADATA_FIELD_MAP.md) (§7 React matrix).

## Goal

Allow stakeholders to review the React scaffold in a browser without installing React, Node, or development tooling.

## Developer workflow (Vite / hot reload)

For day-to-day UI work, run the Vite dev server so edits hot-reload in the browser (no `pilot-share/` copy each time).

From project root (requires `npm install` once under `react-pilot/`):

```bash
npm run pilot:dev
```

Or from `react-pilot/`:

```bash
npm run dev
```

By default this serves at **[http://localhost:5173](http://localhost:5173)** with HMR. It does **not** replace the static `python3 -m http.server … pilot-share` flow; publish when you need a portable folder or the same port as reviewers (e.g. 4173).

## One-Command Publish

From project root:

```bash
npm --prefix react-pilot run publish
```

Shorthand:

```bash
npm run pilot:publish
```

This command:

1. Builds the pilot (`react-pilot/dist`).
2. Copies output into `pilot-share/`.
3. Writes `pilot-share/README.txt` with quick preview instructions.

## One-Command Publish + Zip

From project root:

```bash
npm --prefix react-pilot run publish:zip
```

This command:

1. Runs the same publish workflow.
2. Creates a timestamped zip in project root, for example:
  - `pilot-share-20260413-191530.zip`

## What to Share

Share the `pilot-share/` folder contents (or zip it) with reviewers or host it on an internal web server.

Reviewers only need:

- A modern web browser.
- A URL served over HTTP/HTTPS (or a local server).

## Local Preview for Non-Developers

If someone receives the folder and wants to preview locally:

```bash
python3 -m http.server 4173 --directory pilot-share
```

Then open:

- `http://localhost:4173/` — React pilot (static build; no same-origin `/api/db` unless proxied).

Alignment review: cross-check pilot steps with [METADATA_FIELD_MAP.md](METADATA_FIELD_MAP.md) §7 and [OVERVIEW_TEMPLATE_ALIGNMENT.csv](OVERVIEW_TEMPLATE_ALIGNMENT.csv) for XML section coverage.

## Important Notes

- Do not open `index.html` directly via `file://`; module loading may fail in some browsers.
- Host-backed actions (templates, platform library, server validation) need the same origin as a working `/api/db` (e.g. open the deployed Netlify URL, or run `netlify dev`).
- Visual and interaction review works in any normal browser-hosted context.

## Recommended Review Process

1. Publish latest build with the command above.
2. Share link or zipped `pilot-share/` package.
3. Collect UI feedback (theme, layout, field readability, keyboard behavior).
4. Track feedback items in migration tracker artifacts.

