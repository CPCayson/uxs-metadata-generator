import { useState, useMemo } from 'react'
import { searchGcmdSchemeClient } from '../../lib/gcmdClient'
import { gcmdConceptUrlFromUuid } from '../../lib/gcmdKmsUrl.js'
import { runLensScanHeuristic } from '../../lib/lensScanHeuristic.js'
import { getPilotFieldLabelFallback } from '../../lib/pilotFieldLabelFallback.js'
import {
  mergeKeywordFacetArrays,
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
 *   issues: Array<{ field: string, message: string, severity?: string }>,
 * }} props
 */
export default function StepKeywords({ mission = {}, keywords, onKeywordsChange, issues }) {
  const [queries, setQueries] = useState({})
  const [loading, setLoading] = useState({})
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [suggestStatus, setSuggestStatus] = useState('')
  const [suggestionRows, setSuggestionRows] = useState([])
  const [acceptedSuggestionKeys, setAcceptedSuggestionKeys] = useState(() => new Set())
  // Chips currently animating out (keyed by `${facet}:${uuid}`).
  // While in this set the DOM node stays mounted with the `--leaving`
  // class so CSS can play the disintegration before React unmounts it.
  const [leaving, setLeaving] = useState(() => new Set())

  const keywordMetadataIssues = useMemo(
    () =>
      (Array.isArray(issues) ? issues : []).filter(
        (i) => i && typeof i.field === 'string' && /^keywords\.\w+\[\d+\]\.uuid$/.test(i.field),
      ),
    [issues],
  )

  function facetIssue(facetKey) {
    return issues.find((i) => i.field === `keywords.${facetKey}`)
  }

  function facetLabel(facetKey) {
    return FACETS.find((f) => f.key === facetKey)?.label || facetKey
  }

  /**
   * @param {string} facetKey
   * @param {number} index
   * @returns {{ field: string, message: string, severity?: string } | null}
   */
  function issueForKeywordChip(facetKey, index) {
    const path = `keywords.${facetKey}[${index}].uuid`
    const list = Array.isArray(issues) ? issues : []
    return list.find((i) => i && i.field === path) || null
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
      const rows = await searchGcmdSchemeClient(scheme, q, { maxMatches: 15, maxPages: 3 })
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
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    try {
      const env = await runLensScanHeuristic({
        title:     String(mission?.title || ''),
        abstract:  String(mission?.abstract || ''),
        profileId: 'mission',
        uxsContext: mission?.uxsContext,
      })
      const rows = []
      for (const suggestion of env.suggestions || []) {
        const fieldPath = String(suggestion?.fieldPath || '')
        if (!fieldPath.startsWith('keywords.')) continue
        const facetKey = fieldPath.slice('keywords.'.length)
        const values = Array.isArray(suggestion.value) ? suggestion.value : [suggestion.value]
        const lensPM = Array.isArray(suggestion.lensPerItem) ? suggestion.lensPerItem : null
        for (let vi = 0; vi < values.length; vi += 1) {
          const value = values[vi]
          if (!value || typeof value !== 'object' || Array.isArray(value)) continue
          const label = String(value.label || value.prefLabel || '').trim()
          const uuid = String(value.uuid || '').trim()
          if (!label || !uuid) continue
          const alreadyPresent = Array.isArray(keywords[facetKey]) && keywords[facetKey].some((k) => k.uuid === uuid)
          const li = lensPM && typeof lensPM[vi] === 'object' && lensPM[vi] ? lensPM[vi] : null
          const evidence =
            li && typeof li.evidence === 'string' && li.evidence
              ? li.evidence
              : String(suggestion.evidence || '')
          const conf =
            li && typeof li.confidence === 'number'
              ? li.confidence
              : typeof suggestion.confidence === 'number'
                ? suggestion.confidence
                : null
          const matchType =
            li && typeof li.matchType === 'string' && li.matchType.trim() ? li.matchType.trim() : null
          const seedWord =
            li && typeof li.seedWord === 'string' && li.seedWord.trim()
              ? li.seedWord.trim()
              : typeof suggestion.seedWord === 'string' && suggestion.seedWord.trim()
                ? suggestion.seedWord.trim()
                : ''
          rows.push({
            key: `${facetKey}:${uuid}`,
            facetKey,
            label,
            uuid,
            alreadyPresent,
            confidence: conf,
            matchType,
            seedWord,
            evidence,
            source:     [suggestion.source, suggestion.model].filter(Boolean).join(' · '),
          })
        }
      }
      /** Deduplicate by `${facetKey}:${uuid}`: merge evidence, max confidence, any alreadyPresent. */
      const dedupeOrder = []
      /** @type {Map<string, (typeof rows)[number]>} */
        const byFacetUuid = new Map()
        for (const r of rows) {
          const k = r.key
          if (!byFacetUuid.has(k)) {
            byFacetUuid.set(k, { ...r })
            dedupeOrder.push(k)
          } else {
            const prev = byFacetUuid.get(k)
            const parts = [prev.evidence, r.evidence].filter((x) => typeof x === 'string' && x.trim())
            const mergedEvidence = parts.length ? [...new Set(parts)].join('; ') : prev.evidence
            const nums = [prev.confidence, r.confidence].filter((c) => typeof c === 'number')
            const seedMerge = [prev.seedWord, r.seedWord].filter((x) => typeof x === 'string' && x.trim())
            byFacetUuid.set(k, {
              ...prev,
              evidence:       mergedEvidence,
              confidence:     nums.length ? Math.max(...nums) : prev.confidence,
              alreadyPresent: prev.alreadyPresent || r.alreadyPresent,
              matchType:      prev.matchType || r.matchType,
              seedWord:       seedMerge.length ? [...new Set(seedMerge)].join(' · ') : prev.seedWord,
            })
          }
        }
      const dedupedRows = dedupeOrder.map((k) => byFacetUuid.get(k))
      if (!dedupedRows.length) {
        setSuggestStatus('No keyword suggestions were found from the current text fields (title, abstract, UxS context, XML).')
        return
      }
      setSuggestionRows(dedupedRows)
      setAcceptedSuggestionKeys(new Set(dedupedRows.filter((row) => !row.alreadyPresent).map((row) => row.key)))
      const newCount = dedupedRows.filter((row) => !row.alreadyPresent).length
      setSuggestStatus(
        newCount
          ? `Review ${newCount} new GCMD suggestion${newCount === 1 ? '' : 's'} before adding.`
          : 'No new GCMD suggestions to add; existing keyword chips already cover the matches.',
      )
    } catch (err) {
      setSuggestStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSuggestBusy(false)
    }
  }

  function toggleSuggestion(key, on) {
    setAcceptedSuggestionKeys((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function clearSuggestions() {
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    setSuggestStatus('')
  }

  function applyReviewedSuggestions() {
    const selected = suggestionRows.filter((row) => acceptedSuggestionKeys.has(row.key) && !row.alreadyPresent)
    if (!selected.length) {
      setSuggestStatus('No selected new GCMD suggestions to add.')
      return
    }
    const next = { ...keywords }
    let added = 0
    FACETS.forEach(({ key }) => {
      const incoming = selected
        .filter((row) => row.facetKey === key)
        .map((row) => ({ label: row.label, uuid: row.uuid }))
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
    setSuggestionRows([])
    setAcceptedSuggestionKeys(new Set())
    setSuggestStatus(`Added ${added} GCMD keyword suggestion${added === 1 ? '' : 's'} from the title / abstract.`)
  }

  return (
    <>
      <p className="card-intro">
        <strong>GCMD faceted keywords</strong> — search per facet, or use <strong>Suggest from title / abstract</strong>{' '}
        for heuristic matches. Chip counts flow into the live validator.
      </p>

      {keywordMetadataIssues.length > 0 ? (
        <div className="alert alert-secondary" role="status" aria-label="Keyword metadata quality">
          <strong>Keyword metadata</strong>
          <p className="form-text mb-1">
            These warnings do not block export; they help ensure GCMD <code>gmx:Anchor</code> links resolve in the XML
            preview.
          </p>
          <ul className="mb-0 small">
            {keywordMetadataIssues.map((i, idx) => {
              const label = getPilotFieldLabelFallback(i.field)
              return (
                <li key={`${i.field}-${idx}`}>
                  <strong>{label}</strong>
                  {label !== i.field ? (
                    <span className="form-text d-block">
                      <code>{i.field}</code>
                    </span>
                  ) : null}
                  {' — '}
                  {i.message}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="ai-suggest panel">
        <h3 className="panel-title">Suggest GCMD keywords from title / abstract</h3>
        <p className="hint">
          Runs the same deterministic Lens scanner as the scanner dialog: title, abstract, UxS operational context (when
          filled in), and XML-derived text → GCMD KMS matches. Review and remove chips as needed.
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
        {suggestionRows.length ? (
          <div className="scanner-dialog__rows">
            <h4 className="h6">Review suggested keyword chips</h4>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th scope="col">Use</th>
                  <th scope="col">Facet</th>
                  <th scope="col">Keyword</th>
                  <th scope="col">Conf.</th>
                  <th scope="col">Match</th>
                  <th scope="col">Seed</th>
                  <th scope="col">KMS</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {suggestionRows.map((row) => {
                  const kmsHref = gcmdConceptUrlFromUuid(row.uuid)
                  return (
                    <tr key={row.key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={acceptedSuggestionKeys.has(row.key)}
                          disabled={row.alreadyPresent}
                          onChange={(e) => toggleSuggestion(row.key, e.target.checked)}
                          aria-label={`Accept ${facetLabel(row.facetKey)} suggestion ${row.label}`}
                        />
                      </td>
                      <td>{facetLabel(row.facetKey)}</td>
                      <td>
                        <code className="scanner-dialog__mono">{row.label}</code>
                        {row.alreadyPresent ? <div className="form-text">Already selected</div> : null}
                        <div className="form-text">{row.uuid}</div>
                      </td>
                      <td>{row.confidence == null ? '—' : row.confidence.toFixed(2)}</td>
                      <td>{row.matchType || '—'}</td>
                      <td>
                        <code className="scanner-dialog__mono" title={row.seedWord || undefined}>
                          {row.seedWord ? (row.seedWord.length > 24 ? `${row.seedWord.slice(0, 24)}…` : row.seedWord) : '—'}
                        </code>
                      </td>
                      <td>
                        {kmsHref ? (
                          <a
                            className="linkish"
                            href={kmsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open GCMD KMS concept for ${row.label}`}
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <small title={row.evidence || row.source || undefined}>
                          {row.evidence
                            ? `${row.evidence.slice(0, 160)}${row.evidence.length > 160 ? '…' : ''}`
                            : row.source || '—'}
                        </small>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="kw-search-row">
              <button type="button" className="button button-secondary" onClick={clearSuggestions}>
                Clear suggestions
              </button>
              <button type="button" className="button" onClick={applyReviewedSuggestions}>
                Add selected suggestions
              </button>
            </div>
          </div>
        ) : null}
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
              {chips.map((c, chipIndex) => {
                const isLeaving = leaving.has(`${key}:${c.uuid}`)
                const chipUuidIssue = issueForKeywordChip(key, chipIndex)
                const removeHint = `Remove ${c.label}`
                return (
                  <button
                    key={c.uuid}
                    type="button"
                    className={`kw-chip${isLeaving ? ' kw-chip--leaving' : ''}${chipUuidIssue ? ' kw-chip--uuid-warn' : ''}`}
                    data-pilot-field={`keywords.${key}[${chipIndex}].uuid`}
                    onClick={() => removeKw(key, c.uuid)}
                    disabled={isLeaving}
                    aria-label={chipUuidIssue ? `${c.label} — ${chipUuidIssue.message} — ${removeHint}` : removeHint}
                    title={chipUuidIssue ? chipUuidIssue.message : removeHint}
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
