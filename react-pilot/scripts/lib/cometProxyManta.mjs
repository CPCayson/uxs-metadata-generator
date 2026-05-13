/**
 * Headless CoMET via Netlify `comet-proxy` (same as app `validateIsoXml`).
 * @module scripts/lib/cometProxyManta
 */

export const DEFAULT_COMET_PROXY_BASE = 'http://127.0.0.1:8888/api/comet-proxy'
export const DEFAULT_VALIDATE_FILENAME = 'manta-preview.xml'

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
