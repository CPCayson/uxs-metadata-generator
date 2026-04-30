/**
 * Netlify serverless function — proxies queries to the InfoBroker XML-RPC server.
 *
 * InfoBroker endpoint: https://broker01-dev.ncei.noaa.gov:2551
 * Auth: HTTP Basic credentials should come from OER_BROKER_URL env var only.
 * Protocol: XML-RPC over HTTP POST — request body is an XML-RPC <methodCall>.
 *
 * Routes (POST body: JSON):
 *   { fn: 'ping' }                         → health check, no upstream call
 *   { table: string, cruiseid?: string, search?: string, limit?: number }
 *     → infoBroker.queryPostgres('oer_metadata', table, [], filters)
 *
 * Environment variable (optional override):
 *   OER_BROKER_URL — full base URL (no trailing slash); defaults to the dev broker above.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * Build a minimal XML-RPC <methodCall> string for infoBroker.queryPostgres.
 *
 * Signature: queryPostgres(schema, table, columns[], filters{})
 *
 * @param {string} schema   - e.g. 'oer_metadata'
 * @param {string} table    - e.g. 'view_metadata'
 * @param {Record<string, string>} filters - e.g. { cruiseid: 'EX-22-01' }
 */
function buildQueryPostgresXml(schema, table, filters) {
  const filterMembers = Object.entries(filters)
    .map(([k, v]) => `<member><name>${escXml(k)}</name><value><string>${escXml(v)}</string></value></member>`)
    .join('')

  return `<?xml version="1.0"?>
<methodCall>
  <methodName>infoBroker.queryPostgres</methodName>
  <params>
    <param><value><string>${escXml(schema)}</string></value></param>
    <param><value><string>${escXml(table)}</string></value></param>
    <param><value><array><data></data></array></value></param>
    <param><value><struct>${filterMembers}</struct></value></param>
  </params>
</methodCall>`
}

/** Minimal XML character escaping for values injected into XML-RPC body. */
function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Parse the XML-RPC <methodResponse> text and return the inner data as a
 * JavaScript value. Only handles the struct-of-arrays shape InfoBroker returns
 * for queryPostgres (an array of structs, each struct is one DB row).
 *
 * Falls back to returning the raw XML string if parsing fails so callers can
 * at least surface a useful error.
 */
function parseXmlRpcResponse(xmlText) {
  // Extract <fault> early so we can surface a clean error message.
  if (xmlText.includes('<fault>')) {
    const msgMatch = xmlText.match(/<name>faultString<\/name>\s*<value><string>([\s\S]*?)<\/string><\/value>/)
    const codeMatch = xmlText.match(/<name>faultCode<\/name>\s*<value><int>([\s\S]*?)<\/int><\/value>/)
    const msg = msgMatch ? msgMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : 'XML-RPC fault'
    const code = codeMatch ? Number(codeMatch[1]) : 0
    throw Object.assign(new Error(`InfoBroker fault ${code}: ${msg}`), { faultCode: code })
  }

  // Pull the outermost <array><data> block which contains one <value> per row.
  const dataMatch = xmlText.match(/<array>\s*<data>([\s\S]*?)<\/data>\s*<\/array>/)
  if (!dataMatch) return []

  const rowsXml = dataMatch[1]
  const rows = []

  // Each row is a <value><struct>…</struct></value>
  const structRe = /<value>\s*<struct>([\s\S]*?)<\/struct>\s*<\/value>/g
  let structMatch
  while ((structMatch = structRe.exec(rowsXml)) !== null) {
    const memberRe = /<member>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g
    const row = {}
    let memberMatch
    while ((memberMatch = memberRe.exec(structMatch[1])) !== null) {
      const key = memberMatch[1].trim()
      // Strip the inner type tag (<string>, <int>, <boolean>, <nil/>, etc.)
      const rawVal = memberMatch[2].trim()
      const inner = rawVal.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '').trim()
      row[key] = inner
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
    }
    rows.push(row)
  }

  return rows
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') return jsonError('Only POST is supported', 405)

  let body
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be JSON')
  }

  // ── Health check — no upstream call ──────────────────────────────────────
  if (body?.fn === 'ping') {
    return jsonOk({ ok: true, ts: new Date().toISOString() })
  }

  // ── queryPostgres ─────────────────────────────────────────────────────────
  const { table, cruiseid, search, limit } = body ?? {}

  if (!table || typeof table !== 'string') {
    return jsonError('Missing required field: table')
  }
  const ALLOWED_TABLES = new Set(['view_metadata'])
  if (!ALLOWED_TABLES.has(table)) {
    return jsonError(`Unsupported table "${table}". Allowed: ${Array.from(ALLOWED_TABLES).join(', ')}`, 400)
  }

  const numericLimit = Number.parseInt(String(limit ?? ''), 10)
  const safeLimit = Number.isFinite(numericLimit) && numericLimit > 0
    ? Math.min(numericLimit, 2000)
    : 500

  /** @type {Record<string, string>} */
  const filters = {}
  if (cruiseid) filters.cruiseid = String(cruiseid)
  if (search && String(search).trim()) filters.search = String(search).trim()
  filters.limit = String(safeLimit)
  const xmlBody = buildQueryPostgresXml('oer_metadata', table, filters)

  const brokerUrl = process.env.OER_BROKER_URL ?? ''
  if (!brokerUrl.trim()) {
    return jsonError('OER_BROKER_URL is not configured on the server environment.', 500)
  }
  const BROKER_BASE = brokerUrl.replace(/\/$/, '')

  try {
    const upstream = await fetch(`${BROKER_BASE}/RPC2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        Accept: 'text/xml',
        'User-Agent': 'Manta-OER-Proxy/1.0',
      },
      body: xmlBody,
    })

    const text = await upstream.text()

    if (!upstream.ok) {
      return jsonError(`InfoBroker returned HTTP ${upstream.status}: ${text.slice(0, 200)}`, 502)
    }

    let rows
    try {
      rows = parseXmlRpcResponse(text)
    } catch (parseErr) {
      return jsonError(parseErr instanceof Error ? parseErr.message : String(parseErr), 502)
    }

    return jsonOk({ ok: true, rows })

  } catch (err) {
    // Network-level failure (DNS, TLS, timeout) — caller should set mode='offline'.
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
}
