import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo-root legacy single-page wizard (served as `/legacy-main.html` for the React shell iframe). */
const LEGACY_INDEX_PATH = path.resolve(__dirname, '..', 'Index.html')

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const VITE_DB_STUB_MESSAGE =
  'Netlify function `/api/db` is not served by plain Vite. From `react-pilot/`, run `npm run dev` (Netlify dev, usually http://127.0.0.1:8888), or `npm run dev:with-api-proxy` while Netlify is up — see `.env.example`.'

/** Plain `vite` has no Netlify functions — respond to `POST /api/db` with a JSON error instead of 404 so HttpHostAdapter surfaces a clear message. */
function viteApiDbDevStub() {
  const body = JSON.stringify({ ok: false, error: VITE_DB_STUB_MESSAGE })
  return {
    name: 'vite-api-db-dev-stub',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path === '/api/db' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(body)
          return
        }
        next()
      })
    },
  }
}

const VITE_COMET_PROXY_STUB_MESSAGE =
  'Netlify function `/api/comet-proxy` is not served by plain Vite. From `react-pilot/`, run `npm run dev` (Netlify dev, usually http://127.0.0.1:8888). Split setup: keep that running, then either open 8888 only, or run `npm run dev:with-api-proxy` — see `.env.example`.'

/** Plain Vite has no `comet-proxy` — avoid a bare 404/HTML so CoMET UI shows this JSON instead of the generic resolver error. */
function viteApiCometProxyDevStub() {
  const body = JSON.stringify({ ok: false, error: VITE_COMET_PROXY_STUB_MESSAGE })
  return {
    name: 'vite-api-comet-proxy-dev-stub',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/api/comet-proxy')) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.statusCode = 503
        res.end(body)
      })
    },
  }
}

/** Plain `vite` has no Netlify functions — stub `/api/onestop-stats` to avoid 404 noise (use `npm run dev:netlify` for full `/api/db`, etc.). */
function viteOnestopStatsDevStub() {
  const body = JSON.stringify({
    ok: true,
    live: false,
    source: 'published-summary',
    href: 'https://data.noaa.gov/onestop/',
    collections: 111_024,
    granules: 12_856_284,
    note: 'Vite dev stub — run `npm run dev:netlify` for Netlify `/api/*` routes.',
  })
  return {
    name: 'vite-onestop-stats-dev-stub',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path === '/api/onestop-stats' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(body)
          return
        }
        next()
      })
    },
  }
}

/** Production (Netlify publish = `dist/`): rewrites live only in `dist/_redirects` so `netlify dev` does not apply a global `/*` from `netlify.toml`/`public/`. Netlify evaluates `_redirects` before `netlify.toml`, so list `/api/*` before the SPA rule. */
function viteNetlifySpaRedirects() {
  let outDir = 'dist'
  const rule = [
    '# Netlify: _redirects runs before netlify.toml — API before SPA catch-all.',
    '/api/* /.netlify/functions/:splat 200!',
    '# SPA fallback (build artifact; not used as `public/_redirects`).',
    '/* /index.html 200',
    '',
  ].join('\n')
  return {
    name: 'vite-netlify-spa-redirects',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      try {
        const dest = path.resolve(__dirname, outDir, '_redirects')
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, rule, 'utf8')
      } catch {
        /* non-fatal */
      }
    },
  }
}

/** Dev + build: expose parent `Index.html` at `legacy-main.html` for the “Form Wizard” legacy portal iframe. */
function viteLegacyMainHtml() {
  let outDir = 'dist'
  return {
    name: 'vite-legacy-main-html',
    configResolved(config) {
      outDir = config.build.outDir
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const p = req.url?.split('?')[0] ?? ''
        if (p !== '/legacy-main.html' && p !== '/legacy-main') return next()
        try {
          const html = fs.readFileSync(LEGACY_INDEX_PATH, 'utf8')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Legacy Index.html not found (expected ../Index.html from react-pilot/).')
        }
      })
    },
    closeBundle() {
      try {
        const dest = path.resolve(__dirname, outDir, 'legacy-main.html')
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(LEGACY_INDEX_PATH, dest)
      } catch {
        /* Optional: missing parent Index in some checkout layouts */
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const apiProxyTarget = String(env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || '').trim()
  /** Forward `/api/db` + `/api/comet-proxy` to Netlify dev (e.g. http://127.0.0.1:8888) while using plain Vite on :5173. */
  const proxyNetlify = apiProxyTarget
    ? {
        '/api/db': { target: apiProxyTarget, changeOrigin: true },
        '/api/comet-proxy': { target: apiProxyTarget, changeOrigin: true },
      }
    : undefined

  return {
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version || '0.0.0'),
    },
    plugins: [
      react(),
      ...(apiProxyTarget ? [] : [viteApiDbDevStub(), viteApiCometProxyDevStub()]),
      viteOnestopStatsDevStub(),
      viteLegacyMainHtml(),
      viteNetlifySpaRedirects(),
    ],
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['xmllint-wasm'],
    },
    server: {
      port: Number(process.env.PORT) || 5173,
      // Match netlify.toml [dev] targetPort when using `npm run dev` (Netlify). If 5173 is busy,
      // Netlify still proxies there → broken modules. `npm run dev:vite` + `VITE_RELAX_PORT=1` allows another port.
      strictPort: process.env.VITE_RELAX_PORT === '1' ? false : true,
      host: true,
      open: process.env.VITE_OPEN === '0' ? false : true,
      ...(proxyNetlify ? { proxy: proxyNetlify } : {}),
    },
  }
})
