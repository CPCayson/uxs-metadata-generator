import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Repo-root legacy single-page wizard (served as `/legacy-main.html` for the React shell iframe). */
const LEGACY_INDEX_PATH = path.resolve(__dirname, '..', 'Index.html')

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const VITE_DB_STUB_MESSAGE =
  'Netlify function `/api/db` is not served by plain Vite. From `react-pilot/`, run `npm run dev:netlify` and open the URL Netlify prints (usually http://localhost:8888) so `/api/db` is available.'

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
export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version || '0.0.0'),
  },
  plugins: [react(), viteApiDbDevStub(), viteOnestopStatsDevStub(), viteLegacyMainHtml()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    // If 5173 is taken, pick the next free port so `npm run dev` still starts.
    // Netlify dev still targets 5173 via netlify.toml when this instance owns it.
    strictPort: false,
    host: true,
    open: process.env.VITE_OPEN === '0' ? false : true,
  },
})
