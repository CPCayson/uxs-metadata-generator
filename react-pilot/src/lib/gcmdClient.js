/**
 * @returns {string}
 */
function getKmsBase() {
  const fromEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GCMD_KMS_BASE
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.replace(/\/+$/, '')
  // GCMD’s `gcmd.earthdata.nasa.gov/kms/...` endpoints redirect to CMR’s KMS. Call CMR
  // directly so browser `fetch` behavior is stable (and we can use `pattern` search).
  return 'https://cmr.earthdata.nasa.gov/kms'
}

const KMS_BASE = `${getKmsBase()}/concepts/concept_scheme`
/** All-schemes pattern search: `/kms/concepts/pattern/{token}` (get_concepts_by_pattern in CMR KMS capabilities). */
const KMS_PATTERN_GLOBAL = `${getKmsBase()}/concepts/pattern`

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

/**
 * Multi-token GCMD label scoring (hierarchy uses `>`).
 *
 * @param {string} label
 * @param {string} query
 */
function scoreGcmdMatchMultiword(label, query) {
  const l = normalizeText(label)
  const q = normalizeText(query)
  if (!l || !q) return null
  const qParts = q.split(' ').map((p) => p.trim()).filter((p) => p.length > 1)
  if (qParts.length < 2) return null
  if (l === q) return { score: 1, matchType: 'exact' }
  const parts = l.split('>').map((p) => normalizeText(p)).filter(Boolean)
  if (parts.some((p) => p === q)) return { score: 0.98, matchType: 'exact-segment' }

  // Require every query token to appear somewhere in the label (token-ish match).
  const lTokens = l.split(/\s+/).filter(Boolean)
  const tokenHits = qParts.map((t) => lTokens.includes(t) || l.includes(t))
  if (tokenHits.every(Boolean)) {
    // Prefer when more tokens are matched as *whole* tokens in the label.
    const strong = qParts.filter((t) => lTokens.includes(t)).length
    const bonus = Math.min(0.12, strong * 0.03)
    return { score: Math.max(0.1, 0.78 - bonus), matchType: 'all-tokens' }
  }

  // Otherwise fall back to “how many important tokens are present?”.
  const found = qParts.filter((t) => l.includes(t))
  if (!found.length) return null
  const ratio = found.length / qParts.length
  if (found.length === 1) {
    if (l.includes(qParts[0]) && (l.includes('>') || l.length <= 64)) {
      // Single-token hit on a long hierarchical label is often noise.
      if (l.includes('>') && !parts.some((p) => p.includes(qParts[0]))) {
        return null
      }
    }
  }
  if (ratio < 0.51) return null
  return { score: Math.max(0.1, 0.45 * ratio + (l.includes('>') ? 0.04 : 0.08)), matchType: 'partial-tokens' }
}

/**
 * @param {string} label
 * @param {string} query
 */
