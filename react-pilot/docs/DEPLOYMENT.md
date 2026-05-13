# Deployment (this project)

**Runtime:** the **React pilot** is built with Vite and shipped as a static web app. Persistence and server-backed actions use **`HttpHostAdapter`** → **`POST /api/db`** (see `src/adapters/http/HttpHostAdapter.js` and `netlify/functions/db.mjs`).

**Netlify site settings (monorepo):** set **Base directory** to `react-pilot` so Netlify reads `react-pilot/netlify.toml` (build command `npm run build`, publish `dist`, functions `netlify/functions`). **`NODE_VERSION`** for CI builds is pinned in that file (currently **22**).

| Environment | Host bridge | Notes |
| --- | --- | --- |
| **Local dev** | `HttpHostAdapter` | Run **`npm run dev`** from `react-pilot/` (**Netlify dev**, default **http://127.0.0.1:8888**) so **`/api/db`** and the UI share an origin. Use **`npm run dev:vite`** only for Vite-only HMR (no functions unless you also run Netlify and set **`API_PROXY_TARGET`**). |
| **Production (Netlify)** | `HttpHostAdapter` | Same-origin `fetch('/api/db', …)`. Postgres-backed handlers need `DATABASE_URL`. **`generateGeoJSON`**, **`generateDCAT`**, and **`validateOnServer`** are implemented in `netlify/functions/db.mjs`. |

Canonical UI state remains **`pilotState`** in the browser. The adapter `pilotStateToLegacyFormData` shapes payloads for handlers that expect the historical `collectFormData()` JSON layout.

## CoMET (local push from EUT samples)

Start the proxy with **`npm run dev`** (from `react-pilot/`), set `COMET_SESSION_ID` to your JSESSIONID from the app or `action=login` (do not commit it). From `react-pilot/`: `COMET_SESSION_ID='…' node scripts/push-manta-sample-to-comet.mjs --file "../MANTA End User Testing/samples/foo.xml" --record-group YOUR_RG`. Use `--uuid …` instead of `--record-group` to update an existing record; optional `COMET_PROXY_URL` overrides the default `http://127.0.0.1:8888/api/comet-proxy`.

**CoMET ISO validate (no long-lived `COMET_SESSION_ID`):** With **`npm run dev`** running, from `react-pilot/`:

```bash
COMET_USERNAME='your_user' COMET_PASSWORD='your_pass' node scripts/validate-manta-sample-comet.mjs --file "../MANTA End User Testing/samples/foo.xml"
```

Each run posts form login to the proxy (`action=login`), keeps the returned JSESSIONID in memory for that run only, rebuilds preview like the push script, then POSTs `action=isoValidate` (same as `validateIsoXml` in `cometClient.js`). Override the proxy base with `COMET_PROXY_URL` if needed. Do not commit credentials.
