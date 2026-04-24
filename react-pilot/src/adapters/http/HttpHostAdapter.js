/**
 * HttpHostAdapter — implements HostBridge over the Netlify DB function (/api/db).
 *
 * In production (Netlify): calls /api/db (same-origin, no CORS) for Postgres CRUD plus
 * `generateGeoJSON`, `generateDCAT`, `validateOnServer`, and `lensScan` (stateless; no DATABASE_URL required).
 * In local dev: run `netlify dev` — the function is served at http://localhost:8888/api/db.
 *
 * @module adapters/http/HttpHostAdapter
 */

// In prod the app is served from the same origin as the function so /api/db works.
// In local dev netlify dev proxies everything on port 8888.
const DB_URL = '/api/db'

/**
 * Posts a function call to the DB API function.
 * @param {string} fn
 * @param {unknown[]} args
 * @returns {Promise<unknown>}
 */
async function call(fn, args = []) {
  const res = await fetch(DB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args }),
  })

  if (!res.ok) {
    throw new Error(`HttpHostAdapter: HTTP ${res.status} calling ${fn}`)
  }

  const payload = await res.json()
  if (!payload.ok) {
    throw new Error(`HttpHostAdapter: DB error in ${fn}: ${payload.error}`)
  }
  return payload.result
}

/**
 * Normalises an array result into the standard HostBridge list shape.
 */
function toListResult(raw) {
  const rows = Array.isArray(raw) ? raw : []
  return { rows, unexpectedShape: !Array.isArray(raw), raw }
}

/**
 * Creates an HttpHostAdapter that implements the HostBridge interface.
 * @returns {import('../HostBridge.js').HostBridge}
 */
export function createHttpHostAdapter() {
  return {
    isAvailable() {
      return true
    },

    async listTemplates() {
      return toListResult(await call('getTemplates'))
    },

    async loadTemplate(name) {
      return call('getTemplate', [name])
    },

    async saveTemplate(template) {
      return call('saveTemplate', [template])
    },

    async listPlatforms() {
      return toListResult(await call('getPlatforms'))
    },

    async savePlatform(platform) {
      return call('savePlatform', [platform])
    },

    async listSensors() {
      return toListResult(await call('getSensors'))
    },

    async saveSensor(sensor) {
      return call('saveSensor', [sensor])
    },

    async saveSensorsBatch(sensors) {
      return call('saveSensorsBatch', [sensors])
    },

    async validateOnServer(formData, level) {
      return call('validateOnServer', [formData, level])
    },

    async generateGeoJSON(formData) {
      return call('generateGeoJSON', [formData])
    },

    async generateDCAT(formData) {
      return call('generateDCAT', [formData])
    },

    async lensScan(payload) {
      return call('lensScan', [payload])
    },
  }
}
