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
 *   fetchCometRecord(uuid)                    → ISO 19115-2 XML string
 *   pushCometRecord(uuid, xml, opts)          → { ok, uuid, cometUrl, message }
 *   getRubricScore(uuid, xml)                 → { totalScore, categories }
 *   resolveXlinks(isoXml)                     → resolved XML string        [preflight step 1]
 *   validateIsoXml(isoXml, filename?)         → CoMET validate response    [preflight step 2]
 *   checkLinks(isoXml)                        → CoMET link-check response  [preflight step 3]
 *   detectGaps(pilotState, profile?)          → string[]  (profile.entityType routes BEDI vs mission)
 *   extractUuid(input)                        → string
 */

const PROXY = '/api/comet-proxy'

const PROXY_MISSING_HINT =
  `CoMET proxy not found (404) at ${PROXY}. Use Netlify Dev / deploy functions, or route /api/comet-proxy to the comet-proxy function.`

/**
 * @param {string} url
 * @param {Parameters<typeof fetch>[1]} [init]
 * @returns {Promise<Response>}
 */
async function _fetchCometProxy(url, init) {
  try {
    return await fetch(url, init)
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
  return { ok: !!data.ok, jsessionid: data.jsessionid ?? null }
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
