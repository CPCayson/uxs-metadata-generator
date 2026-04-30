/**
 * Dashboard: NOAA discovery catalog scale (OneStop-style search totals).
 *
 * GET /
 * Returns JSON: { collections, granules, live, source, href, tookMs?, error? }
 *
 * Live mode (optional):
 *   ONESTOP_API_BASE — e.g. https://your-gateway.example (no trailing slash).
 *   Upstream must accept POST `{ "queries":[{type, value}], "page":{max,offset} }`
 *   to `/search/collection` and `/search/granule` and return `{ meta: { total } }`
 *   (JSON API shape used by OneStop Search — see cedardevs onestop docs).
 *
 * When unset or upstream fails, responds with published-order-of-magnitude counts
 * from the public OneStop about page so the UI still has “razzle dazzle”.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const PUBLIC_HREF = 'https://data.noaa.gov/onestop/'
/** Last refreshed from https://data.noaa.gov/onestop/about (approximate; not live). */
const PUBLISHED_FALLBACK = {
  collections: 111_024,
  granules: 12_856_284,
  note: 'Published summary figures — enable ONESTOP_API_BASE for live totals from your search gateway.',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * Broad text query so indexes return stable positive totals when wildcard is unsupported.
 * @param {string} base
 * @param {'collection'|'granule'} kind
 */
async function fetchTotal(base, kind) {
  const path = kind === 'collection' ? '/search/collection' : '/search/granule'
  const url = `${base.replace(/\/$/, '')}${path}`
  const t0 = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      queries: [{ type: 'queryText', value: 'noaa' }],
      page: { max: 0, offset: 0 },
    }),
  })
  const tookMs = Date.now() - t0
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
  }
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error('Non-JSON response from search API')
  }
  const total = body?.meta?.total
  if (typeof total !== 'number' || Number.isNaN(total)) {
    throw new Error('Missing meta.total in search response')
  }
  return { total, tookMs }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405)

  const base = String(process.env.ONESTOP_API_BASE || '').trim()

  if (!base) {
    return json({
      ok: true,
      live: false,
      source: 'published-summary',
      href: PUBLIC_HREF,
      collections: PUBLISHED_FALLBACK.collections,
      granules: PUBLISHED_FALLBACK.granules,
      note: PUBLISHED_FALLBACK.note,
    })
  }

  try {
    const [col, gran] = await Promise.all([
      fetchTotal(base, 'collection'),
      fetchTotal(base, 'granule'),
    ])
    return json({
      ok: true,
      live: true,
      source: 'onestop-search-api',
      href: PUBLIC_HREF,
      collections: col.total,
      granules: gran.total,
      tookMs: Math.max(col.tookMs, gran.tookMs),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({
      ok: true,
      live: false,
      source: 'published-summary',
      href: PUBLIC_HREF,
      collections: PUBLISHED_FALLBACK.collections,
      granules: PUBLISHED_FALLBACK.granules,
      note: `${PUBLISHED_FALLBACK.note} Live fetch failed: ${msg}`,
    })
  }
}