function scoreGcmdMatch(label, query) {
  const l = normalizeText(label)
  const q = normalizeText(query)
  if (!l || !q) return null
  const multi = scoreGcmdMatchMultiword(l, q)
  if (multi) return multi
  const parts = l.split('>').map((p) => normalizeText(p)).filter(Boolean)
  const tokens = l.split(/\s+/).filter(Boolean)
  let score = 0
  let matchType = ''
  if (l === q || parts.some((p) => p === q)) {
    score = 1
    matchType = 'exact'
  } else if (new RegExp(`(^|\\s)${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(l)) {
    score = 0.9
    matchType = 'whole-word'
  } else if (tokens.some((t) => t.startsWith(q))) {
    score = 0.78
    matchType = 'prefix'
  } else if (l.includes(q)) {
    const lengthPenalty = Math.min(0.18, Math.max(0, (l.length - q.length) / 220))
    score = 0.62 - lengthPenalty
    matchType = 'substring'
  } else {
    return null
  }
  return { score: Math.max(0.1, Number(score.toFixed(3))), matchType }
}

/**
 * @param {string} scheme e.g. sciencekeywords, platforms
 * @param {string} query
 * @param {string} pattern
 * @param {{ pageSize: number, maxPages: number }} pageOpts
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchKmsPatternConceptPages(scheme, query, pattern, pageOpts) {
  const cleanScheme = String(scheme || '').trim().toLowerCase()
  const p = String(pattern || '').trim()
  if (!cleanScheme || !p) return []

  const pageSize = pageOpts.pageSize
  const maxPages = pageOpts.maxPages
  const concepts = []
  for (let page = 1; page <= maxPages; page += 1) {
    const url =
      `${KMS_BASE}/` +
      `${encodeURIComponent(cleanScheme)}/` +
      `pattern/${encodeURIComponent(p)}/` +
      `?format=json&page_num=${page}&page_size=${pageSize}`
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      throw new Error(`GCMD KMS request failed (${resp.status}) for pattern "${query}"`)
    }
    const data = await resp.json()
    const pageConcepts = Array.isArray(data.concepts) ? data.concepts : []
    concepts.push(...pageConcepts)
    if (pageConcepts.length < pageSize) break
  }
  return concepts
}

/**
 * CMR `concepts` JSON: scheme may be `{ shortName }` (or legacy shapes).
 * @param {Record<string, unknown>} c
 * @returns {string}
 */
function gcmdConceptSchemeShortName(c) {
  const s = c?.scheme
  if (typeof s === 'string' && s.trim()) return s.trim()
  if (s && typeof s === 'object') {
    const sn = /** @type {{ shortName?: string, name?: string }} */ (s).shortName
    const n = /** @type {{ shortName?: string, name?: string }} */ (s).name
    if (typeof sn === 'string' && sn.trim()) return sn.trim()
    if (typeof n === 'string' && n.trim()) return n.trim()
  }
  return ''
}

/**
 * @param {string} pattern
 * @param {string} cleanScheme
 * @param {Array<Record<string, unknown>>} concepts
 * @returns {Array<Record<string, unknown>>}
 */
function filterGlobalPatternConceptsToScheme(cleanScheme, concepts) {
  const want = String(cleanScheme || '').trim().toLowerCase()
  if (!want) return []
  return concepts.filter((c) => gcmdConceptSchemeShortName(c).toLowerCase() === want)
}

/**
 * CMR all-schemes pattern search (not scoped to `concept_scheme/{scheme}`). Paginates like
 * {@link fetchKmsPatternConceptPages}.
 *
 * @param {string} query
 * @param {string} pattern
 * @param {{ pageSize: number, maxPages: number }} pageOpts
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchKmsGlobalPatternConceptPages(query, pattern, pageOpts) {
  const p = String(pattern || '').trim()
  if (!p) return []
  const pageSize = pageOpts.pageSize
  const maxPages = pageOpts.maxPages
  const concepts = []
  for (let page = 1; page <= maxPages; page += 1) {
    const url =
      `${KMS_PATTERN_GLOBAL}/` +
      `${encodeURIComponent(p)}/` +
      `?format=json&page_num=${page}&page_size=${pageSize}`
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      throw new Error(`GCMD KMS request failed (${resp.status}) for global pattern "${query}"`)
    }
    const data = await resp.json()
    const pageConcepts = Array.isArray(data.concepts) ? data.concepts : []
    concepts.push(...pageConcepts)
    if (pageConcepts.length < pageSize) break
  }
  return concepts
}

/**
 * @param {string} scheme
 * @param {string} q
 * @param {number} pageSize
 * @param {number} maxPages
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchKmsFullSchemeConceptPages(scheme, q, pageSize, maxPages) {
  const cleanScheme = String(scheme || '').trim().toLowerCase()
  if (!cleanScheme) return []
  const concepts = []
  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${KMS_BASE}/${encodeURIComponent(cleanScheme)}/?format=json&page_num=${page}&page_size=${pageSize}`
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      throw new Error(`GCMD KMS request failed (${resp.status}) for "${q}"`)
    }
    const data = await resp.json()
    const pageConcepts = Array.isArray(data.concepts) ? data.concepts : []
    concepts.push(...pageConcepts)
    if (pageConcepts.length < pageSize) break
  }
  return concepts
}

