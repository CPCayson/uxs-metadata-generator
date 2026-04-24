const ROR_BASE = 'https://api.ror.org/v2/organizations'

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ id: string, displayName: string, country: string | null, types: string[] }>>}
 */
export async function searchRorOrganizationsClient(query, opts = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) {
    return []
  }
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 5))
  const url = `${ROR_BASE}?query=${encodeURIComponent(q)}&page=1`
  const resp = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resp.ok) {
    throw new Error(`ROR request failed (${resp.status})`)
  }
  const data = await resp.json()
  const items = Array.isArray(data.items) ? data.items.slice(0, limit) : []

  return items.map((org) => {
    const names = Array.isArray(org.names) ? org.names : []
    const display =
      names.find((n) => Array.isArray(n.types) && n.types.includes('ror_display')) ||
      names.find((n) => Array.isArray(n.types) && n.types.includes('label')) ||
      names[0]
    const displayName = display?.value ? String(display.value) : 'Unknown'
    const loc = Array.isArray(org.locations) && org.locations[0]
    const country = loc?.geonames_details?.country_name || null
    const types = Array.isArray(org.types) ? org.types.map(String) : []
    return {
      id: String(org.id || ''),
      displayName,
      country,
      types,
    }
  })
}
