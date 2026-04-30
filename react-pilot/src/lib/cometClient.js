/**
 * CoMET REST API client.
 *
 * All requests are routed through /api/comet-proxy (Netlify function) which
 * handles CORS and injects the NOAA JSESSIONID cookie.
 *
 * CoMET API base: https://data.noaa.gov/cedit
 * Auth:           JSESSIONID cookie (form login, NOT Bearer token)
 * OpenAPI spec:   https://data.noaa.gov/cedit/openApiDoc.html
 *
 * Exports
 *   loginToComet(username, password)          → { ok, jsessionid }
 *   loginToMetaserver(username, password)     → { ok, jsessionid }
 *   fetchCometRecord(uuid)                    → ISO 19115-2 XML string
 *   pushCometRecord(uuid, xml, opts)          → { ok, uuid, cometUrl, message }
 *   getRubricScore(uuid, xml)                 → { totalScore, categories }
 *   resolveXlinks(isoXml)                     → resolved XML string        [preflight step 1]
 *   validateIsoXml(isoXml, filename?)         → CoMET validate response    [preflight step 2]
 *   validateIsoXmlViaMetaserver(isoXml, filename?) → metaserver response body
 *   checkLinks(isoXml)                        → CoMET link-check response  [preflight step 3]
 *   detectGaps(pilotState, profile?)          → string[]  (profile.entityType routes BEDI vs mission)
 *   extractUuid(input)                        → string
 *   searchCometMetadata(opts)                 → { rows } (GET /metadata/search via proxy)
 *   rankCometRowsByQuery(rows, query, top?)   → client-side similarity filter / sort
 *   readCometRecordGroup / writeCometRecordGroup → session persistence for widget
 */

import { metadataListFromCometSearchJson } from './cometSearchPayload.js'

const PROXY = '/api/comet-proxy'
const KNOWN_UUIDS_KEY = 'manta.comet.knownUuids'
const COMET_RG_SESSION_KEY = 'manta.comet.recordGroup'
const COMET_AUTH_KEY = 'manta.comet.auth.v1'
const COMET_AUTH_TTL_MS = 1000 * 60 * 90 // 90 minutes

const PROXY_MISSING_HINT =
  `CoMET proxy not found (404) at ${PROXY}. Use Netlify Dev / deploy functions, or route /api/comet-proxy to the comet-proxy function.`

/**
 * @param {string} url
 * @param {Parameters<typeof fetch>[1]} [init]
 * @returns {Promise<Response>}
 */
async function _fetchCometProxy(url, init) {
  const auth = readCometAuth()
  const mergedHeaders = {
    ...(init?.headers || {}),
  }
  if (auth.cometSessionId) mergedHeaders['X-Comet-JSessionId'] = auth.cometSessionId
  if (auth.metaserverSessionId) mergedHeaders['X-Metaserver-JSessionId'] = auth.metaserverSessionId
  try {
    return await fetch(url, { ...init, headers: mergedHeaders })
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    throw new Error(`CoMET request failed (network). Check that ${PROXY} is reachable. ${why}`)
  }
}

/**
 * Human-readable detail for a failed proxy response (body already read as text).
 *
 * @param {number} status
 * @param {string} bodyText
 * @returns {string}
 */
