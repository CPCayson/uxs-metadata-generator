import { useState } from 'react'
import { searchGcmdSchemeClient } from '../../lib/gcmdClient'
import { runLensScanHeuristic } from '../../lib/lensScanHeuristic.js'
import {
  mergeKeywordFacetArrays,
  parseScannerSuggestionsToMissionPartial,
} from '../../adapters/sources/ScannerSuggestionAdapter.js'

const FACETS = [
  { key: 'sciencekeywords', label: 'Science keywords', scheme: 'sciencekeywords' },
  { key: 'datacenters', label: 'Data centers', scheme: 'datacenters' },
  { key: 'platforms', label: 'Platforms', scheme: 'platforms' },
  { key: 'instruments', label: 'Instruments', scheme: 'instruments' },
  { key: 'locations', label: 'Locations', scheme: 'locations' },
  { key: 'projects', label: 'Projects', scheme: 'projects' },
  { key: 'providers', label: 'Providers', scheme: 'providers' },
]

/**
 * @param {{
 *   mission?: object,
 *   keywords: Record<string, Array<{ label: string, uuid: string }>>,
 *   onKeywordsChange: (next: object) => void,
 *   issues: Array<{ field: string, message: string }>,
 * }} props
 */
export default function StepKeywords({ mission = {}, keywords, onKeywordsChange, issues }) {
  const [queries, setQueries] = useState({})
  const [loading, setLoading] = useState({})
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [suggestStatus, setSuggestStatus] = useState('')
  // Chips currently animating out (keyed by `${facet}:${uuid}`).
  // While in this set the DOM node stays mounted with the `--leaving`
  // class so CSS can play the disintegration before React unmounts it.
  const [leaving, setLeaving] = useState(() => new Set())

  function facetIssue(facetKey) {
    return issues.find((i) => i.field === `keywords.${facetKey}`)
  }

  async function searchFacet(facetKey, scheme) {
    const q = String(queries[facetKey] || '').trim()
    setErrors((e) => ({ ...e, [facetKey]: '' }))
    if (!q) {
      setResults((r) => ({ ...r, [facetKey]: [] }))
      return
    }
    setLoading((l) => ({ ...l, [facetKey]: true }))
    try {
      const rows = await searchGcmdSchemeClient(scheme, q, { maxMatches: 15 })
      setResults((r) => ({ ...r, [facetKey]: rows }))
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [facetKey]: err instanceof Error ? err.message : 'Search failed',
      }))
      setResults((r) => ({ ...r, [facetKey]: [] }))
    } finally {
      setLoading((l) => ({ ...l, [facetKey]: false }))
    }
  }

  function addKw(facetKey, row) {
    const list = Array.isArray(keywords[facetKey]) ? keywords[facetKey] : []
    if (list.some((k) => k.uuid === row.uuid)) return
    onKeywordsChange({
      ...keywords,
      [facetKey]: [...list, { label: row.prefLabel, uuid: row.uuid }],
    })
    setResults((r) => ({ ...r, [facetKey]: [] }))
  }

  function removeKw(facetKey, uuid) {
    const key = `${facetKey}:${uuid}`
    // Already animating out — ignore double-clicks.
    if (leaving.has(key)) return
    setLeaving((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    // Keep the chip mounted for the duration of the CSS leave animation,
    // then actually remove it from the list.
    window.setTimeout(() => {
      const list = Array.isArray(keywords[facetKey]) ? keywords[facetKey] : []
      onKeywordsChange({
        ...keywords,
        [facetKey]: list.filter((k) => k.uuid !== uuid),
      })
      setLeaving((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 260)
  }

  async function suggestFromTitleAbstract() {
    setSuggestBusy(true)
    setSuggestStatus('')
    try {
      const env = await runLensScanHeuristic({
        title:     String(mission?.title || ''),
        abstract:  String(mission?.abstract || ''),
        profileId: 'mission',
      })
      const parsed = parseScannerSuggestionsToMissionPartial(env)
      if (!parsed.ok) {
        setSuggestStatus(parsed.error || 'No GCMD suggestions were found from the current title and abstract.')
        return
      }
      const partialKeywords = parsed.partial?.keywords
      if (!partialKeywords || typeof partialKeywords !== 'object' || Array.isArray(partialKeywords)) {
        setSuggestStatus('No keyword suggestions were found from the current title and abstract.')
        return
      }
      const next = { ...keywords }
      let added = 0
      FACETS.forEach(({ key }) => {
        const incoming = Array.isArray(partialKeywords[key]) ? partialKeywords[key] : []
        if (!incoming.length) return
        const before = Array.isArray(next[key]) ? next[key].length : 0
        next[key] = mergeKeywordFacetArrays(Array.isArray(next[key]) ? next[key] : [], incoming)
        added += Math.max(0, next[key].length - before)
      })
      if (added === 0) {
        setSuggestStatus('No new GCMD suggestions to add; existing keyword chips already cover the matches.')
        return
      }
      onKeywordsChange(next)
      setSuggestStatus(`Added ${added} GCMD keyword suggestion${added === 1 ? '' : 's'} from the title / abstract.`)
    } catch (err) {
      setSuggestStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggestBusy(false)
    }
  }

  return (
    <>
      <p className="card-intro">
        Faceted GCMD KMS search. Select chips per facet; counts update in the validator.
      </p>

      <div className="ai-suggest panel">
        <h3 className="panel-title">Suggest GCMD keywords from title / abstract</h3>
        <p className="hint">
          Runs the same deterministic Lens scanner used by the scanner dialog: title + abstract → GCMD KMS matches.
          Review and remove chips as needed.
        </p>
        <button
          type="button"
          className="button button-secondary"
          disabled={suggestBusy}
          onClick={() => void suggestFromTitleAbstract()}
        >
          {suggestBusy ? 'Suggesting…' : 'Suggest from title / abstract'}
        </button>
        {suggestStatus ? <p className="draft-meta" role="status" aria-live="polite">{suggestStatus}</p> : null}
      </div>

      {FACETS.map(({ key, label, scheme }) => {
        const chips = Array.isArray(keywords[key]) ? keywords[key] : []
        const iss = facetIssue(key)
        return (
          <section key={key} className="panel keyword-facet" data-pilot-field={`keywords.${key}`}>
            <h3 className="panel-title">
              {label}{' '}
              <span className="count-badge">{chips.length}</span>
            </h3>
            {iss ? <p className="field-error">{iss.message}</p> : null}
            <div className="kw-search-row">
              <input
                className="form-control"
                placeholder={`Search ${label}…`}
                aria-label={`Search ${label}`}
                value={queries[key] || ''}
                onChange={(e) => setQueries((q) => ({ ...q, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    searchFacet(key, scheme)
                  }
                }}
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => searchFacet(key, scheme)}
                disabled={Boolean(loading[key])}
              >
                {loading[key] ? '…' : 'Search'}
              </button>
            </div>
            {errors[key] ? <p className="field-error">{errors[key]}</p> : null}
            <ul className="kw-results">
              {(results[key] || []).map((row) => (
                <li key={row.uuid}>
                  <button type="button" className="linkish" onClick={() => addKw(key, row)}>
                    + {row.prefLabel}
                  </button>
                </li>
              ))}
            </ul>
            <div className="chip-row">
              {chips.map((c) => {
                const isLeaving = leaving.has(`${key}:${c.uuid}`)
                return (
                  <button
                    key={c.uuid}
                    type="button"
                    className={`kw-chip${isLeaving ? ' kw-chip--leaving' : ''}`}
                    onClick={() => removeKw(key, c.uuid)}
                    disabled={isLeaving}
                    aria-label={`Remove ${c.label}`}
                    title="Remove"
                  >
                    <span className="kw-chip__label">{c.label}</span>
                    <span className="kw-chip__x" aria-hidden>×</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}
