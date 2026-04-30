import { useEffect, useState } from 'react'

const FALLBACK = {
  collections: 111_024,
  granules: 12_856_284,
  href: 'https://data.noaa.gov/onestop/',
}

/**
 * “Discovery catalog” strip — optional live totals from `/api/onestop-stats`
 * (Netlify) or published-scale fallback. Decorative + link-out, not validation.
 */
export default function OneStopCatalogStrip() {
  const [data, setData] = useState(/** @type {null | Record<string, unknown>} */ (null))
  const [err, setErr] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/onestop-stats', { method: 'GET', headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const j = await res.json()
        if (!cancelled) setData(j)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e))
          setData({
            ok: true,
            live: false,
            collections: FALLBACK.collections,
            granules: FALLBACK.granules,
            href: FALLBACK.href,
            note: 'Showing typical catalog scale (run with Netlify functions for server snapshot).',
          })
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const collections = typeof data?.collections === 'number' ? data.collections : FALLBACK.collections
  const granules = typeof data?.granules === 'number' ? data.granules : FALLBACK.granules
  const href = typeof data?.href === 'string' ? data.href : FALLBACK.href
  const live = data?.live === true
  const note = typeof data?.note === 'string' ? data.note : null

  return (
    <section
      className="onestop-catalog-strip"
      aria-label="NOAA data discovery catalog scale"
    >
      <div className="onestop-catalog-strip__glow" aria-hidden="true" />
      <div className="onestop-catalog-strip__inner">
        <div className="onestop-catalog-strip__head">
          <span className="onestop-catalog-strip__badge">
            {live ? 'Live snapshot' : 'Discovery scale'}
          </span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="onestop-catalog-strip__link"
          >
            Search NOAA OneStop
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
        <div className="onestop-catalog-strip__stats">
          <div className="onestop-catalog-strip__stat">
            <span className="onestop-catalog-strip__value">
              {collections.toLocaleString()}
            </span>
            <span className="onestop-catalog-strip__label">collections indexed</span>
          </div>
          <div className="onestop-catalog-strip__divider" aria-hidden="true" />
          <div className="onestop-catalog-strip__stat">
            <span className="onestop-catalog-strip__value">
              {granules.toLocaleString()}
            </span>
            <span className="onestop-catalog-strip__label">granules indexed</span>
          </div>
        </div>
        {(note || err) ? (
          <p className="onestop-catalog-strip__hint">
            {note || (err ? `API: ${err}`  : null)}
          </p>
        ) : null}
      </div>
    </section>
  )
}