function _detailForFailedResponse(status, bodyText) {
  const slice = (bodyText || '').trim().slice(0, 400)
  if (slice.toLowerCase().startsWith('<!doctype') || slice.toLowerCase().startsWith('<html'))
    return slice.slice(0, 180) || 'HTML response (session or proxy misconfigured).'
  try {
    const j = JSON.parse(slice || '{}')
    if (j?.error) return String(j.error)
    if (j?.message) return String(j.message)
  } catch { /* */ }
  if (status === 404) return PROXY_MISSING_HINT
  return slice.slice(0, 200) || `HTTP ${status}`
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate with CoMET and return the JSESSIONID.
 * The caller is responsible for storing the session ID (e.g. sessionStorage)
 * and passing it to the Netlify env, or simply calling this once per session.
 *
 * @param {string} username  NOAA @noaa.gov email
 * @param {string} password
 * @returns {Promise<{ ok: boolean, jsessionid: string|null }>}
 */
export async function loginToComet(username, password) {
  const body = new URLSearchParams({ username, password }).toString()
  const res  = await _fetchCometProxy(`${PROXY}?action=login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({ ok: false }))
  const out = { ok: !!data.ok, jsessionid: data.jsessionid ?? null }
  if (out.ok && out.jsessionid) {
    const cur = readCometAuth()
    writeCometAuth({ ...cur, cometSessionId: out.jsessionid })
  }
  return out
}

/**
 * Authenticate with NOAA metaserver legacy validation endpoint.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ ok: boolean, jsessionid: string|null }>}
 */
export async function loginToMetaserver(username, password) {
  const body = new URLSearchParams({ username, password }).toString()
  const res = await _fetchCometProxy(`${PROXY}?action=metaservLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({ ok: false }))
  const out = { ok: !!data.ok, jsessionid: data.jsessionid ?? null }
  if (out.ok && out.jsessionid) {
    const cur = readCometAuth()
    writeCometAuth({ ...cur, metaserverSessionId: out.jsessionid })
  }
  return out
}

/**
 * Query proxy for effective auth status (header vs env source).
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   hasCometSession: boolean,
 *   cometSessionSource: 'header'|'env'|'none',
 *   hasMetaserverSession: boolean,
 *   metaserverSessionSource: 'header'|'env'|'none',
 * }>}
 */
export async function getCometAuthStatus() {
  const res = await _fetchCometProxy(`${PROXY}?action=sessionStatus`, { method: 'GET' })
  const body = await res.text().catch(() => '{}')
  if (!res.ok) {
    throw new Error(`CoMET auth status failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }
  try { return JSON.parse(body) } catch { return { ok: false, hasCometSession: false, cometSessionSource: 'none', hasMetaserverSession: false, metaserverSessionSource: 'none' } }
}

/**
 * Clear locally stored proxy header sessions.
 */
export function clearCometAuth() {
  writeCometAuth({ cometSessionId: '', metaserverSessionId: '' })
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch an existing CoMET record as ISO 19115-2 XML.
 * Uses transform=convert-comet-to-iso19115-2.
 *
 * @param {string} uuidOrUrl  CoMET UUID or full CoMET URL
 * @returns {Promise<string>} Raw ISO 19115-2 XML string
 */
export async function fetchCometRecord(uuidOrUrl) {
  const uuid = extractUuid(uuidOrUrl)
  if (!uuid) throw new Error('Invalid CoMET UUID or URL.')

  const res = await _fetchCometProxy(`${PROXY}?action=get&uuid=${encodeURIComponent(uuid)}`, {
    headers: { Accept: 'application/xml' },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CoMET fetch failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }

  const text = await res.text()

  // Empty body = skeleton record (e.g. created by Send2NCEI/ATRAC but not yet authored).
  // Return null so the caller can treat it as "load defaults + show all gaps".
  if (!text.trim()) return null

  if (!text.trim().startsWith('<')) {
    throw new Error('CoMET returned a non-XML response. Your session may have expired — refresh COMET_SESSION_ID in Netlify.')
  }
  return text
}

// ── Metadata search (record group → UUIDs) ────────────────────────────────────

/**
 * @param {{ recordGroup: string, max?: number, offset?: number, since?: string, editState?: string }} opts
 * @returns {Promise<{ rows: Array<{ uuid: string, fileIdentifier: string, name: string, editState: string }>, raw: object }>}
 */
export async function searchCometMetadata(opts) {
  const recordGroup = String(opts?.recordGroup || '').trim()
  if (!recordGroup) throw new Error('recordGroup is required for CoMET search.')

  const params = new URLSearchParams({
    action: 'search',
    recordGroup,
    format: 'json',
  })
  const max = opts.max ?? 200
  params.set('max', String(max))
  if (opts.offset != null && opts.offset !== '') params.set('offset', String(opts.offset))
  if (opts.since) params.set('since', opts.since)
  if (opts.editState) params.set('editState', opts.editState)

  const res = await _fetchCometProxy(`${PROXY}?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const body = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(`CoMET search failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }
  let parsed = null
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('CoMET search returned non-JSON (session expired or proxy error).')
  }
  const rawList = metadataListFromCometSearchJson(parsed)
  const rows = rawList
    .map((r) => ({
      uuid: String(r.uuid || '').trim(),
      fileIdentifier: String(r.fileIdentifier || '').trim(),
      name: String(r.name || '').trim(),
      editState: String(r.editState || '').trim(),
    }))
    .filter((r) => r.uuid)
  return { rows, raw: parsed }
}

/**
 * Match helper — same behavior as `scripts/swarm/search-comet-similar.mjs`.
 *
 * @param {string} query
 * @param {string} value
 */
function _cometTextSimilarity(query, value) {
  const q = String(query || '').trim().toLowerCase()
  const v = String(value || '').trim().toLowerCase()
  if (!q || !v) return 0
  if (v === q) return 1
  if (v.includes(q)) return 0.93
  const qParts = q.split(/[^a-z0-9]+/).filter(Boolean)
  if (!qParts.length) return 0
  const hits = qParts.filter((p) => v.includes(p)).length
  return Math.min(0.9, hits / qParts.length)
}

/**
 * Rank search rows by fuzzy match on fileIdentifier, name, or uuid substring.
 *
 * @param {Array<{ uuid: string, fileIdentifier: string, name: string, editState: string }>} rows
 * @param {string} query
 * @param {number} [top]
 */
export function rankCometRowsByQuery(rows, query, top = 50) {
  const q = String(query || '').trim()
  if (!q) return rows.slice(0, Math.max(1, top))
  const ranked = rows
    .map((r) => ({
      ...r,
      score: Math.max(
        _cometTextSimilarity(q, r.fileIdentifier),
        _cometTextSimilarity(q, r.name),
        _cometTextSimilarity(q, r.uuid),
      ),
    }))
    .filter((r) => r.score >= 0.25)
    .sort((a, b) => (b.score - a.score) || a.fileIdentifier.localeCompare(b.fileIdentifier))
  return ranked.slice(0, Math.max(1, top))
}

/**
 * @returns {string}
 */
export function readCometRecordGroup() {
  try {
    return String(window.sessionStorage.getItem(COMET_RG_SESSION_KEY) || '').trim()
  } catch {
    return ''
  }
}

/**
 * @param {string} recordGroup
 */
export function writeCometRecordGroup(recordGroup) {
  try {
    const s = String(recordGroup || '').trim()
    if (s) window.sessionStorage.setItem(COMET_RG_SESSION_KEY, s)
    else window.sessionStorage.removeItem(COMET_RG_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

// ── Push ──────────────────────────────────────────────────────────────────────

/**
 * Push a refined ISO 19115-2 XML record to CoMET.
 *
 * - If the UUID already exists in CoMET: calls PUT /metadata/{uuid}  (update).
 * - If no UUID is supplied (new record):  calls POST /metadata/import (create).
 *
 * @param {string} uuidOrUrl  UUID of the existing CoMET record (for update)
 * @param {string} isoXml     Full ISO 19115-2 XML string
 * @param {{ recordGroup?: string, description?: string }} [opts]
 * @returns {Promise<{ ok: boolean, uuid: string, cometUrl: string, message: string }>}
 */
export async function pushCometRecord(uuidOrUrl, isoXml, opts = {}) {
  if (!isoXml?.trim()) throw new Error('No XML to push.')

  const uuid  = extractUuid(uuidOrUrl)
  const rg    = opts.recordGroup ?? ''
  const desc  = opts.description ?? ''

  let endpoint
  let method

  if (uuid) {
    // Update existing record via PUT /metadata/{uuid}
    const params = new URLSearchParams({ action: 'update', uuid })
    if (desc) params.set('description', desc)
    endpoint = `${PROXY}?${params}`
    method   = 'POST' // proxy translates to PUT
  } else {
    // Create new record via POST /metadata/import
    if (!rg)   throw new Error('recordGroup is required when creating a new CoMET record.')
    if (!desc) throw new Error('description (record title) is required when creating a new CoMET record.')
    const params = new URLSearchParams({ action: 'import', recordGroup: rg, description: desc })
    endpoint = `${PROXY}?${params}`
    method   = 'POST'
  }

  const res = await _fetchCometProxy(endpoint, {
    method,
    headers: { 'Content-Type': 'application/xml' },
    body:    isoXml,
  })

  const body = await res.text().catch(() => '')
  if (!res.ok) {
    // Extract human-readable message from CoMET's XML or JSON error response
    const xmlMsg = body.match(/<message>([^<]+)<\/message>/)?.[1]
    let jsonMsg = null
    try { jsonMsg = JSON.parse(body)?.message } catch { /* not JSON */ }
    const detail = xmlMsg ?? jsonMsg ?? _detailForFailedResponse(res.status, body)
    throw new Error(`CoMET push failed: ${detail}`)
  }

  let parsed = null
  try { parsed = JSON.parse(body) } catch { /* XML or plain text */ }

  const resultUuid = parsed?.uuid ?? uuid
  return {
    ok:       true,
    uuid:     resultUuid,
    cometUrl: resultUuid
      ? `https://data.noaa.gov/cedit/collection/${resultUuid}`
      : 'https://data.noaa.gov/cedit',
    message:  parsed?.message ?? `Record pushed to CoMET.${resultUuid ? ` UUID: ${resultUuid}` : ''}`,
  }
}

// ── Rubric scoring ────────────────────────────────────────────────────────────

/**
 * Get the Rubric V2 score for a record directly from CoMET's recordServices.
 * Returns a structured score object that mirrors the CoMET Rubric V2 JSON response.
 *
 * @param {string} uuid     CoMET UUID (used as the filename label)
 * @param {string} isoXml   ISO 19115-2 XML to score
 * @returns {Promise<{
 *   totalScore: string,
 *   errorCount: string,
 *   categories: Array<{ name: string, score: string, ec: string }>
 * }>}
 */
export async function getRubricScore(uuid, isoXml) {
  const filename = uuid ? `${uuid.slice(0, 8)}.xml` : 'record.xml'
  const res = await _fetchCometProxy(`${PROXY}?action=rubric&filename=${encodeURIComponent(filename)}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/xml' },
    body:    isoXml,
  })

  const body = await res.text().catch(() => '{}')
  if (!res.ok) {
    throw new Error(`CoMET rubric failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }
  let data   = {}
  try { data = JSON.parse(body) } catch { /* ignore */ }

  const totals = Array.isArray(data.totals_array) ? data.totals_array[0] ?? {} : {}
  const cats   = Array.isArray(data.categories_array)
    ? data.categories_array.map((c) => ({ name: c.category_name, score: c.category_score, ec: c.total_ec }))
    : []

  return {
    totalScore: totals.total_score ?? '0%',
    errorCount: totals.total_ec    ?? '0',
    categories: cats,
  }
}

// ── Preflight chain ───────────────────────────────────────────────────────────

/**
 * Resolve XLinks in an ISO 19115-2 XML document via CoMET's resolver service.
 * The returned XML has component-backed XLink fragments expanded in place.
 * Run this first in the preflight chain so subsequent steps see resolved content.
 *
 * @param {string} isoXml  ISO 19115-2 XML to resolve
 * @returns {Promise<string>}  Resolved XML string
 */
export async function resolveXlinks(isoXml) {
  if (!isoXml?.trim()) throw new Error('resolveXlinks: no XML supplied.')

  const res = await _fetchCometProxy(`${PROXY}?action=resolver`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
    body:    isoXml,
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`CoMET resolver failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }

  return body
}

/**
 * Validate an ISO 19115-2 XML document against CoMET's schema/schematron rules.
 * This validates the *raw XML body*, not a saved record (use action=validate for that).
 *
 * @param {string} isoXml   ISO 19115-2 XML to validate
 * @param {string} [filename]  Label used by CoMET in error messages (default 'record.xml')
 * @returns {Promise<object>}  CoMET validation response JSON
 */
export async function validateIsoXml(isoXml, filename = 'record.xml') {
  if (!isoXml?.trim()) throw new Error('validateIsoXml: no XML supplied.')

  const params = new URLSearchParams({ action: 'isoValidate', filename })
  const res = await _fetchCometProxy(`${PROXY}?${params}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
    body:    isoXml,
  })

  const body = await res.text().catch(() => '{}')
  if (!res.ok) {
    throw new Error(`CoMET ISO validate failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }

  try { return JSON.parse(body) } catch { return { raw: body } }
}

/**
 * Validate ISO XML via NOAA metaserver legacy form-based endpoint.
 * Returns raw response text (often HTML/plain text), which callers can parse.
 *
 * @param {string} isoXml
 * @param {string} [filename]
 * @returns {Promise<string>}
 */
export async function validateIsoXmlViaMetaserver(isoXml, filename = 'record.xml') {
  if (!isoXml?.trim()) throw new Error('validateIsoXmlViaMetaserver: no XML supplied.')
  const params = new URLSearchParams({ action: 'metaservValidate', filename })
  const res = await _fetchCometProxy(`${PROXY}?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml', Accept: '*/*' },
    body: isoXml,
  })
  const body = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(`Metaserver validate failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }
  return body
}

/**
 * Check that URLs referenced inside an ISO 19115-2 XML document are reachable.
 * Treats non-2xx / unreachable URLs as link-check failures.
 * The caller decides whether failures block push (warn-only recommended in v1).
 *
 * @param {string} isoXml  ISO 19115-2 XML containing distribution / transfer option URLs
 * @returns {Promise<object>}  CoMET link-check response JSON
 */
export async function checkLinks(isoXml) {
  if (!isoXml?.trim()) throw new Error('checkLinks: no XML supplied.')

  const res = await _fetchCometProxy(`${PROXY}?action=linkcheck`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
    body:    isoXml,
  })

  const body = await res.text().catch(() => '{}')
  if (!res.ok) {
    throw new Error(`CoMET link check failed (${res.status}): ${_detailForFailedResponse(res.status, body)}`)
  }

  try { return JSON.parse(body) } catch { return { raw: body } }
}

// ── Gap detection ─────────────────────────────────────────────────────────────

/**
 * @param {object} s
 * @returns {string[]}
 */
function detectGapsBediCollection(s) {
  const gaps = []
  if (!String(s.title || '').trim()) gaps.push('Title is missing.')
  if (!String(s.abstract || '').trim()) gaps.push('Abstract is missing.')
  if (!String(s.fileId || '').trim()) gaps.push('File identifier is missing.')
  if (!String(s.nceiAccessionId || '').trim())
    gaps.push('NCEI Accession ID is missing — expected for published BEDI collections.')
  if (!String(s.landingPageUrl || '').trim()) gaps.push('Collection landing page URL is missing.')
  const bb = ['west', 'east', 'south', 'north'].every((k) => {
    const v = s[k]
    return v != null && String(v).trim() !== '' && !Number.isNaN(Number.parseFloat(String(v)))
  })
  if (!bb) gaps.push('Geographic bounding box is incomplete — all four bounds required.')
  const platforms = Array.isArray(s.platforms) ? s.platforms.filter(Boolean) : []
  if (platforms.length === 0)
    gaps.push('No acquisition platforms — add at least one platform reference.')
  const sk = Array.isArray(s.scienceKeywords) ? s.scienceKeywords.filter(Boolean) : []
  if (sk.length === 0) gaps.push('No science keywords — add at least one for discovery.')
  const hasPi = String(s.piName || '').trim()
  const refs = Array.isArray(s.contactRefs) ? s.contactRefs.filter(Boolean) : []
  if (!hasPi && refs.length === 0)
    gaps.push('No point of contact — add PI details or contact references.')
  return gaps
}

/**
 * @param {object} s
 * @returns {string[]}
 */
function detectGapsBediGranule(s) {
  const gaps = []
  if (!String(s.parentCollectionId || '').trim())
    gaps.push('Parent collection ID is missing — required to link granule to cruise.')
  if (!String(s.fileId || '').trim()) gaps.push('File identifier is missing.')
  if (!String(s.title || '').trim()) gaps.push('Title is missing.')
  if (!String(s.abstract || '').trim()) gaps.push('Abstract is missing.')
  if (!String(s.landingPageUrl || '').trim()) gaps.push('Granule landing page URL is missing.')
  const bb = ['west', 'east', 'south', 'north'].every((k) => {
    const v = s[k]
    return v != null && String(v).trim() !== '' && !Number.isNaN(Number.parseFloat(String(v)))
  })
  if (!bb) gaps.push('Geographic bounding box is incomplete — all four bounds required.')
  return gaps
}

/**
 * Inspect a pilotState object and return human-readable descriptions of every
 * field gap that would block publication or reduce CoMET Rubric / DSMM scores.
 *
 * When `profileOrEntityType` is a profile with `entityType` `bediCollection` or
 * `bediGranule`, uses flat BEDI state; otherwise assumes legacy mission tree shape.
 *
 * @param {object} pilotState
 * @param {{ entityType?: string } | string} [profileOrEntityType]
 * @returns {string[]}
 */
export function detectGaps(pilotState, profileOrEntityType) {
  if (!pilotState || typeof pilotState !== 'object') return ['Could not parse record — no state.']

  const et = typeof profileOrEntityType === 'string'
    ? profileOrEntityType
    : profileOrEntityType?.entityType
  if (et === 'bediCollection') return detectGapsBediCollection(pilotState)
  if (et === 'bediGranule') return detectGapsBediGranule(pilotState)

  const gaps = []

  // ── Mission / identification ───────────────────────────────────────────────
  const m = pilotState.mission ?? {}
  if (!m.title?.trim())         gaps.push('Title is missing.')
  if (!m.abstract?.trim())      gaps.push('Abstract is missing.')
  if (!m.purpose?.trim())       gaps.push('Purpose / summary is missing.')
  if (!m.doi?.trim() && !m.nceiAccessionId?.trim())
    gaps.push('No DOI or NCEI Accession ID — required for Catalog mode.')
  if (!m.landingPageUrl?.trim())
    gaps.push('No landing page URL — required for OneStop discoverability.')
  if (!m.startDate?.trim())     gaps.push('Temporal extent: start date is missing.')

  // ── Keywords ──────────────────────────────────────────────────────────────
  const kw     = pilotState.keywords ?? {}
  const gcmdKw = Array.isArray(kw.gcmd) ? kw.gcmd.filter(Boolean) : []
  if (gcmdKw.length === 0)
    gaps.push('No GCMD Science Keywords — required for OneStop discovery.')
  else if (gcmdKw.length < 2)
    gaps.push('Only 1 GCMD Science Keyword — recommend at least 2 for broader discovery.')

  const platformKw = Array.isArray(kw.platforms) ? kw.platforms.filter(Boolean) : []
  if (platformKw.length === 0)
    gaps.push('No GCMD Platform keywords — add platform/instrument context.')

  // ── Spatial ───────────────────────────────────────────────────────────────
  const sp    = pilotState.spatial ?? {}
  const hasBbox = sp.westBound != null && sp.eastBound != null
    && sp.southBound != null && sp.northBound != null
  if (!hasBbox)
    gaps.push('Geographic bounding box is missing — required for spatial search.')

  // ── Platform / sensors ────────────────────────────────────────────────────
  const pl = pilotState.platform ?? {}
  if (!pl.name?.trim() && !pl.platformType?.trim())
    gaps.push('Platform name and type are missing — UxS records require platform details.')

  const sensors    = pilotState.sensors ?? {}
  const sensorList = Array.isArray(sensors.instruments) ? sensors.instruments : []
  if (sensorList.length === 0)
    gaps.push('No instruments/sensors listed — add at least one sensor.')

  // ── Distribution ──────────────────────────────────────────────────────────
  const dist  = pilotState.distribution ?? {}
  const links = Array.isArray(dist.onlineResources) ? dist.onlineResources : []
  const hasDownload = links.some((l) => l?.linkage?.trim() || l?.url?.trim())
  if (!hasDownload)
    gaps.push('No download / access link — required for data accessibility scoring.')

  // ── Contacts ──────────────────────────────────────────────────────────────
  const contacts    = pilotState.contacts ?? pilotState.mission?.contacts ?? []
  const contactList = Array.isArray(contacts) ? contacts : []
  if (contactList.length === 0)
    gaps.push('No responsible parties / contacts — at least one point of contact is required.')

  return gaps
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Accept a bare UUID or a full CoMET URL and return just the UUID portion.
 *
 * @param {string} input
 * @returns {string}
 */
export function extractUuid(input) {
  if (!input) return ''
  const trimmed = input.trim()
  const uuidRe  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const match   = trimmed.match(uuidRe)
  return match ? match[0] : ''
}

/**
 * @returns {Array<{ uuid: string, count: number, lastUsedAt: string }>}
 */
function readKnownCometUuids() {
  try {
    const raw = window.localStorage.getItem(KNOWN_UUIDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r === 'object' && typeof r.uuid === 'string')
      .map((r) => ({
        uuid: String(r.uuid),
        count: Number.isFinite(Number(r.count)) ? Number(r.count) : 1,
        lastUsedAt: typeof r.lastUsedAt === 'string' ? r.lastUsedAt : new Date(0).toISOString(),
      }))
  } catch {
    return []
  }
}

/**
 * @returns {{ cometSessionId: string, metaserverSessionId: string }}
 */
function readCometAuth() {
  try {
    const raw = window.sessionStorage.getItem(COMET_AUTH_KEY)
    if (!raw) return { cometSessionId: '', metaserverSessionId: '' }
    const parsed = JSON.parse(raw)
    const storedAt = Number(parsed?.storedAt || 0)
    if (!Number.isFinite(storedAt) || Date.now() - storedAt > COMET_AUTH_TTL_MS) {
      window.sessionStorage.removeItem(COMET_AUTH_KEY)
      return { cometSessionId: '', metaserverSessionId: '' }
    }
    return {
      cometSessionId: typeof parsed?.cometSessionId === 'string' ? parsed.cometSessionId : '',
      metaserverSessionId: typeof parsed?.metaserverSessionId === 'string' ? parsed.metaserverSessionId : '',
    }
  } catch {
    return { cometSessionId: '', metaserverSessionId: '' }
  }
}

/**
 * @param {{ cometSessionId?: string, metaserverSessionId?: string }} auth
 */
function writeCometAuth(auth) {
  try {
    window.sessionStorage.setItem(
      COMET_AUTH_KEY,
      JSON.stringify({
        cometSessionId: String(auth?.cometSessionId || ''),
        metaserverSessionId: String(auth?.metaserverSessionId || ''),
        storedAt: Date.now(),
      }),
    )
  } catch {
    // ignore storage failures
  }
}

/**
 * @param {Array<{ uuid: string, count: number, lastUsedAt: string }>} rows
 */
function writeKnownCometUuids(rows) {
  try {
    window.localStorage.setItem(KNOWN_UUIDS_KEY, JSON.stringify(rows.slice(0, 50)))
  } catch {
    // ignore storage failures
  }
}

/**
 * Persist a UUID in local recent-history so the UI can suggest likely records.
 *
 * @param {string} uuidOrUrl
 */
export function rememberCometUuid(uuidOrUrl) {
  const uuid = extractUuid(uuidOrUrl)
  if (!uuid) return
  const now = new Date().toISOString()
  const rows = readKnownCometUuids()
  const idx = rows.findIndex((r) => r.uuid.toLowerCase() === uuid.toLowerCase())
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], uuid, count: rows[idx].count + 1, lastUsedAt: now }
  } else {
    rows.unshift({ uuid, count: 1, lastUsedAt: now })
  }
  rows.sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1))
  writeKnownCometUuids(rows)
}

