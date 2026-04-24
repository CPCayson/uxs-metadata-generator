const KMS_BASE = 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme'

/**
 * @param {string} scheme e.g. sciencekeywords, platforms
 * @param {string} query
 * @param {{ pageSize?: number, maxMatches?: number }} [opts]
 * @returns {Promise<Array<{ uuid: string, prefLabel: string }>>}
 */
export async function searchGcmdSchemeClient(scheme, query, opts = {}) {
  const cleanScheme = String(scheme || '').trim().toLowerCase()
  const q = String(query || '').trim().toLowerCase()
  if (!cleanScheme || !q) {
    return []
  }

  const pageSize = Math.min(200, Math.max(1, Number(opts.pageSize) || 100))
  const maxMatches = Math.min(50, Math.max(1, Number(opts.maxMatches) || 12))

  const url = `${KMS_BASE}/${encodeURIComponent(cleanScheme)}/?format=json&page_num=1&page_size=${pageSize}`
  const resp = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resp.ok) {
    throw new Error(`GCMD KMS request failed (${resp.status})`)
  }
  const data = await resp.json()
  const concepts = Array.isArray(data.concepts) ? data.concepts : []
  const matches = []
  for (let i = 0; i < concepts.length && matches.length < maxMatches; i++) {
    const c = concepts[i]
    const label = String(c?.prefLabel || c?.label || '').trim()
    const uuid = String(c?.uuid || '').trim()
    if (!label || !uuid) continue
    if (!label.toLowerCase().includes(q)) continue
    matches.push({ uuid, prefLabel: label })
  }
  return matches
}
