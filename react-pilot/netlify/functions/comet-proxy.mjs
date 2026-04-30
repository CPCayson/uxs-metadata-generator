/**
 * Netlify serverless function — proxies requests to the CoMET REST API.
 *
 * CoMET API base: https://data.noaa.gov/cedit
 * Auth: JSESSIONID cookie (obtained via POST /login/wsLogin with username + password).
 *
 * Supported ?action= values:
 *   login       → POST /login/wsLogin  (form-urlencoded username + password)
 *   metaservLogin    → POST https://data.noaa.gov/metaserver/login/wsLogin
 *   get         → GET  /metadata/{uuid}?transform=convert-comet-to-iso19115-2
 *   search      → GET  /metadata/search?recordGroup=...&max=...&offset=...&since=...
 *   import      → POST /metadata/import?transform=convert-iso19115-2-to-comet&recordGroup=...&description=...
 *   update      → PUT  /metadata/{uuid}?transform=convert-iso19115-2-to-comet
 *   validate    → GET  /metadata/validate/{uuid}?transform=convert-comet-to-iso19115-2  (saved-record)
 *   rubric      → POST /recordServices/rubricV2     (ISO XML body → score JSON)
 *   resolver    → POST /recordServices/resolver     (ISO XML body → resolved XML)
 *   isoValidate → POST /recordServices/validate     (ISO XML body → validation JSON)
 *   metaservValidate → POST https://data.noaa.gov/metaserver/recordServices (legacy form-based isovalidatecheck)
 *   linkcheck   → POST /recordServices/linkcheck    (ISO XML body → link-check JSON)
 *
 * Environment variables (Netlify → Site config → Environment variables):
 *   COMET_BASE_URL      — https://data.noaa.gov/cedit  (no trailing slash)
 *   COMET_SESSION_ID    — JSESSIONID value from a valid CoMET session cookie.
 *   METASERVER_BASE_URL — https://data.noaa.gov/metaserver (no trailing slash; optional override)
 *   METASERVER_SESSION_ID — JSESSIONID for metaserver endpoints (optional; falls back to COMET_SESSION_ID)
 *
 *                         Obtain by calling the login action (or logging in at
 *                         data.noaa.gov/cedit and copying the cookie value).
 *
 * Auth note:
 *   CoMET uses form-based session auth (JSESSIONID cookie), NOT Bearer tokens.
 *   Store the JSESSIONID as COMET_SESSION_ID. It expires when the session ends,
 *   so refresh it periodically or use the login action to re-authenticate.
 */

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

function corsHeaders(req) {
  const origin = req.headers.get('origin') ?? ''
  const fromEnv = String(process.env.COMET_PROXY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  const allowlist = fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS
  const allowed = origin && allowlist.includes(origin)
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Comet-JSessionId, X-Metaserver-JSessionId',
  }
}