/**
 * @param {string} query
 * @param {string} uuid
 * @returns {number}
 */
function uuidSimilarityScore(query, uuid) {
  const q = String(query || '').toLowerCase()
  const u = String(uuid || '').toLowerCase()
  if (!q || !u) return 0
  if (u === q) return 1
  if (u.includes(q)) return 0.92
  let prefix = 0
  while (prefix < q.length && prefix < u.length && q[prefix] === u[prefix]) prefix += 1
  return Math.min(0.9, prefix / 8)
}

/**
 * Return local UUID candidates ranked by text similarity + recency.
 *
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{ uuid: string, score: number, count: number, lastUsedAt: string }>}
 */
export function getSimilarKnownCometUuids(query, limit = 5) {
  const rows = readKnownCometUuids()
  const q = extractUuid(query) || String(query || '').trim()
  return rows
    .map((r) => {
      const textScore = q ? uuidSimilarityScore(q, r.uuid) : 0.3
      const recencyBoost = r.count >= 3 ? 0.05 : 0
      return { ...r, score: Math.min(1, textScore + recencyBoost) }
    })
    .filter((r) => (q ? r.score >= 0.25 : true))
    .sort((a, b) => (b.score - a.score) || (a.lastUsedAt < b.lastUsedAt ? 1 : -1))
    .slice(0, Math.max(1, limit))
}