/**
 * @param {string} q
 * @returns {string[]}
 */
function gcmdPatternSeedsForQuery(q) {
  const raw = String(q || '').trim()
  if (!raw) return []
  const n = normalizeText(raw)
  const parts = n.split(' ').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return []
  /** @type {string[]} */
  const out = [n, ...parts]
  for (const p of parts) {
    if (p.length > 5) {
      // Progressive prefixes can match KMS "pattern" better than a very long token.
      out.push(p.slice(0, Math.min(6, p.length)))
      out.push(p.slice(0, Math.min(5, p.length)))
    }
  }
  return [...new Set(out)].filter(Boolean)
}

/**
 * @param {string} scheme e.g. sciencekeywords, platforms
 * @param {string} query
 * @param {{ pageSize?: number, maxMatches?: number, maxPages?: number }} [opts]
 * @returns {Promise<Array<{ uuid: string, prefLabel: string, score: number, matchType: string }>>}
 */
export async function searchGcmdSchemeClient(scheme, query, opts = {}) {
  const cleanScheme = String(scheme || '').trim().toLowerCase()
  const q = String(query || '').trim().toLowerCase()
  if (!cleanScheme || !q) {
    return []
  }

  const pageSize = Math.min(200, Math.max(1, Number(opts.pageSize) || 100))
  const maxMatches = Math.min(50, Math.max(1, Number(opts.maxMatches) || 12))
  const maxPages = Math.min(5, Math.max(1, Number(opts.maxPages) || 1))

  const patternSeeds = gcmdPatternSeedsForQuery(q)
  /** @type {Map<string, Record<string, unknown>>} */
  const byUuid = new Map()
  for (const seed of patternSeeds) {
    if (seed.length < 2) continue
    // Sequentially expand candidate coverage; stop as soon as we have anything to rank.
    // (Unioning *all* seeds is significantly more network-heavy per keystroke/seed word.)
    const pageConcepts = await fetchKmsPatternConceptPages(cleanScheme, q, seed, { pageSize, maxPages })
    for (const c of pageConcepts) {
      const u = String(c?.uuid || '').trim()
      if (u) byUuid.set(u, c)
    }
    if (byUuid.size > 0) break
  }

  if (byUuid.size === 0) {
    for (const seed of patternSeeds) {
      if (seed.length < 2) continue
      const globalPage = await fetchKmsGlobalPatternConceptPages(q, seed, { pageSize, maxPages })
      const forScheme = filterGlobalPatternConceptsToScheme(cleanScheme, globalPage)
      for (const c of forScheme) {
        const u = String(c?.uuid || '').trim()
        if (u) byUuid.set(u, c)
      }
      if (byUuid.size > 0) break
    }
  }

  let concepts = [...byUuid.values()]
  if (concepts.length === 0) {
    // Pattern search is fast when it works, but some queries need the legacy full list scan
    // (e.g. multiword phrases, odd tokenization, or when KMS has no `pattern` hits).
    concepts = await fetchKmsFullSchemeConceptPages(cleanScheme, q, pageSize, maxPages)
  }

  const matches = []
  const seen = new Set()
  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i]
    const label = String(c?.prefLabel || c?.label || '').trim()
    const uuid = String(c?.uuid || '').trim()
    if (!label || !uuid) continue
    if (seen.has(uuid)) continue
    const scored = scoreGcmdMatch(label, q)
    if (!scored) continue
    seen.add(uuid)
    matches.push({ uuid, prefLabel: label, ...scored })
  }
  return matches
    .sort((a, b) => b.score - a.score || a.prefLabel.length - b.prefLabel.length || a.prefLabel.localeCompare(b.prefLabel))
    .slice(0, maxMatches)
}