function jsonError(req, msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export default async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const COMET_BASE = (process.env.COMET_BASE_URL ?? 'https://data.noaa.gov/cedit').replace(/\/$/, '')
  const METASERVER_BASE = (process.env.METASERVER_BASE_URL ?? 'https://data.noaa.gov/metaserver').replace(/\/$/, '')
  const SESSION_ID = process.env.COMET_SESSION_ID ?? ''
  const METASERVER_SESSION_ID = process.env.METASERVER_SESSION_ID ?? SESSION_ID
  const headerSessionId = req.headers.get('x-comet-jsessionid') ?? ''
  const headerMetaserverSessionId = req.headers.get('x-metaserver-jsessionid') ?? ''
  const effectiveSessionId = headerSessionId || SESSION_ID
  const effectiveMetaserverSessionId = headerMetaserverSessionId || METASERVER_SESSION_ID

  const url    = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''
  const uuid   = url.searchParams.get('uuid')   ?? ''

  // Cookie header injected on every authenticated request
  const cookieHeader = effectiveSessionId ? { Cookie: `JSESSIONID=${effectiveSessionId}` } : {}
  const metaserverCookieHeader = effectiveMetaserverSessionId ? { Cookie: `JSESSIONID=${effectiveMetaserverSessionId}` } : {}

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (action === 'login') {
      if (req.method !== 'POST') return jsonError(req, 'login requires POST', 405)
      const body = await req.text() // expects application/x-www-form-urlencoded

      const upstream = await fetch(`${COMET_BASE}/login/wsLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: '*/*' },
        body,
        redirect: 'manual',
      })

      // Extract JSESSIONID from the Set-Cookie header so the client can store it
      const setCookie = upstream.headers.get('set-cookie') ?? ''
      const match     = setCookie.match(/JSESSIONID=([^;]+)/)
      const jsid      = match ? match[1] : null

      if (upstream.status === 201 || upstream.status === 200) {
        return new Response(JSON.stringify({ ok: true, jsessionid: jsid }), {
          status: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ ok: false, error: 'Bad credentials', status: upstream.status }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── METASERVER LOGIN (legacy XML form validator session) ───────────────
    if (action === 'metaservLogin') {
      if (req.method !== 'POST') return jsonError(req, 'metaservLogin requires POST', 405)
      const body = await req.text()

      const upstream = await fetch(`${METASERVER_BASE}/login/wsLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: '*/*' },
        body,
        redirect: 'manual',
      })

      const setCookie = upstream.headers.get('set-cookie') ?? ''
      const match = setCookie.match(/JSESSIONID=([^;]+)/)
      const jsid = match ? match[1] : null

      if (upstream.status === 201 || upstream.status === 200) {
        return new Response(JSON.stringify({ ok: true, jsessionid: jsid }), {
          status: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ ok: false, error: 'Bad credentials', status: upstream.status }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── SESSION STATUS (debug auth source: header vs env) ────────────────────
    if (action === 'sessionStatus') {
      return new Response(
        JSON.stringify({
          ok: true,
          hasCometSession: Boolean(effectiveSessionId),
          cometSessionSource: headerSessionId ? 'header' : SESSION_ID ? 'env' : 'none',
          hasMetaserverSession: Boolean(effectiveMetaserverSessionId),
          metaserverSessionSource: headerMetaserverSessionId ? 'header' : METASERVER_SESSION_ID ? 'env' : 'none',
        }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // ── GET (fetch record as ISO 19115-2 XML) ──────────────────────────────
    if (action === 'get') {
      if (!uuid) return jsonError(req, 'Missing required parameter: uuid')
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const upstream = await fetch(
        `${COMET_BASE}/metadata/${encodeURIComponent(uuid)}?transform=convert-comet-to-iso19115-2`,
        { method: 'GET', headers: { Accept: 'application/xml', ...cookieHeader }, redirect: 'manual' },
      )

      // 3xx = session expired — CoMET redirects to login page
      if (upstream.status >= 300 && upstream.status < 400) {
        return jsonError(req, 'CoMET session expired. Refresh COMET_SESSION_ID in Netlify env vars and redeploy.', 401)
      }

      if (upstream.status === 401 || upstream.status === 403) {
        return jsonError(req, 'CoMET access denied. Check COMET_SESSION_ID and ensure your account has access to this record.', 401)
      }

      if (upstream.status === 404) {
        return jsonError(req, `CoMET record not found: ${uuid}. Check the UUID is correct and the record exists in your account.`, 404)
      }

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/xml'

      // If CoMET returned HTML (login page) instead of XML, session has expired
      if (body.trim().toLowerCase().startsWith('<!doctype') || body.trim().toLowerCase().startsWith('<html')) {
        return jsonError(req, 'CoMET session expired. Refresh COMET_SESSION_ID in Netlify env vars and redeploy.', 401)
      }

      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── SEARCH (list records in an accessible record group) ─────────────────
    if (action === 'search') {
      const recordGroup = url.searchParams.get('recordGroup') ?? ''
      if (!recordGroup) return jsonError(req, 'Missing required parameter: recordGroup')
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const searchUrl = new URL(`${COMET_BASE}/metadata/search`)
      searchUrl.searchParams.set('recordGroup', recordGroup)

      const max = url.searchParams.get('max')
      const offset = url.searchParams.get('offset')
      const since = url.searchParams.get('since')
      const editState = url.searchParams.get('editState')
      if (max) searchUrl.searchParams.set('max', max)
      if (offset) searchUrl.searchParams.set('offset', offset)
      if (since) searchUrl.searchParams.set('since', since)
      if (editState) searchUrl.searchParams.set('editState', editState)
      searchUrl.searchParams.set('format', 'json')

      const upstream = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json', ...cookieHeader },
        redirect: 'manual',
      })
      const body = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── IMPORT (create new record from ISO 19115-2 XML) ───────────────────
    if (action === 'import') {
      if (req.method !== 'POST') return jsonError(req, 'import requires POST', 405)
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const recordGroup = url.searchParams.get('recordGroup') ?? ''
      const description = url.searchParams.get('description') ?? ''

      if (!recordGroup) return jsonError(req, 'Missing required parameter: recordGroup')
      if (!description) return jsonError(req, 'Missing required parameter: description')

      const xmlBody = await req.text()
      const importUrl = new URL(`${COMET_BASE}/metadata/import`)
      importUrl.searchParams.set('transform',   'convert-iso19115-2-to-comet')
      importUrl.searchParams.set('recordGroup', recordGroup)
      importUrl.searchParams.set('description', description)
      if (uuid) importUrl.searchParams.set('uuid', uuid)

      const upstream = await fetch(importUrl.toString(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json', ...cookieHeader },
        body:    xmlBody,
      })

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── UPDATE (replace existing record with ISO 19115-2 XML) ─────────────
    if (action === 'update') {
      if (req.method !== 'POST') return jsonError(req, 'update requires POST', 405)
      if (!uuid) return jsonError(req, 'Missing required parameter: uuid')
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const xmlBody = await req.text()
      const putUrl  = new URL(`${COMET_BASE}/metadata/${encodeURIComponent(uuid)}`)
      putUrl.searchParams.set('transform', 'convert-iso19115-2-to-comet')

      const description = url.searchParams.get('description')
      if (description) putUrl.searchParams.set('description', description)

      const upstream = await fetch(putUrl.toString(), {
        method:  'PUT',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json', ...cookieHeader },
        body:    xmlBody,
      })

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── VALIDATE (server-side validate via CoMET) ─────────────────────────
    if (action === 'validate') {
      if (!uuid) return jsonError(req, 'Missing required parameter: uuid')
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const upstream = await fetch(
        `${COMET_BASE}/metadata/validate/${encodeURIComponent(uuid)}?transform=convert-comet-to-iso19115-2`,
        { method: 'GET', headers: { Accept: 'application/json', ...cookieHeader } },
      )

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── RUBRIC (Rubric V2 score from ISO 19115-2 XML body) ────────────────
    if (action === 'rubric') {
      if (req.method !== 'POST') return jsonError(req, 'rubric requires POST', 405)
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const filename = url.searchParams.get('filename') ?? 'record.xml'
      const xmlBody  = await req.text()

      const upstream = await fetch(`${COMET_BASE}/recordServices/rubricV2?filename=${encodeURIComponent(filename)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json', ...cookieHeader },
        body:    xmlBody,
      })

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── RESOLVER (resolve XLinks in ISO 19115-2 XML) ─────────────────────
    if (action === 'resolver') {
      if (req.method !== 'POST') return jsonError(req, 'resolver requires POST', 405)
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const xmlBody  = await req.text()
      const upstream = await fetch(`${COMET_BASE}/recordServices/resolver`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/xml', ...cookieHeader },
        body:    xmlBody,
      })

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/xml'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── ISO VALIDATE (raw ISO XML schema/schematron validate) ─────────────
    // Distinct from action=validate which validates a *saved* record by UUID.
    if (action === 'isoValidate') {
      if (req.method !== 'POST') return jsonError(req, 'isoValidate requires POST', 405)
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const filename = url.searchParams.get('filename') ?? 'record.xml'
      const xmlBody  = await req.text()

      const upstream = await fetch(
        `${COMET_BASE}/recordServices/validate?filename=${encodeURIComponent(filename)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/xml', Accept: 'application/json', ...cookieHeader },
          body:    xmlBody,
        },
      )

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── METASERVER VALIDATE (legacy form submit; mirrors metaserv-valid.sh) ─
    if (action === 'metaservValidate') {
      if (req.method !== 'POST') return jsonError(req, 'metaservValidate requires POST', 405)
      if (!effectiveMetaserverSessionId) {
        return jsonError(req, 'No MetaServer JSESSIONID available. Log in from the app or set METASERVER_SESSION_ID.', 401)
      }

      const filename = url.searchParams.get('filename') ?? 'record.xml'
      const xmlBody = await req.text()
      const form = new FormData()
      form.set('inputLocation', 'file')
      form.set('recordAction', 'isovalidatecheck')
      form.set('submit', 'Submit')
      form.set('filename', new Blob([xmlBody], { type: 'application/xml' }), filename)

      const upstream = await fetch(`${METASERVER_BASE}/recordServices`, {
        method: 'POST',
        headers: { Accept: '*/*', ...metaserverCookieHeader },
        body: form,
      })

      const body = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'text/html; charset=utf-8'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    // ── LINK CHECK (check URLs referenced in ISO 19115-2 XML) ────────────
    if (action === 'linkcheck') {
      if (req.method !== 'POST') return jsonError(req, 'linkcheck requires POST', 405)
      if (!effectiveSessionId) return jsonError(req, 'No CoMET JSESSIONID available. Log in from the app or set COMET_SESSION_ID.', 401)

      const xmlBody  = await req.text()
      const upstream = await fetch(`${COMET_BASE}/recordServices/linkcheck`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json', ...cookieHeader },
        body:    xmlBody,
      })

      const body        = await upstream.text()
      const contentType = upstream.headers.get('Content-Type') ?? 'application/json'
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type': contentType } })
    }

    return jsonError(req, `Unknown action: "${action}". Valid actions: login, metaservLogin, sessionStatus, get, search, import, update, validate, rubric, resolver, isoValidate, metaservValidate, linkcheck`)

  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
}

