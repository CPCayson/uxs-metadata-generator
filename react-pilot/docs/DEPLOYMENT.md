# Deployment (this project)

**Runtime:** the **React pilot** is built with Vite and shipped as a static web app. Persistence and server-backed actions use **`HttpHostAdapter`** → **`POST /api/db`** (see `src/adapters/http/HttpHostAdapter.js` and `netlify/functions/db.mjs`).

**Netlify site settings (monorepo):** set **Base directory** to `react-pilot` so Netlify reads `react-pilot/netlify.toml` (build command `npm run build`, publish `dist`, functions `netlify/functions`). **`NODE_VERSION`** for CI builds is pinned in that file (currently **22**).

| Environment | Host bridge | Notes |
| --- | --- | --- |
| **Local dev** | `HttpHostAdapter` | Run `npm run dev` (Vite). `/api/db` is available when you use **`netlify dev`** so the app and function share an origin. |
| **Production (Netlify)** | `HttpHostAdapter` | Same-origin `fetch('/api/db', …)`. Postgres-backed handlers need `DATABASE_URL`. **`generateGeoJSON`**, **`generateDCAT`**, and **`validateOnServer`** are implemented in `netlify/functions/db.mjs`. |

Canonical UI state remains **`pilotState`** in the browser. The adapter `pilotStateToLegacyFormData` shapes payloads for handlers that expect the historical `collectFormData()` JSON layout.
