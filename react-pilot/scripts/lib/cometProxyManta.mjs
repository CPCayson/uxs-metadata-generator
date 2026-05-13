/**
 * Headless CoMET via Netlify `comet-proxy` (same as app `validateIsoXml`).
 * @module scripts/lib/cometProxyManta
 */

export const DEFAULT_COMET_PROXY_BASE = 'http://127.0.0.1:8888/api/comet-proxy'
export const DEFAULT_VALIDATE_FILENAME = 'manta-preview.xml'

/**
 * GET `?action=sessionStatus` — no auth; confirms Netlify loaded `comet-proxy.mjs`.
 * Fails fast with actionable copy when dev was started from the wrong cwd (404 Function not found)
 * or plain Vite is answering (503 stub).
 *
 * @param {string} proxyBase e.g. `http://127.0.0.1:8888/api/comet-proxy`
 */
export async function assertCometProxyReachable(proxyBase) {
  const base = String(proxyBase || '').trim().replace(/\/$/, '')
  const url = `${base}?action=sessionStatus`
  let res
  try {
    res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Cannot reach CoMET proxy at ${base}\n` +
        `  (${msg})\n\n` +
        `Start Netlify dev from the react-pilot directory so functions load:\n` +
        `  cd react-pilot && npm run dev\n` +
        `Default URL: http://127.0.0.1:8888 — or set COMET_PROXY_URL to your dev origin.\n` +
        `From repo root: npm run pilot:dev\n`,
    )
  }
  const text = await res.text()
  const fnf = /function not found/i.test(text)
  if (res.status === 404 && fnf) {
    throw new Error(
      `CoMET proxy returned HTTP 404 "Function not found" at ${base}\n\n` +
        `Netlify did not load serverless functions. Common causes:\n` +
        `  • Dev server missing \`--functions netlify/functions\` (use \`cd react-pilot && npm run dev\` — \`scripts/run-netlify-dev.mjs\` passes this flag).\n` +
        `  • \`netlify dev\` was run from the wrong folder (no \`react-pilot/netlify.toml\`).\n\n` +
        `From repo root: \`npm run pilot:dev\`. Confirm the Netlify log shows \`Loaded function comet-proxy\`.\n`,
    )
  }
  if (res.status === 503) {
    let hint = text.trim().slice(0, 500)
    try {
      const j = JSON.parse(text)
      if (j && typeof j.error === 'string') hint = j.error
    } catch {
      /* keep raw */
    }
    throw new Error(
      `CoMET proxy at ${base} returned HTTP 503 (this origin is not serving Netlify functions).\n\n${hint}\n`,
    )
  }
  if (res.ok) {
    try {
      const data = JSON.parse(text)
      if (data && data.ok === true && 'hasCometSession' in data) return
    } catch {
      /* fall through */
    }
    if (/hasCometSession/.test(text)) return
  }
  throw new Error(
    `CoMET proxy health check failed: HTTP ${res.status} at ${url}\n` +
      (text.trim().slice(0, 280) || '(empty body)'),
  )
}

export function sessionPrefix(id) {
  const s = String(id || '').trim()
  if (!s) return '(none)'
  return `${s.slice(0, 8)}…`
}

/**
 * @param {string} proxyBase
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>} JSESSIONID
 */
export async function loginFreshSession(proxyBase, username, password) {
  const loginUrl = `${proxyBase.replace(/\/$/, '')}?action=login`
  const body = new URLSearchParams({ username, password }).toString()
  let res
  try {
    res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Login request failed: ${msg}`)
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Login: expected JSON, got HTTP ${res.status}: ${text.trim().slice(0, 200)}`)
  }

  if (!data?.ok) {
    const err = data?.error ? String(data.error) : 'not ok'
    throw new Error(`Login failed (${res.status}): ${err}`)
  }

  const jsessionid = String(data.jsessionid || '').trim()
  if (!jsessionid) {
    throw new Error('Login response ok but missing jsessionid')
  }

  return jsessionid
}

/**
 * @param {string} proxyBase
 * @param {string} jsessionid
 * @param {string} isoXml
 * @param {string} [filename]
 * @returns {Promise<{ res: Response, parsed: unknown, bodyText: string }>}
 */
export async function isoValidate(proxyBase, jsessionid, isoXml, filename = DEFAULT_VALIDATE_FILENAME) {
  const params = new URLSearchParams({ action: 'isoValidate', filename })
  const url = `${proxyBase.replace(/\/$/, '')}?${params}`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/json',
        'X-Comet-JSessionId': jsessionid,
      },
      body: isoXml,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`ISO validate request failed: ${msg}`)
  }

  const bodyText = await res.text()
  let parsed
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    parsed = { raw: bodyText }
  }

  return { res, parsed, bodyText }
}
